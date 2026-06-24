import type { EventSink } from '@/core/events';
import { dist, TAU } from '@/core/math';
import { Rng } from '@/core/rng';
import { ROCK, EXTRACT, DOCKS, BOAT, ECONOMY } from '@/config/balance';
import type { WorldState, Boat } from '@/sim/WorldState';
import { buildResults } from '@/sim/results';

/**
 * The hot potato — all Rock rules in one place (find → carry → steal-by-ram →
 * drop → pickup → dock extraction → win). Pure over `WorldState`; the same code
 * runs authoritatively on the server later. Pickups/steals/extraction are NOT
 * predicted in MP — the client reacts to the server's `rock:*` events, which it
 * already does here.
 */
export function stepCarry(state: WorldState, dt: number, sink: EventSink): void {
  if (state.over) return;
  const rock = state.rock;
  for (const b of state.boats) b.carrying = false;
  if (!rock.found) return;

  if (rock.dropLockoutMs > 0) {
    rock.dropLockoutMs = Math.max(0, rock.dropLockoutMs - dt * 1000);
  }

  const carrier = rock.carrierId ? findBoat(state, rock.carrierId) : null;
  if (carrier) {
    carrier.carrying = true;
    rock.x = carrier.x;
    rock.y = carrier.y;
    carrier.carrierMs += dt * 1000;
    handleSteals(state, carrier, sink);
    // If a steal dropped it this step, don't also extract.
    if (rock.carrierId === carrier.id) handleExtract(state, carrier, dt, sink);
  } else {
    handlePickup(state, sink);
  }
}

/** Called by the digging system when a Rock-reward site completes: the digger carries it. */
export function surfaceRock(state: WorldState, digger: Boat, sink: EventSink): void {
  const rock = state.rock;
  rock.found = true;
  rock.siteId = null;
  rock.carrierId = digger.id;
  rock.lastCarrierId = null;
  rock.x = digger.x;
  rock.y = digger.y;
  rock.extractMs = 0;
  digger.carrying = true;
  sink.emit('rock:found', { byId: digger.id, worldX: digger.x, worldY: digger.y });
  sink.emit('toast', { kind: 'epic', text: 'The Rock surfaced!' });
}

function handleSteals(state: WorldState, carrier: Boat, sink: EventSink): void {
  const contact = BOAT.radius * 2 + ROCK.stealContactPad;
  let rammer: Boat | null = null;
  let bestClosing = 0;
  for (const b of state.boats) {
    if (b.id === carrier.id) continue;
    const dx = carrier.x - b.x;
    const dy = carrier.y - b.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    if (d > contact) continue;
    const closing = ((b.vx - carrier.vx) * dx + (b.vy - carrier.vy) * dy) / d; // approach speed
    const threshold = b.tools.net.activeMsLeft > 0 ? ROCK.stealSpeedWithNet : ROCK.stealSpeed;
    if (closing > threshold && closing > bestClosing) {
      bestClosing = closing;
      rammer = b;
    }
  }
  if (rammer) knockLoose(state, carrier, rammer, sink);
}

function knockLoose(state: WorldState, carrier: Boat, rammer: Boat, sink: EventSink): void {
  const rock = state.rock;
  const rng = new Rng(state.rngState);
  const ang = rng.range(0, TAU);
  state.rngState = rng.getState();

  rock.x = carrier.x + Math.cos(ang) * ROCK.dropScatter;
  rock.y = carrier.y + Math.sin(ang) * ROCK.dropScatter;

  const dx = carrier.x - rammer.x;
  const dy = carrier.y - rammer.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  carrier.knockVx += (dx / d) * BOAT.hitKnockback;
  carrier.knockVy += (dy / d) * BOAT.hitKnockback;

  rock.lastCarrierId = carrier.id;
  rock.carrierId = null;
  rock.dropLockoutMs = ROCK.dropLockoutMs;
  rock.extractMs = 0;
  carrier.carrying = false;

  sink.emit('rock:dropped', { worldX: rock.x, worldY: rock.y });
  sink.emit('player:hit', { targetId: carrier.id, byId: rammer.id, reason: 'ram' });
}

function handlePickup(state: WorldState, sink: EventSink): void {
  const rock = state.rock;
  if (rock.dropLockoutMs > 0) return;

  let grabber: Boat | null = null;
  let bestD: number = ROCK.pickupRadius;
  for (const b of state.boats) {
    const d = dist(b.x, b.y, rock.x, rock.y);
    if (d <= bestD) {
      bestD = d;
      grabber = b;
    }
  }
  if (!grabber) return;

  const prev = rock.lastCarrierId;
  rock.carrierId = grabber.id;
  rock.extractMs = 0;
  grabber.carrying = true;

  if (prev !== null && prev !== grabber.id) {
    grabber.steals++;
    sink.emit('rock:stolen', { fromId: prev, toId: grabber.id });
    if (grabber.id === state.localId) sink.emit('toast', { kind: 'good', text: 'You stole the Rock!' });
    else if (prev === state.localId) sink.emit('toast', { kind: 'bad', text: 'Rock stolen from you!' });
  } else {
    sink.emit('rock:picked', { byId: grabber.id });
    if (grabber.id === state.localId) sink.emit('toast', { kind: 'good', text: 'You grabbed the Rock!' });
  }
}

function handleExtract(state: WorldState, carrier: Boat, dt: number, sink: EventSink): void {
  const rock = state.rock;
  const dock = nearestDock(carrier);
  if (dock && dist(carrier.x, carrier.y, dock.x, dock.y) <= EXTRACT.dockRadius) {
    rock.extractMs += dt * 1000;
    if (rock.extractMs >= EXTRACT.holdMs) extract(state, carrier, sink);
  } else {
    rock.extractMs = 0;
  }
}

function extract(state: WorldState, carrier: Boat, sink: EventSink): void {
  carrier.cash += ECONOMY.winBonus;
  state.over = true;
  sink.emit('rock:extracted', { byId: carrier.id });
  sink.emit('round:ended', { winnerId: carrier.id, results: buildResults(state, carrier.id) });
}

function findBoat(state: WorldState, id: string): Boat | null {
  for (const b of state.boats) if (b.id === id) return b;
  return null;
}

function nearestDock(boat: Boat): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const d of DOCKS) {
    const dd = dist(boat.x, boat.y, d.x, d.y);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}
