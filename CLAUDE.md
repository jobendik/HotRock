# CLAUDE.md — Hot Rock

Authoritative guide for AI agents working in this repo. Where this file or `/docs`
disagrees with any older brief, **this wins**. Read `/docs` for detail before large tasks.

## What we're building
**Hot Rock** — a real-time, free-roam, treasure-smuggling **.io** game for **CrazyGames**.
You pilot a boat around a tropical archipelago, dig for **gems (cash)**, and hunt a
legendary diamond, **"the Rock."** When someone digs it up, the whole map is alerted,
the carrier **glows and is pinned on the minimap**, and everyone races to **ram them and
steal it** (hot-potato). **Smuggle the Rock to a black-market dock to win.** Rounds are
~3 minutes, bots backfill empty slots, there are **no eliminations** (a hit costs cash /
a knockback, never a life), and there is **no pay-to-win** (all upgrades reset each round).

This repo is a **single-player-vs-bots vertical slice**, architected so that authoritative
**real-time multiplayer slots in behind ONE seam** (`docs/NETCODE.md`) without touching the UI.

## Golden rules — do not break
1. **Two layers, never crossed.** `src/game/**` (Phaser) and `src/ui/**` (DOM/CSS) **never import each other**. They communicate **only** through `src/core/**` (typed event bus + store). ESLint enforces this; a violation **fails `lint`**.
2. **Phaser renders the world; DOM/CSS is ALL the UI.** No Phaser in `ui/`. No React/Vue/Svelte — vanilla TS + CSS.
3. **The simulation is pure.** All game rules live in `src/sim/**` — **no Phaser, no DOM** — so the exact same code runs in the browser today and on an authoritative server later. Phaser is **rendering + input only**.
4. **Strict TypeScript, no `any`.** A justified exception needs an inline `eslint-disable` + reason.
5. **Every gameplay number lives in `src/config/balance.ts`.** No magic numbers anywhere else.
6. **Deterministic + tested.** Pure modules (`sim/`, `BotAI`, economy, round) use the seedable RNG in `core/rng.ts` and have **Vitest** tests. **Tests never import Phaser or the DOM.**
7. **After every change run:** `npm run typecheck && npm run lint && npm run test`. Keep `npm run dev` running.
8. **Build in milestones** (`docs/ROADMAP.md`). **Commit per milestone, then stop and report.** Ask before deviating from the docs.

## Architecture in one breath
`ui → core ← game → sim → core`. `core` depends on nothing app-specific.
UI emits **`intent:*`** events; game/sim emit **domain** events; UI re-renders from a
**throttled** store snapshot (~12–15Hz). The entire simulation hides behind a
**`WorldModel`** interface — `LocalWorldModel` now, `NetworkedWorldModel` later.
Full detail: `docs/ARCHITECTURE.md`. The cross-layer message list: `src/core/events.ts`.

## Where things go
- `src/core/` — `events.ts` (the contract), `types.ts`, `EventBus`, `store`, `rng`, `math`. **Shared by everyone; imports nothing app-specific.**
- `src/sim/` — pure `GameSim` + `systems/` + `physics` + `BotAI`. **No Phaser/DOM.** Shared verbatim with the future server.
- `src/game/` — Phaser only: `scenes/`, `render/` views, `input/`, `world/` (the WorldModel). **Never imports `ui/`.**
- `src/ui/` — DOM only: `screens/`, `hud/`, `Minimap` (a DOM `<canvas>`), `components/`, `styles/`. **Never imports `game/`, `sim/`, or `phaser`.**
- `src/platform/` — CrazyGames SDK adapter with a no-op fallback.
- `src/config/` — `balance.ts`, `gameConfig.ts`, `controls.ts`.
- `tests/` — Vitest; pure logic only.

## Commands
`npm run dev` · `build` · `preview` · `typecheck` · `lint` · `lint:fix` · `format` · `test` · `test:watch`

## Definition of done (every change)
typecheck + lint + test pass · `dev` runs · no new `any` · all gameplay numbers in `balance.ts`
· boundary lint green · docs updated if behaviour or the event contract changed.

## Docs
- `docs/DESIGN.md` — the game design.
- `docs/ARCHITECTURE.md` — layers, the event contract, the `WorldModel` seam, canonical folder tree.
- `docs/NETCODE.md` — how authoritative multiplayer is added (server, prediction, interpolation, rooms).
- `docs/ROADMAP.md` — milestones M0–M6 and beyond.
- `docs/CONVENTIONS.md` — coding standards & patterns.

## Current status
> Keep this line current as you progress. **Milestone: M1 complete — drivable boat (pure `sim/` movement + circle physics, fixed-timestep + interpolation), follow camera with look-ahead + boost zoom, procedural island colliders, soft walls, desktop keyboard + mobile DOM joystick, all behind the `WorldModel` seam. Next: M2 — dig sites + digging + gems + cash.**
