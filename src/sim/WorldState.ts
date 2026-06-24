import type { PlayerId, DigReward, ConsumableToolId } from '@/core/types';

/** Per-consumable-tool runtime: owned charges + remaining active window. */
export interface ToolRuntime {
  count: number;
  activeMsLeft: number;
}

/**
 * The authoritative world — plain serialisable data only (NO Phaser, NO DOM).
 * The exact same shape is produced by `GameSim` in the browser today and by the
 * server later, which is what lets the netcode slot in behind the WorldModel seam.
 *
 * Grows per milestone: M1 adds boats + islands; M2 adds dig sites + loose gems;
 * rock/storm/round land in later milestones.
 */

export interface Boat {
  id: PlayerId;
  name: string;
  isBot: boolean;
  /** Position (world px). */
  x: number;
  y: number;
  /** Velocity (px/s) from thrust + drag (speed-clamped). */
  vx: number;
  vy: number;
  /** External impulse velocity (trap/ram) — unclamped, decays separately. */
  knockVx: number;
  knockVy: number;
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
  /** Accumulated cash this round (gems smuggled). */
  cash: number;
  /** Stat: number of completed digs this round. */
  digs: number;
  /** Site currently being dug (within range), or null. */
  digSiteId: string | null;
  /** Hold time accrued at `digSiteId` (ms). */
  digMs: number;
  /** Owned charges + active windows for the consumable tools. */
  tools: Record<ConsumableToolId, ToolRuntime>;
  /** True while this boat is holding the Rock (set by the carry system). */
  carrying: boolean;
  /** Stat: Rock steals this round. */
  steals: number;
  /** Stat: total time spent holding the Rock (ms). */
  carrierMs: number;
  /** Stable render colour (one of the player palette entries). */
  color: string;
}

/** The Hot Rock — the carryable everyone is chasing. */
export interface Rock {
  /** Has it been dug up / surfaced yet? */
  found: boolean;
  /** World position (tracks the carrier while carried). */
  x: number;
  y: number;
  /** Current holder, or null when loose in the water. */
  carrierId: PlayerId | null;
  /** Most recent holder (drives the "STOLEN!" event on the next pickup). */
  lastCarrierId: PlayerId | null;
  /** Brief no-pickup window after a drop (ms). */
  dropLockoutMs: number;
  /** Accumulated dock-hold time toward extraction (ms). */
  extractMs: number;
  /** The site it's buried in until found (then null). */
  siteId: string | null;
}

/** A static circular island collider. */
export interface Island {
  x: number;
  y: number;
  radius: number;
}

/** A dig site. The reward is pre-rolled at worldgen so rounds are reproducible. */
export interface DigSite {
  id: string;
  x: number;
  y: number;
  dug: boolean;
  reward: DigReward;
}

/** A loose gem drifting in the water (scattered by a trap; collectible by anyone). */
export interface Pickup {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
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
  sites: DigSite[];
  pickups: Pickup[];
  /** Monotonic id source for pickups. */
  nextPickupId: number;
  rock: Rock;
  /** Global urgency 0..1, interpolated from the heat schedule. */
  heat: number;
  /** Once true, the Rock's location is hinted on the minimap (pre-find). */
  rockHinted: boolean;
  /** Sim time of the last reveal pulse (ms). */
  lastRevealPulseMs: number;
  /** Set true once the round has been decided; the sim then idles. */
  over: boolean;
}

/** Player palette — also surfaced to the minimap. Index 0 is the local player. */
export const PLAYER_COLORS = ['#ef6f53', '#4f9bf0', '#38c98b', '#c77dff'] as const;

/** Flavour names for the backfill bots. */
export const BOT_NAMES = [
  'Maelle',
  'Drake',
  'Calico',
  'Reef',
  'Sable',
  'Marlow',
  'Cutter',
  'Brine',
  'Tasha',
  'Onyx',
  'Vesper',
  'Coral',
  'Flint',
  'Mako',
] as const;

/** Deterministic, evenly-spread bot colour by index (golden-angle hue). */
export function botColor(i: number): string {
  const hue = (i * 137.508) % 360;
  return hslToHex(hue, 62, 60);
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number): number => {
    const c = ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c);
  };
  const hex = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

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
    knockVx: 0,
    knockVy: 0,
    angle: -Math.PI / 2,
    angularVel: 0,
    speedTier: 0,
    boostCharge: 1,
    boosting: false,
    boostMsLeft: 0,
    cash: 0,
    digs: 0,
    digSiteId: null,
    digMs: 0,
    tools: {
      net: { count: 0, activeMsLeft: 0 },
      smoke: { count: 0, activeMsLeft: 0 },
      radar: { count: 0, activeMsLeft: 0 },
    },
    carrying: false,
    steals: 0,
    carrierMs: 0,
    color,
  };
}
