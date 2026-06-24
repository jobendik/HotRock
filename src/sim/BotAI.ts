import type { InputFrame } from '@/core/types';
import type { Rng } from '@/core/rng';
import { dist, TAU, type Vec2 } from '@/core/math';
import { BOTS, DIG, DOCKS } from '@/config/balance';
import { nextTierCost, flatCost } from '@/sim/systems/economy';
import type { WorldState, Boat } from '@/sim/WorldState';

/**
 * Pure bot brain. `decide(state, self, rng)` returns one InputFrame — exactly the
 * shape a human produces — so the same code drives bots locally now and on the
 * server later. States: PROSPECT (dig), INTERCEPT (cut off the carrier), STEAL
 * (ram), CARRY_RUN (run to a dock), FLEE (evade while running). Tuned beatable
 * via reaction jitter + occasional dithering.
 */
const DEG2RAD = Math.PI / 180;

export function decide(state: WorldState, self: Boat, rng: Rng): InputFrame {
  const rock = state.rock;

  if (rock.found && rock.carrierId === self.id) return carryRun(state, self, rng);

  if (rock.found && rock.carrierId && rock.carrierId !== self.id) {
    const carrier = boatById(state, rock.carrierId);
    if (carrier) {
      const d = dist(self.x, self.y, carrier.x, carrier.y);
      return d < BOTS.stealRange ? steal(state, self, carrier, rng) : intercept(state, self, carrier, rng);
    }
  }

  if (rock.found && !rock.carrierId) {
    // Loose Rock — race for it.
    return frame(humanize(steer(state, self, rock.x, rock.y), rng), { boost: true });
  }

  return prospect(state, self, rng);
}

// ---- states ----

function prospect(state: WorldState, self: Boat, rng: Rng): InputFrame {
  const site = nearestUndugSite(state, self);
  const buy = canAfford(self, nextTierCost(self.speedTier)) ? ({ buyUpgrade: 'speed' } as const) : {};
  if (!site) return frame(wander(self, rng), buy);

  const d = dist(self.x, self.y, site.x, site.y);
  const dir = humanize(steer(state, self, site.x, site.y), rng);
  // Ease off near the site so we loiter in range and dig instead of overshooting.
  const throttle = d < DIG.radius ? 0.1 : Math.min(1, d / BOTS.prospectSlowRadius);
  return frame({ x: dir.x * throttle, y: dir.y * throttle }, buy);
}

function intercept(state: WorldState, self: Boat, carrier: Boat, rng: Rng): InputFrame {
  const tx = carrier.x + carrier.vx * BOTS.leadTime;
  const ty = carrier.y + carrier.vy * BOTS.leadTime;
  const buy =
    self.tools.net.count === 0 && canAfford(self, flatCost('net'))
      ? ({ buyUpgrade: 'net' } as const)
      : {};
  return frame(humanize(steer(state, self, tx, ty), rng), { boost: true, ...buy });
}

function steal(state: WorldState, self: Boat, carrier: Boat, rng: Rng): InputFrame {
  const useNet =
    self.tools.net.count > 0 && self.tools.net.activeMsLeft === 0
      ? ({ useTool: 'net' } as const)
      : {};
  return frame(humanize(steer(state, self, carrier.x, carrier.y), rng), { boost: true, ...useNet });
}

function carryRun(state: WorldState, self: Boat, rng: Rng): InputFrame {
  const dock = nearestDock(self);
  let dir = steer(state, self, dock.x, dock.y);

  // FLEE: bias away from the nearest chaser, and pop Smoke if we have it.
  const threat = nearestThreat(state, self);
  const extra: Partial<InputFrame> = { boost: true };
  if (threat && dist(self.x, self.y, threat.x, threat.y) < BOTS.fleeRange) {
    const ax = self.x - threat.x;
    const ay = self.y - threat.y;
    const m = Math.hypot(ax, ay) || 1;
    dir = normalize(dir.x + (ax / m) * 0.7, dir.y + (ay / m) * 0.7);
    if (self.tools.smoke.count > 0 && self.tools.smoke.activeMsLeft === 0) extra.useTool = 'smoke';
  } else if (self.tools.smoke.count === 0 && canAfford(self, flatCost('smoke'))) {
    extra.buyUpgrade = 'smoke';
  }
  return frame(humanize(dir, rng), extra);
}

// ---- helpers ----

function steer(state: WorldState, self: Boat, tx: number, ty: number): Vec2 {
  let dx = tx - self.x;
  let dy = ty - self.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  // Light island avoidance: push away from an island that's ahead.
  for (const isl of state.islands) {
    const ix = isl.x - self.x;
    const iy = isl.y - self.y;
    const id = Math.hypot(ix, iy) || 1;
    if (id < isl.radius + BOTS.avoidRange && (ix * dx + iy * dy) / id > 0.25) {
      dx -= (ix / id) * 0.9;
      dy -= (iy / id) * 0.9;
    }
  }
  return normalize(dx, dy);
}

/** Add aim jitter and occasional dithering so bots feel human, not robotic. */
function humanize(dir: Vec2, rng: Rng): Vec2 {
  if (rng.chance(BOTS.ditherChance)) {
    const a = rng.range(0, TAU);
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  const jitter = rng.range(-1, 1) * BOTS.aimJitterDeg * DEG2RAD;
  const a = Math.atan2(dir.y, dir.x) + jitter;
  return { x: Math.cos(a), y: Math.sin(a) };
}

function wander(self: Boat, rng: Rng): Vec2 {
  // Drift toward the map centre with a random nudge so idle bots don't beach.
  const cx = 2000 - self.x;
  const cy = 1500 - self.y;
  const a = Math.atan2(cy, cx) + rng.range(-1, 1);
  return { x: Math.cos(a), y: Math.sin(a) };
}

function frame(joystick: Vec2, extra: Partial<InputFrame> = {}): InputFrame {
  return { seq: 0, joystick, boost: false, dig: false, tool: false, ...extra };
}

function normalize(x: number, y: number): Vec2 {
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}

function canAfford(self: Boat, cost: number): boolean {
  return Number.isFinite(cost) && self.cash >= cost;
}

function boatById(state: WorldState, id: string): Boat | null {
  for (const b of state.boats) if (b.id === id) return b;
  return null;
}

function nearestUndugSite(state: WorldState, self: Boat): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const s of state.sites) {
    if (s.dug) continue;
    const d = dist(self.x, self.y, s.x, s.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function nearestDock(self: Boat): { x: number; y: number } {
  let best = DOCKS[0]!;
  let bestD = Infinity;
  for (const d of DOCKS) {
    const dd = dist(self.x, self.y, d.x, d.y);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

function nearestThreat(state: WorldState, self: Boat): Boat | null {
  let best: Boat | null = null;
  let bestD = Infinity;
  for (const b of state.boats) {
    if (b.id === self.id) continue;
    const d = dist(self.x, self.y, b.x, b.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

