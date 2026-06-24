import type { UpgradeId, ToolId, DigReward } from '@/core/types';

/**
 * Hot Rock — the single home for ALL gameplay tunables.
 * No gameplay number lives anywhere else. These are starting points for the
 * vertical slice; tune freely. Units: pixels, milliseconds, pixels/second.
 */

export const WORLD = {
  width: 4000,
  height: 3000,
  wallPadding: 120, // soft bounce margin at the edges
  wallSpring: 9, // inward acceleration/sec applied within the padding band
} as const;

/** Fixed-timestep simulation clock. Fixed dt + seeded RNG ⇒ deterministic rounds. */
export const TICK = {
  fixedDtMs: 1000 / 60,
  maxStepsPerFrame: 5, // spiral-of-death guard when a frame stalls
} as const;

export const MOVEMENT = {
  joystickDeadzone: 0.12, // ignore tiny stick noise so the boat holds heading
} as const;

/** Procedural island colliders (circles), generated from the round seed. */
export const ISLANDS = {
  count: 14,
  minRadius: 70,
  maxRadius: 180,
  edgeMargin: 200, // keep islands off the very edges
  minGap: 90, // minimum open water between two islands
  dockClearance: 260, // keep docks approachable
  spawnClearance: 340, // keep the player's spawn clear
} as const;

export const CAMERA = {
  followLerp: 0.12,
  lookAhead: 0.15, // fraction of velocity projected ahead of the boat
  boostZoomOut: 0.92, // zoom multiplier while boosting
  zoomLerp: 0.06,
} as const;

export const BOAT = {
  maxSpeed: 320,
  acceleration: 620,
  dragPerSec: 0.9, // velocity is multiplied by this each second when not thrusting
  turnRateDegPerSec: 220,
  radius: 26, // collision circle
  hitKnockback: 260,
  bobAmplitude: 2,
  knockbackFriction: 0.08, // external impulse (trap/ram) retains this fraction per second
} as const;

export const BOOST = {
  multiplier: 1.8,
  durationMs: 1500,
  rechargePerSec: 0.18, // fraction of the meter recovered per second
  refillCost: 150,
} as const;

export const DIG = {
  radius: 64,
  timeMs: 1800,
} as const;

/** Weighted loot for an ordinary dig site. The Rock is placed separately at
 *  exactly one random site at round start (never via this table). */
export const LOOT_TABLE: ReadonlyArray<{ weight: number; reward: DigReward }> = [
  { weight: 1, reward: { kind: 'none' } },
  { weight: 3, reward: { kind: 'gem', value: 80 } },
  { weight: 3, reward: { kind: 'gem', value: 150 } },
  { weight: 2, reward: { kind: 'gem', value: 250 } },
  { weight: 1, reward: { kind: 'gem', value: 400 } },
  { weight: 1, reward: { kind: 'trap' } },
  { weight: 1, reward: { kind: 'boost' } },
];

export const TRAP = {
  knockback: 300,
  gemsScattered: 2,
  scatterValue: 60,
} as const;

/** Loose gems in the water (from traps now; from Rock drops in M4). */
export const PICKUP = {
  gemRadius: 44, // auto-collect radius when a boat drives over a loose gem
  friction: 0.05, // scattered gems retain this fraction of speed per second (settle fast)
  scatterSpeed: 150, // initial fly-out speed of scattered gems
} as const;

export const UPGRADES: Record<UpgradeId, { cost: number | readonly number[]; label: string }> = {
  speed: { cost: [200, 400, 700], label: 'Engine' }, // 3 tiers
  boostRefill: { cost: 150, label: 'Refuel Boost' },
  net: { cost: 300, label: 'Grapple Net' },
  smoke: { cost: 250, label: 'Smoke Screen' },
  radar: { cost: 150, label: 'Sonar Ping' },
};
export const SPEED_TIER_BONUS = 0.12; // +12% max speed & acceleration per tier
export const MAX_SPEED_TIER = 3;

export const TOOLS: Record<ToolId, { durationMs: number }> = {
  boost: { durationMs: BOOST.durationMs },
  net: { durationMs: 6000 }, // wider steal window while active
  smoke: { durationMs: 3500 }, // hidden on minimap + speed burst to escape
  radar: { durationMs: 5000 }, // pings nearest site / Rock direction
};

/** The Hot Rock — the carryable macguffin everyone is chasing. */
export const ROCK = {
  carrierSpeedMult: 0.92, // small tax for holding it
  pickupRadius: 50,
  stealSpeed: 180, // min relative approach speed to knock it loose by ramming
  stealSpeedWithNet: 110, // easier if the rammer has a Net active
  stealContactPad: 10, // ram counts as contact within 2*BOAT.radius + this
  dropLockoutMs: 200, // brief no-pickup window after a drop
  dropScatter: 36, // px the Rock skitters when dropped
} as const;

export const EXTRACT = {
  holdMs: 2500, // hold at a dock to win; interrupted if rammed off
  dockRadius: 90,
} as const;

export const DOCKS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 300, y: 300 },
  { x: 3700, y: 2700 },
  { x: 3700, y: 300 },
];

export const HAZARD = {
  storm: {
    radius: 360,
    speedMult: 0.6, // movement slowed inside
    headingNudgeDegPerSec: 40, // pushes your heading around
    driftSpeed: 30, // the storm slowly wanders
  },
} as const;

export const BOTS = {
  defaultCount: 8,
  min: 4,
  max: 15,
  reactionMs: 220, // decision latency so bots feel human
  aimJitterDeg: 8,
  ditherChance: 0.08, // occasional sub-optimal move
} as const;

export const ROUND = {
  durationMs: 180_000,
  /** heat schedule keyframes: [atMs, heat 0..1]; interpolate between points. */
  heatKeyframes: [
    [0, 0],
    [60_000, 0.25],
    [120_000, 0.6],
    [180_000, 1],
  ] as ReadonlyArray<readonly [number, number]>,
  hintsStartMs: 60_000, // minimap edge hints toward the Rock site begin
  revealPulseAfterMs: 120_000,
  revealPulseEveryMs: 20_000, // pulse the Rock's location after the threshold
  autoSurfaceAtMs: 180_000, // if still undug, the Rock surfaces so a finish always happens
} as const;

export const ECONOMY = {
  startingCash: 0,
  winBonus: 1000,
} as const;

export const DIG_SITES = {
  count: 26, // scattered across the world
  minSpacing: 280,
} as const;
