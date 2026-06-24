import { describe, it, expect } from 'vitest';
import type { EventSink } from '@/core/events';
import type { InputFrame, PlayerId, UpgradeId, ToolId } from '@/core/types';
import { MAX_SPEED_TIER, TOOLS } from '@/config/balance';
import { stepEconomy, nextTierCost, flatCost } from '@/sim/systems/economy';
import { makeBoat, type DigSite } from '@/sim/WorldState';
import { TestSink, makeWorld, DT } from './helpers';

const NEUTRAL: InputFrame = { seq: 0, joystick: { x: 0, y: 0 }, boost: false, dig: false, tool: false };
const buy = (id: UpgradeId): InputFrame => ({ ...NEUTRAL, buyUpgrade: id });
const use = (id: ToolId): InputFrame => ({ ...NEUTRAL, useTool: id });

function econ(state: ReturnType<typeof makeWorld>, sink: EventSink, input: InputFrame = NEUTRAL): void {
  const m = new Map<PlayerId, InputFrame>([['p0', input]]);
  stepEconomy(state, m, DT, sink);
}

describe('cost helpers', () => {
  it('engine tier costs and the max gate', () => {
    expect(nextTierCost(0)).toBe(200);
    expect(nextTierCost(1)).toBe(400);
    expect(nextTierCost(2)).toBe(700);
    expect(nextTierCost(MAX_SPEED_TIER)).toBe(Infinity);
  });
  it('flat tool costs', () => {
    expect(flatCost('net')).toBe(300);
    expect(flatCost('boostRefill')).toBe(150);
  });
});

describe('buying upgrades', () => {
  it('buys an engine tier and deducts cash', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.cash = 1000;
    const state = makeWorld([boat]);
    econ(state, new TestSink(), buy('speed'));
    expect(boat.speedTier).toBe(1);
    expect(boat.cash).toBe(800);
  });

  it('refuses an unaffordable purchase', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.cash = 100;
    const state = makeWorld([boat]);
    econ(state, new TestSink(), buy('speed'));
    expect(boat.speedTier).toBe(0);
    expect(boat.cash).toBe(100);
  });

  it('caps the engine at MAX_SPEED_TIER', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.cash = 100_000;
    const state = makeWorld([boat]);
    for (let i = 0; i < 6; i++) econ(state, new TestSink(), buy('speed'));
    expect(boat.speedTier).toBe(MAX_SPEED_TIER);
    expect(boat.cash).toBe(100_000 - (200 + 400 + 700));
  });

  it('refuels the boost meter', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.cash = 500;
    boat.boostCharge = 0.2;
    const state = makeWorld([boat]);
    econ(state, new TestSink(), buy('boostRefill'));
    expect(boat.boostCharge).toBe(1);
    expect(boat.cash).toBe(350);
  });

  it('buys a consumable tool charge', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.cash = 500;
    const state = makeWorld([boat]);
    econ(state, new TestSink(), buy('net'));
    expect(boat.tools.net.count).toBe(1);
    expect(boat.cash).toBe(200);
  });
});

describe('using tools', () => {
  it('opens a window and spends a charge', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.tools.net.count = 1;
    const state = makeWorld([boat]);
    econ(state, new TestSink(), use('net'));
    expect(boat.tools.net.count).toBe(0);
    expect(boat.tools.net.activeMsLeft).toBe(TOOLS.net.durationMs);
  });

  it('cannot use with no charges', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    const state = makeWorld([boat]);
    econ(state, new TestSink(), use('smoke'));
    expect(boat.tools.smoke.activeMsLeft).toBe(0);
  });

  it('cannot re-trigger while already active', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.tools.net.count = 2;
    const state = makeWorld([boat]);
    econ(state, new TestSink(), use('net'));
    econ(state, new TestSink(), use('net'));
    expect(boat.tools.net.count).toBe(1);
  });

  it('window decays to zero over time', () => {
    const boat = makeBoat('p0', 'You', false, 0, 0, '#fff');
    boat.tools.net.count = 1;
    const state = makeWorld([boat]);
    const sink = new TestSink();
    econ(state, sink, use('net'));
    const steps = Math.ceil(TOOLS.net.durationMs / (DT * 1000)) + 2;
    for (let i = 0; i < steps; i++) econ(state, sink);
    expect(boat.tools.net.activeMsLeft).toBe(0);
  });

  it('sonar pings the nearest site as a toast', () => {
    const boat = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
    boat.tools.radar.count = 1;
    const site: DigSite = { id: 's1', x: 1400, y: 1000, dug: false, reward: { kind: 'none' } };
    const state = makeWorld([boat], { sites: [site] });
    const sink = new TestSink();
    econ(state, sink, use('radar'));
    const toast = sink.events.find((e) => e.name === 'toast');
    expect(toast).toBeTruthy();
    expect(String((toast?.payload as { text: string }).text)).toContain('Sonar');
  });
});
