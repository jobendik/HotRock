import { describe, it, expect } from 'vitest';
import { Rng } from '@/core/rng';
import { decide } from '@/sim/BotAI';
import { makeBoat, type DigSite } from '@/sim/WorldState';
import { makeWorld } from './helpers';

/** Average a bot's joystick over many decisions to see its intent past the jitter. */
function meanJoystick(
  build: () => ReturnType<typeof makeWorld>,
  botIndex = 0,
  n = 200,
): { x: number; y: number } {
  const rng = new Rng(7);
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const state = build();
    const j = decide(state, state.boats[botIndex]!, rng).joystick;
    sx += j.x;
    sy += j.y;
  }
  return { x: sx / n, y: sy / n };
}

describe('BotAI', () => {
  it('PROSPECT: heads toward the nearest undug site', () => {
    const site: DigSite = { id: 's1', x: 3000, y: 1000, dug: false, reward: { kind: 'none' } };
    const dir = meanJoystick(() => {
      const bot = makeBoat('bot0', 'B', true, 1000, 1000, '#0f0');
      return makeWorld([bot], { sites: [site] });
    });
    expect(dir.x).toBeGreaterThan(0.5); // east, toward the site
  });

  it('CARRY_RUN: as carrier, runs toward the safest (least-defended) dock', () => {
    const dir = meanJoystick(() => {
      const bot = makeBoat('bot0', 'B', true, 2400, 1900, '#0f0');
      // Enemies camp the top-left and top-right docks → bottom-right (3700,2700) is safest.
      const e1 = makeBoat('e1', 'E', true, 400, 400, '#f00');
      const e2 = makeBoat('e2', 'E', true, 3600, 400, '#f00');
      return makeWorld([bot, e1, e2], { rock: { found: true, carrierId: 'bot0', x: 2400, y: 1900 } });
    });
    expect(dir.x).toBeGreaterThan(0.2); // toward the bottom-right dock
    expect(dir.y).toBeGreaterThan(0.2);
  });

  it('STEAL: closes on the carrier when in range', () => {
    const dir = meanJoystick(() => {
      const carrier = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
      const bot = makeBoat('bot0', 'B', true, 1140, 1000, '#0f0'); // ~140px east of carrier
      return makeWorld([carrier, bot], { rock: { found: true, carrierId: 'p0', x: 1000, y: 1000 } });
    }, 1);
    expect(dir.x).toBeLessThan(0); // steer west, into the carrier
  });

  it('INTERCEPT: leads a distant moving carrier', () => {
    const dir = meanJoystick(() => {
      const carrier = makeBoat('p0', 'You', false, 1000, 1000, '#fff');
      carrier.vx = 120;
      const bot = makeBoat('bot0', 'B', true, 1000, 1700, '#0f0'); // 700px south, beyond steal range
      return makeWorld([carrier, bot], { rock: { found: true, carrierId: 'p0', x: 1000, y: 1000 } });
    }, 1);
    expect(dir.y).toBeLessThan(0); // mostly north, toward the carrier's lane
  });

  it('buys an engine tier while prospecting if it can afford one', () => {
    const bot = makeBoat('bot0', 'B', true, 1000, 1000, '#0f0');
    bot.cash = 500;
    const site: DigSite = { id: 's1', x: 1400, y: 1000, dug: false, reward: { kind: 'none' } };
    const state = makeWorld([bot], { sites: [site] });
    expect(decide(state, bot, new Rng(1)).buyUpgrade).toBe('speed');
  });

  it('is deterministic for a given RNG stream', () => {
    const bot = makeBoat('bot0', 'B', true, 1000, 1000, '#0f0');
    const site: DigSite = { id: 's1', x: 1400, y: 1000, dug: false, reward: { kind: 'none' } };
    const state = makeWorld([bot], { sites: [site] });
    const a = decide(state, bot, new Rng(5));
    const b = decide(state, bot, new Rng(5));
    expect(a.joystick).toEqual(b.joystick);
  });
});
