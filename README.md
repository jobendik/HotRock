# Hot Rock 🔥💎

A real-time, free-roam, treasure-smuggling **.io** game for the **CrazyGames** platform.

Dig the archipelago for gems, find the legendary diamond — **the Rock** — then survive the
whole lobby and **smuggle it to a black-market dock to win**. Get rammed and the Rock pops
loose for anyone to grab. It's a hot-potato chase: fast rounds, no eliminations, no pay-to-win.

> **Status:** vertical slice **complete & playable** (milestones M0–M6) — single-player **vs 8 bots**,
> no netcode yet, but architected so authoritative real-time multiplayer drops in behind one seam
> (see `docs/NETCODE.md`).

## What's in the slice
- **Drive** an arcade boat with momentum/drift, wake, banking and a follow camera (boost zoom-out).
- A procedural **archipelago**: island colliders, soft walls, scattered dig sites, fixed docks.
- **Prospect**: hold/auto **dig** sites for a seeded loot table → gems become cash; **traps** knock you
  back and scatter loose gems; a corner **minimap** tracks boats, sites, docks and the Rock.
- **Upgrades & tools** (reset each round, no pay-to-win): Engine tiers, Refuel, and Net / Smoke / Sonar
  consumables with active windows.
- **The Hot Rock**: dig it up to surface it → it glows with a light pillar and is pinned on the minimap.
  **Steal by ramming** the carrier, grab the dropped Rock, and **smuggle it to a dock** to win.
- **8 bots** with a finite-state brain (prospect / intercept / steal / run / flee), a 3-minute **round**
  with a heat curve, reveal hints/pulses and a late **auto-surface** so every round resolves.
- **Results** screen (winner + your run + rewarded double-payout), **Play Again**, **Settings**
  (sound / volume / quality), zero-asset **WebAudio** SFX, screen shake, and `prefers-reduced-motion`.

All rules live in a **pure, deterministic `src/sim/`** with **51 Vitest tests** (including a full-round
integration test); the entire UI is DOM/CSS driven only by the event bus + store.

## Quick start
```bash
npm install
npm run dev        # http://localhost:5173
```
Build & preview a production bundle:
```bash
npm run build
npm run preview
```

## Deploy (GitHub Pages)
A workflow (`.github/workflows/deploy.yml`) builds and publishes `dist/` to GitHub Pages on every
push to `main`. **One-time setup:** in the repo, go to **Settings → Pages → Build and deployment →
Source** and select **GitHub Actions**. The site then publishes to `https://<owner>.github.io/<repo>/`.
The build uses a **relative base** (`base: './'`), so the same bundle also runs from any subpath
(itch.io, a CrazyGames CDN slot, etc.) with no config change.

## Scripts
| Script | Purpose |
| --- | --- |
| `dev` | Vite dev server with HMR |
| `build` | Type-check + production build |
| `preview` | Serve the built bundle |
| `typecheck` | `tsc --noEmit` |
| `lint` / `lint:fix` | ESLint (incl. layer-boundary rules) |
| `format` | Prettier |
| `test` / `test:watch` | Vitest (pure logic) |

## Controls
**Desktop** — steer with WASD / arrow keys (optional mouse-aim toggle); **Boost** = Shift/Space;
**Tool** = E or click; **Dig** = auto-prompt near a site, hold to dig.
**Mobile** — left **virtual joystick**; **Boost** + **Tool** buttons bottom-right; **auto-dig** on proximity.

## Tech
Vite · TypeScript (strict) · **Phaser 3** (game world only) · DOM + CSS (all UI/HUD/menus) ·
Vitest. The simulation is a pure, Phaser-free `src/sim/` module so it can later run on a server.

## Project layout
```
src/core/     cross-layer contract: events, types, EventBus, store, rng, math
src/sim/      PURE game simulation + systems + physics + BotAI (no Phaser/DOM)
src/game/     Phaser: scenes, render views, input, WorldModel  (never imports ui/)
src/ui/       DOM: screens, HUD, minimap (DOM canvas), components, CSS  (never imports game/sim/phaser)
src/platform/ CrazyGames SDK adapter (no-op fallback)
src/config/   balance.ts (all tunables), gameConfig.ts, controls.ts
tests/        Vitest — pure logic only
docs/         DESIGN · ARCHITECTURE · NETCODE · ROADMAP · CONVENTIONS
```

## Docs
Start with **`CLAUDE.md`** (project rules), then `docs/DESIGN.md`, `docs/ARCHITECTURE.md`,
and `docs/NETCODE.md`.

## License
TBD.
