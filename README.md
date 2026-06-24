# Hot Rock 🔥💎

A real-time, free-roam, treasure-smuggling **.io** game for the **CrazyGames** platform.

Dig the archipelago for gems, find the legendary diamond — **the Rock** — then survive the
whole lobby and **smuggle it to a black-market dock to win**. Get rammed and the Rock pops
loose for anyone to grab. It's a hot-potato chase: fast rounds, no eliminations, no pay-to-win.

> **Status:** vertical slice — single-player **vs bots**, no netcode yet, but architected so
> authoritative real-time multiplayer drops in behind one seam (see `docs/NETCODE.md`).

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
