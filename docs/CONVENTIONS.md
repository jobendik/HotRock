# Hot Rock — Coding Conventions

Defaults for everyone (humans and agents). Consistency beats cleverness.

## TypeScript
- **Strict everywhere:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`.
- **No `any`.** Use `unknown` + narrowing. A justified exception needs
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
- Prefer `type`/`interface` in `core/types.ts` for shared shapes; keep payloads small and explicit.
- `readonly` and `as const` for config and immutable data.

## Imports & boundaries
- Path alias **`@/*` → `src/*`** only; no deep relative `../../..` chains across layers.
- **Layer rules (lint-enforced):** `core` imports nothing app-specific; `sim` imports only `core`;
  `game` may import `core` + `sim` but never `ui`; `ui` imports only `core` (never `game`/`sim`/`phaser`).
- If a task seems to need a cross-layer import, **stop** and propose an `events.ts` change instead.

## Files & modules
- Small, single-responsibility files. If a file exceeds ~250–300 lines, split it.
- One system per file in `sim/systems/`; one render view per file in `game/render/`.
- Name files by role: `BoatView.ts` (render), `movement.ts` (sim system), `Hud.ts` (UI).

## Naming
- Types `PascalCase`; vars/functions `camelCase`; constants `UPPER_SNAKE` (in `balance.ts`).
- Events are namespaced strings: `intent:*` for UI→game, `domain:verb` (e.g. `rock:stolen`) for game→UI.
- Ids are `string` (`PlayerId`), site ids stable across a round.

## Comments & docs
- JSDoc the **event contract** and each **system's** public function. Comment *why*, not *what*.
- Update the relevant `/docs` file (and `CLAUDE.md` status line) when behaviour or the contract changes.

## Testing (Vitest)
- **Pure logic only — never import Phaser or the DOM in a test.**
- Drive tests with the **seedable RNG** so they're deterministic; assert on `GameSim`/system outputs.
- Cover: economy/loot math, `BotAI` decisions, carry/steal/extract transitions, round/heat/win.
- Add a decoupling test that imports `ui/` logic with the game stubbed (proves layer independence).

## Performance
- **No allocations in hot paths** (`step()`, render sync, per-frame loops). Reuse vectors/objects; pool entities (gems, particles).
- Push UI snapshots at **~12–15 Hz**, not per frame. The minimap reads a shared snapshot ref each rAF.
- Fixed-dt simulation; interpolate for rendering. Target 60 fps on mid-range mobile.

## CSS (UI layer)
- Design tokens (CSS custom properties) in `styles/tokens.css`; **no inline magic colors**.
- Style by `class` / `data-*` attributes; keep selectors shallow. Responsive + touch-friendly hit areas.
- Honour `@media (prefers-reduced-motion: reduce)` — disable screen shake and heavy motion.

## Errors & platform
- No silent `catch {}`. Log with context; fail safe.
- `platform/crazygames.ts` must **never block gameplay**: a no-op fallback when the SDK is absent/fails.

## Git
- **Conventional commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`). One coherent change per commit; a commit per milestone is the baseline.
- Keep `main` green: don't commit if `typecheck`/`lint`/`test` fail.

## Accessibility
- Readable contrast, scalable HUD text, large touch targets, reduced-motion support, no flashing.
