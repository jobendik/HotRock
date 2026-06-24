import { describe, it, expect } from 'vitest';
import { ROCK, EXTRACT, ECONOMY, DOCKS, BOAT } from '@/config/balance';
import { stepCarry, surfaceRock } from '@/sim/systems/carry';
import { makeBoat, type Boat, type Rock, type WorldState } from '@/sim/WorldState';
import { TestSink, makeWorld, DT } from './helpers';

const DOCK = DOCKS[0]!;

const world = (boats: Boat[], rock: Partial<Rock> = {}): WorldState => makeWorld(boats, { rock });

describe('surfacing', () => {
  it('the digger becomes the carrier and the map is alerted', () => {
    const digger = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    const state = world([digger]);
    const sink = new TestSink();

    surfaceRock(state, digger, sink);

    expect(state.rock.found).toBe(true);
    expect(state.rock.carrierId).toBe('p0');
    expect(sink.names()).toContain('rock:found');
  });
});

describe('extraction', () => {
  it('holding at a dock for EXTRACT.holdMs wins the round', () => {
    const carrier = makeBoat('p0', 'You', false, DOCK.x, DOCK.y, '#fff');
    const state = world([carrier], { found: true, carrierId: 'p0', x: DOCK.x, y: DOCK.y });
    const sink = new TestSink();

    const steps = Math.ceil(EXTRACT.holdMs / (DT * 1000)) + 1;
    for (let i = 0; i < steps && !state.over; i++) stepCarry(state, DT, sink);

    expect(state.over).toBe(true);
    expect(carrier.cash).toBe(ECONOMY.winBonus);
    expect(sink.names()).toContain('rock:extracted');
    expect(sink.names()).toContain('round:ended');
  });

  it('leaving the dock resets the extract timer', () => {
    const carrier = makeBoat('p0', 'You', false, DOCK.x, DOCK.y, '#fff');
    const state = world([carrier], { found: true, carrierId: 'p0', x: DOCK.x, y: DOCK.y });
    const sink = new TestSink();

    stepCarry(state, DT, sink);
    expect(state.rock.extractMs).toBeGreaterThan(0);

    carrier.x = DOCK.x + EXTRACT.dockRadius + 100; // drive off
    stepCarry(state, DT, sink);
    expect(state.rock.extractMs).toBe(0);
  });
});

describe('steal by ram', () => {
  function rammerSetup(rammerVx: number): { state: WorldState; sink: TestSink; carrier: Boat; rammer: Boat } {
    const carrier = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    const rammer = makeBoat('p1', 'Bot', true, 1000 - (BOAT.radius * 2 + 4), 1000, '#0f0');
    rammer.vx = rammerVx;
    const state = world([carrier, rammer], { found: true, carrierId: 'p0', x: 1000, y: 1000 });
    return { state, sink: new TestSink(), carrier, rammer };
  }

  it('a fast ram knocks the Rock loose', () => {
    const { state, sink, carrier } = rammerSetup(ROCK.stealSpeed + 120);
    stepCarry(state, DT, sink);

    expect(state.rock.carrierId).toBeNull();
    expect(state.rock.lastCarrierId).toBe('p0');
    expect(state.rock.dropLockoutMs).toBeGreaterThan(0);
    expect(Math.hypot(carrier.knockVx, carrier.knockVy)).toBeGreaterThan(0);
    expect(sink.names()).toContain('player:hit');
  });

  it('a gentle bump does not steal', () => {
    const { state, sink } = rammerSetup(30);
    stepCarry(state, DT, sink);
    expect(state.rock.carrierId).toBe('p0');
  });

  it('the drop lockout blocks an instant re-grab, then the rammer takes it', () => {
    const { state, sink, rammer } = rammerSetup(ROCK.stealSpeed + 120);
    stepCarry(state, DT, sink); // knock loose

    // Park the rammer right on the loose Rock.
    rammer.vx = 0;
    rammer.x = state.rock.x;
    rammer.y = state.rock.y;

    stepCarry(state, DT, sink); // still within lockout → no pickup
    expect(state.rock.carrierId).toBeNull();

    const steps = Math.ceil(ROCK.dropLockoutMs / (DT * 1000)) + 2;
    for (let i = 0; i < steps; i++) stepCarry(state, DT, sink);

    expect(state.rock.carrierId).toBe('p1');
    expect(rammer.steals).toBe(1);
    expect(sink.names()).toContain('rock:stolen');
  });
});

describe('pickup', () => {
  it('a fresh surface (no prior carrier) reads as picked, not stolen', () => {
    const finder = makeBoat('p0', 'You', false, 500, 500, '#fff');
    const state = world([finder], {
      found: true,
      carrierId: null,
      lastCarrierId: null,
      x: 500,
      y: 500,
    });
    const sink = new TestSink();
    stepCarry(state, DT, sink);
    expect(state.rock.carrierId).toBe('p0');
    expect(sink.names()).toContain('rock:picked');
    expect(sink.names()).not.toContain('rock:stolen');
  });
});
