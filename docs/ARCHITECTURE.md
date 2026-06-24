# Hot Rock — Architecture

The project is split into **layers that never reach across each other**, joined by a single
typed contract. This is what keeps the UI and the game independently buildable and testable —
and what lets real multiplayer drop in later without touching the UI.

## 1. Layers & dependency direction
```
            ┌─────────────┐
            │   platform   │  CrazyGames SDK adapter (leaf; used by main.ts only)
            └──────┬───────┘
                   │
   ┌──────────┐    │    ┌──────────┐
   │   ui/    │────┼────│  game/   │      ui never imports game/sim/phaser
   │ DOM+CSS  │    │    │  Phaser  │      game never imports ui
   └────┬─────┘    │    └────┬─────┘
        │          │         │
        │          ▼         ▼
        │     ┌──────────────────┐
        └────▶│      core/       │◀─────┐  core depends on NOTHING app-specific
              │ events,types,bus │      │
              │ store,rng,math   │      │
              └──────────────────┘      │
                        ▲                │
                        │                │
                   ┌────┴─────┐          │
                   │   sim/   │──────────┘  pure simulation; no Phaser, no DOM
                   │ GameSim  │             (game/ imports sim/; sim/ imports only core/)
                   └──────────┘
```
**Rules (enforced by ESLint import boundaries — a violation fails `lint`):**
- `core/**` imports nothing from `sim/ game/ ui/ platform/` and never imports `phaser` or the DOM.
- `sim/**` imports only `core/**`. **Never** `phaser`, `game/`, `ui/`, or DOM globals.
- `game/**` may import `core/**` and `sim/**`. **Never** `ui/**`.
- `ui/**` may import `core/**` only. **Never** `game/**`, `sim/**`, or `phaser`.
- `platform/**` is a leaf, wired in `main.ts`.

> **Litmus test:** anything a player *reads or taps in HTML* is `ui/`. Anything in the *game world* is `game/` (render) backed by `sim/` (rules). The minimap is a **DOM `<canvas>`** fed by a snapshot — it is UI, not Phaser.

## 2. The bridge: event bus + store (`core/`)
The **only** way the layers talk.
- **`core/events.ts`** — the typed `Events` map: `intent:*` (UI→game) and domain events (game→UI). Single source of truth.
- **`core/EventBus.ts`** — typed `on/emit`. UI emits intents; game subscribes. Game emits domain events; UI subscribes.
- **`core/store.ts`** — a tiny reactive store holding the **UI-facing snapshot** (`HudSnapshot`). The game pushes snapshots at **~12–15Hz, never per frame**; UI components `subscribe(selector)` and re-render on change. The **minimap** reads a shared mutable `MinimapSnapshot` ref each rAF for smoothness (still no Phaser import).

Why: the UI is a pure function of (snapshot + events); the game is a pure producer of them. Either can be rebuilt, mocked, or (for the game) moved to a server, without the other noticing.

## 3. The game layer (`game/`, Phaser)
Phaser does **rendering, camera, particles, and input capture only**. It owns no game rules.
- `scenes/BootScene.ts` — generate placeholder textures (`gfx/`), then start the world.
- `scenes/WorldScene.ts` — creates the `WorldModel`, captures input → `InputFrame`, calls `model.update(dt, input)` each frame, and **renders** `model.getView()` by syncing render views to sim entities. Pushes `hud:update` / `minimap:snapshot` (throttled) to the store/bus.
- `render/*View.ts` — thin Phaser sprites mirroring sim entities by id (BoatView, RockView, DigSiteView, PickupView, DockView, StormView). No logic.
- `input/InputController.ts` — unify keyboard/mouse + the DOM joystick's `intent:joystick`/`intent:action` events into one `InputFrame` per frame.
- `world/WorldModel.ts` — **the netcode seam** (see §6).
- `world/LocalWorldModel.ts` — wraps the pure `GameSim` + bots; authoritative locally.

