import { describe, it, expect } from 'vitest';
import type { EventSink } from '@/core/events';
import { DIG, TRAP } from '@/config/balance';
import { GameSim } from '@/sim/GameSim';
import { stepDigging } from '@/sim/systems/digging';
import { stepPickups } from '@/sim/systems/pickups';
import { makeBoat, type DigSite, type WorldState } from '@/sim/WorldState';
import { TestSink, makeWorld, DT } from './helpers';

const STEPS_TO_DIG = Math.ceil(DIG.timeMs / (DT * 1000)) + 1;

function digFor(state: WorldState, sink: EventSink, steps: number): void {
  for (let i = 0; i < steps; i++) stepDigging(state, DT, sink);
}

describe('digging', () => {
  it('completes after DIG.timeMs and banks a gem', () => {
    const boat = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    const site: DigSite = { id: 's1', x: 1000, y: 1000, dug: false, reward: { kind: 'gem', value: 150 } };
    const state = makeWorld([boat], { sites: [site] });
    const sink = new TestSink();

    digFor(state, sink, STEPS_TO_DIG);

    expect(site.dug).toBe(true);
    expect(boat.cash).toBe(150);
    expect(boat.digs).toBe(1);
    expect(sink.names()).toContain('dig:completed');
    expect(sink.names()).toContain('gem:collected');
  });

  it('cancels when the boat leaves range', () => {
    const boat = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    const site: DigSite = { id: 's1', x: 1000, y: 1000, dug: false, reward: { kind: 'gem', value: 80 } };
    const state = makeWorld([boat], { sites: [site] });
    const sink = new TestSink();

    digFor(state, sink, 10);
    expect(boat.digSiteId).toBe('s1');

    boat.x = 1000 + DIG.radius + 50;
    stepDigging(state, DT, sink);

    expect(boat.digSiteId).toBeNull();
    expect(site.dug).toBe(false);
    expect(sink.names()).toContain('dig:cancelled');
  });

  it('never re-digs an emptied site', () => {
    const boat = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    const site: DigSite = { id: 's1', x: 1000, y: 1000, dug: true, reward: { kind: 'gem', value: 80 } };
    const state = makeWorld([boat], { sites: [site] });

    digFor(state, new TestSink(), STEPS_TO_DIG);

    expect(boat.cash).toBe(0);
    expect(boat.digSiteId).toBeNull();
  });

  it('a boost reward refills the meter', () => {
    const boat = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    boat.boostCharge = 0.1;
    const site: DigSite = { id: 's1', x: 1000, y: 1000, dug: false, reward: { kind: 'boost' } };
    const state = makeWorld([boat], { sites: [site] });

    digFor(state, new TestSink(), STEPS_TO_DIG);

    expect(boat.boostCharge).toBe(1);
  });
});

describe('traps + pickups', () => {
  it('a trap knocks the digger back and scatters loose gems', () => {
    const boat = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    const site: DigSite = { id: 's1', x: 1000, y: 1000, dug: false, reward: { kind: 'trap' } };
    const state = makeWorld([boat], { sites: [site] });

    digFor(state, new TestSink(), STEPS_TO_DIG);

    expect(state.pickups).toHaveLength(TRAP.gemsScattered);
    expect(Math.hypot(boat.knockVx, boat.knockVy)).toBeGreaterThan(0);
    expect(boat.cash).toBe(0);
  });

  it('loose gems are collected by a passing boat', () => {
    const boat = makeBoat('p0', 'You', false, 500, 500, '#fff');
    const state = makeWorld([boat]);
    state.pickups.push({ id: 'pk0', x: 500, y: 500, vx: 0, vy: 0, value: 60 });
    const sink = new TestSink();

    stepPickups(state, DT, sink);

    expect(boat.cash).toBe(60);
    expect(state.pickups).toHaveLength(0);
    expect(sink.names()).toContain('gem:collected');
  });
});

describe('loot generation', () => {
  it('site rewards are reproducible and contain exactly one Rock', () => {
    const rewards = (seed: number) => {
      const sim = new GameSim(new TestSink());
      sim.start(seed, { playerCount: 1, botCount: 8, durationMs: 180_000 });
      return sim.getState().sites.map((s) => s.reward);
    };
    const a = rewards(99);
    expect(a).toEqual(rewards(99));
    expect(a.filter((r) => r.kind === 'rock')).toHaveLength(1);
    expect(a.length).toBeGreaterThan(1);
  });
});
