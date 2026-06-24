import type { PlayerId } from '@/core/types';

/**
 * The authoritative world — plain serialisable data only (NO Phaser, NO DOM).
 * The exact same shape is produced by `GameSim` in the browser today and by the
 * server later, which is what lets the netcode slot in behind the WorldModel seam.
 *
 * Grows per milestone: M1 adds boats + islands; sites/rock/pickups/storm/round
 * land in later milestones.
 */

export interface Boat {
  id: PlayerId;
  name: string;
  isBot: boolean;
  /** Position (world px). */
  x: number;
  y: number;
  /** Velocity (px/s). */
  vx: number;
  vy: number;
  /** Facing in radians (0 = +x). */
  angle: number;
  /** Angular velocity (rad/s) from the last step — render-only banking cue. */
  angularVel: number;
  /** Engine upgrade tier (0..MAX_SPEED_TIER). */
  speedTier: number;
  /** Boost meter, 0..1 (1 = ready to fire). */
  boostCharge: number;
  boosting: boolean;
  /** Remaining boost time in ms while `boosting`. */
  boostMsLeft: number;
  /** Stable render colour (one of the player palette entries). */
  color: string;
}

/** A static circular island collider. */
export interface Island {
  x: number;
  y: number;
  radius: number;
}

export interface WorldState {
  seed: number;
  /** Live PRNG state, so a round is reproducible from (seed, inputs). */
  rngState: number;
  width: number;
  height: number;
  /** Elapsed simulated time (ms). */
  timeMs: number;
  /** Id of the local/human player (the one this client predicts + follows). */
  localId: PlayerId;
  boats: Boat[];
  islands: Island[];
}

/** Player palette — also surfaced to the minimap. Index 0 is the local player. */
export const PLAYER_COLORS = ['#ef6f53', '#4f9bf0', '#38c98b', '#c77dff'] as const;

/** Construct a boat at rest, facing "up" (−y), with a full boost meter. */
export function makeBoat(
  id: PlayerId,
  name: string,
  isBot: boolean,
  x: number,
  y: number,
  color: string,
): Boat {
  return {
    id,
    name,
    isBot,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    angularVel: 0,
    speedTier: 0,
    boostCharge: 1,
    boosting: false,
    boostMsLeft: 0,
    color,
  };
}