## 4. The simulation layer (`sim/`, pure)
**No Phaser, no DOM, no globals.** The authoritative game logic, runnable identically in the
browser (local mode) and on a future server. This is deliberate — see `docs/NETCODE.md`.
- `sim/WorldState.ts` — plain-data world: boats, sites, rock, pickups, docks, storm, round, rng state.
- `sim/GameSim.ts` — `start(seed, config)`, `step(dtMs, inputsById)`, `getState()`. Steps the systems in order and emits domain events via an injected emitter (so it stays DOM-agnostic).
- `sim/physics.ts` — circle integration + soft collision/separation (boats are circles). **We do NOT use Phaser Arcade physics** so the sim is portable to the server (see ADR-2).
- `sim/systems/` — `movement`, `digging`, `carry` (pickup/steal/drop/extract), `economy`, `hazard`, `round` (timer/heat/win). Pure functions over `WorldState`.
- `sim/BotAI.ts` — pure `decide(state, self, rng) -> InputFrame`. Drives bots locally now and on the server later.

### Fixed timestep
`GameSim.step` is called with a **fixed dt** (e.g., 1/60s) via an accumulator in `WorldScene`
(and at the server tick rate later). Rendering interpolates between sim states for smoothness.
Fixed dt + seeded RNG ⇒ deterministic, reproducible rounds (great for tests and for server authority).

## 5. Input flow
DOM controls (`ui/hud/MobileControls`, keyboard handlers) emit `intent:joystick` / `intent:action`
→ `game/input/InputController` assembles an `InputFrame` → `WorldScene` feeds it to `model.update()`
→ `LocalWorldModel` hands it to `GameSim`. In MP, `NetworkedWorldModel` sends the frame to the server instead.

## 6. The netcode seam: `WorldModel`
`WorldScene` must never run rules inline; it delegates to a `WorldModel`:
```ts
export interface WorldModel {
  start(seed: number, config: RoundConfig): void;
  update(dtMs: number, localInput: InputFrame): void; // advance + apply local intent
  getView(): WorldView;                                // read-only state to render
  stop(): void;
}
```
- **`LocalWorldModel`** (now): owns a `GameSim` + bots; fully authoritative in the browser.
- **`NetworkedWorldModel`** (later): sends `InputFrame`s to the server, applies authoritative
  snapshots, predicts the local boat, interpolates remotes, reconciles. Same interface ⇒ `WorldScene`
  and **all of `ui/` are untouched**. Full plan in `docs/NETCODE.md`.

## 7. Determinism & RNG
`core/rng.ts` is a seedable PRNG. `GameSim`, `BotAI`, and `round` take their randomness from the
world's RNG state so a `(seed, inputs)` pair reproduces a round exactly. Pass seeds in tests.

## 8. Testing strategy
**Vitest, pure logic only — never import Phaser or the DOM.**
- `economy` — loot/reward math, cash accrual, upgrade application.
- `botai` — decisions over synthetic `WorldState` snapshots.
- `carry` — pickup → steal → drop → extract transitions, lockout, win.
- `round` — heat interpolation, reveal pulses, auto-surface, end conditions, winner selection.
Decoupling is itself tested: a unit test imports `ui/` logic with the game stubbed (no Phaser) to prove independence.

## 9. Config & assets
- `config/balance.ts` — every gameplay number (the only place).
- `config/gameConfig.ts` — Phaser.Game config (scale `RESIZE`/`FIT`, renderer, physics off — we use our own).
- `config/controls.ts` — key/action bindings.
- `gfx/textures.ts` — programmatic placeholder art so the slice runs with **no external assets**. `public/assets/README.md` describes the future atlas/audio-sprite pipeline.

## 10. Decisions (ADRs)
- **ADR-1 — DOM/CSS for all UI, Phaser for the world.** Cleaner UX iteration, accessibility, and crisp text/layout in HTML; Phaser focuses on what it's good at. Enforced by boundary lint.
- **ADR-2 — Pure `sim/` with custom circle physics (not Phaser Arcade).** The simulation must run on an authoritative server; coupling rules to Phaser would block that. Boats as circles with simple separation are ample for an .io boat game and keep the sim deterministic and portable.
- **ADR-3 — Typed event bus + throttled store as the only bridge.** Decouples layers, enables mocking/testing, and makes the server "just another emitter" of the same domain events in MP.
- **ADR-4 — `WorldModel` seam.** A single interface isolates "where the simulation lives," so multiplayer is an additive implementation rather than a rewrite.
