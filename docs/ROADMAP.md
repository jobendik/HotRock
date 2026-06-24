# Hot Rock — Roadmap

Build the slice in order. **After each milestone: run `typecheck` + `lint` + `test`, ensure `dev`
runs, commit (conventional commit), and stop to report.** Then continue.

## Vertical slice (this repo)

### M0 — Scaffolding
- Repo + tooling: Vite, strict TS, ESLint (+ **import-boundary rules**), Prettier, Vitest, npm scripts.
- The full layered folder structure (empty modules ok).
- `index.html` with a Phaser canvas root + a DOM UI root.
- `core/EventBus`, `core/store`, and the **complete `core/events.ts` + `core/types.ts`**.
- Phaser boots a blank `WorldScene`; DOM **Main Menu** emits `intent:startRound`.
- `platform/crazygames.ts` **stub** (no-op fallback).
- ✅ `npm run dev` runs; `lint` (boundaries active) + `typecheck` pass.

### M1 — Boat + world + camera + input
- One boat you can drive on water with full juice (wake, banking, drift); follow camera + boost zoom.
- Islands as colliders. Soft walls at world bounds.
- **Desktop and mobile** (DOM virtual joystick) both work.
- `sim/physics` + `sim/systems/movement` + `LocalWorldModel` skeleton in place.

### M2 — Dig sites + digging + gems + cash
- Dig mechanic with hold + radial progress; loot tables; cash floats into the HUD counter.
- Baseline **minimap** (DOM `<canvas>`) showing boats + sites + docks.
- Economy/loot tests.

### M3 — Upgrades + tools
- DOM **upgrade bar** (buy/affordability/cooldowns); **Boost** tool wired to the boat.
- Apply Engine tiers; Refuel; stub Net/Smoke/Radar windows.
- Economy/upgrade tests.

### M4 — The Hot Rock (hot potato)
- Find → beam/glow → permanent minimap presence → **carrier banner + dock arrow**.
- Pickup / **steal-by-ram** / drop (+ lockout) / **dock extraction → win**.
- All carry logic in `sim/systems/carry`. Carry/steal/extract tests.

### M5 — Bots + round + heat
- Pure `BotAI` states (PROSPECT/INTERCEPT/CARRY_RUN/FLEE/STEAL); spawn 8 bots.
- `sim/systems/round`: timer + heat schedule + reveal pulses + auto-surface + win detection.
- **Full loop now playable vs bots.** Round/AI tests.

### M6 — Results + requeue + polish + docs
- Results screen + Play Again + **ad hooks** (rewarded/interstitial via the SDK adapter).
- Settings (sound/quality/controls). Toasts, screen shake, sfx hooks, `prefers-reduced-motion`, mobile layout pass.
- Finalize `README` / `DESIGN` / `ARCHITECTURE` / `NETCODE`. Hit the full Definition of Done.

## Beyond the slice

### P7 — Authoritative multiplayer
Execute `docs/NETCODE.md`: extract `GameSim` onto a Node server, add `NetworkedWorldModel`, prediction
+ interpolation, rooms/matchmaking/backfill, hardening. **UI unchanged.**

### P8 — Content & variety
More dig-site types and biomes; reef + Kraken hazards; seaplane shortcut routes; multiple maps; daily seed.

### P9 — Meta & persistence
Accounts (via CrazyGames), cosmetics shop (boats/wakes/Rock skins/emotes — vanity only), soft currency,
profile stats, leaderboards. Persistence service off the realtime path.

### P10 — LiveOps
Events/seasons, rotating modifiers, challenges, telemetry-driven balance.

### P11 — Art & audio pass
Replace placeholder textures with a real atlas; music + SFX (audio sprite); particle polish; juice tuning.

### P12 — Launch checklist
CrazyGames QA + SDK requirements, performance budget on low-end mobile, analytics, crash/error reporting,
loading optimization, store/listing assets.
