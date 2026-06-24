import type { InputFrame, RoundConfig } from '@/core/types';
import type { WorldState } from '@/sim/WorldState';

/**
 * The netcode seam. `WorldScene` owns rendering + input capture and delegates
 * ALL simulation to a `WorldModel`, so swapping local play for authoritative
 * multiplayer is an additive implementation — the scene and the entire UI are
 * untouched (docs/NETCODE.md).
 *
 * `LocalWorldModel` (now) runs the pure `GameSim` in-browser. `NetworkedWorldModel`
 * (later) forwards inputs to a server and applies authoritative snapshots.
 */
export type WorldView = Readonly<WorldState>;

export interface WorldModel {
  /** Begin a round; the underlying sim emits `round:started`. */
  start(seed: number, config: RoundConfig): void;
  /** Advance one fixed step, applying the local player's input for this tick. */
  update(dtMs: number, localInput: InputFrame): void;
  /** Read-only world state for rendering + HUD/minimap snapshots. */
  getView(): WorldView;
  stop(): void;
}
