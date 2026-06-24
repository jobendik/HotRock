import type { EventSink } from '@/core/events';
import { dist, TAU } from '@/core/math';
import { Rng } from '@/core/rng';
import { DIG, TRAP, PICKUP } from '@/config/balance';
import type { WorldState, Boat, DigSite } from '@/sim/WorldState';
import { surfaceRock } from '@/sim/systems/carry';

/**
 * Digging: auto-prompt within `DIG.radius` of an undug site; staying in range
 * accrues hold time, and reaching `DIG.timeMs` reveals the site's pre-rolled
 * reward. Leaving range cancels. Pure over `WorldState`.
 *
 * Dig events (`dig:*`) and gem floats are emitted for the LOCAL player only —
 * they drive the HUD ring + counter. Bots still dig (their cash accrues, sites
 * empty, the minimap updates), just without UI noise. The Rock reward is owned
 * by the carry system (M4); here it's a no-op.
 */
export function stepDigging(state: WorldState, dt: number, sink: EventSink): void {
  for (const boat of state.boats) {
    const isLocal = boat.id === state.localId;
    const site = nearestUndugSite(state, boat);

    if (site) {
      if (boat.digSiteId !== site.id) {
        boat.digSiteId = site.id;
        boat.digMs = 0;
        if (isLocal) sink.emit('dig:started', { siteId: site.id });
      }
      boat.digMs += dt * 1000;
      if (boat.digMs >= DIG.timeMs) completeDig(state, boat, site, sink, isLocal);
    } else if (boat.digSiteId !== null) {
      const prev = boat.digSiteId;
      boat.digSiteId = null;
      boat.digMs = 0;
      if (isLocal) sink.emit('dig:cancelled', { siteId: prev });
    }
  }
}

function nearestUndugSite(state: WorldState, boat: Boat): DigSite | null {
  let best: DigSite | null = null;
  let bestD: number = DIG.radius;
  for (const s of state.sites) {
    if (s.dug) continue;
    const d = dist(boat.x, boat.y, s.x, s.y);
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function completeDig(
  state: WorldState,
  boat: Boat,
  site: DigSite,
  sink: EventSink,
  isLocal: boolean,
): void {
  site.dug = true;
  boat.digSiteId = null;
  boat.digMs = 0;
  boat.digs++;
  applyReward(state, boat, site, sink, isLocal);
  if (isLocal) sink.emit('dig:completed', { siteId: site.id, reward: site.reward });
}

function applyReward(
  state: WorldState,
  boat: Boat,
  site: DigSite,
  sink: EventSink,
  isLocal: boolean,
): void {
  const r = site.reward;
  switch (r.kind) {
    case 'gem':
      boat.cash += r.value;
      if (isLocal) sink.emit('gem:collected', { value: r.value, worldX: site.x, worldY: site.y });
      break;
    case 'boost':
      boat.boostCharge = 1; // free refill
      break;
    case 'trap':
      applyTrap(state, boat, site);
      break;
    case 'rock':
      surfaceRock(state, boat, sink); // the digger becomes the carrier
      break;
    case 'none':
      break;
  }
}

/** Trap: knock the digger back and scatter a few loose gems for everyone else. */
function applyTrap(state: WorldState, boat: Boat, site: DigSite): void {
  const rng = new Rng(state.rngState);
  const dir = rng.range(0, TAU);
  boat.knockVx += Math.cos(dir) * TRAP.knockback;
  boat.knockVy += Math.sin(dir) * TRAP.knockback;

  for (let i = 0; i < TRAP.gemsScattered; i++) {
    const a = rng.range(0, TAU);
    state.pickups.push({
      id: `pk-${state.nextPickupId++}`,
      x: site.x,
      y: site.y,
      vx: Math.cos(a) * PICKUP.scatterSpeed,
      vy: Math.sin(a) * PICKUP.scatterSpeed,
      value: TRAP.scatterValue,
    });
  }
  state.rngState = rng.getState();
}
