import { describe, it, expect } from 'vitest';
import { ROUND } from '@/config/balance';
import { heatAt, stepRound } from '@/sim/systems/round';
import { makeBoat, type DigSite } from '@/sim/WorldState';
import { TestSink, makeWorld, DT } from './helpers';

describe('heat schedule', () => {
  it('interpolates the keyframes', () => {
    expect(heatAt(0)).toBe(0);
    expect(heatAt(60_000)).toBeCloseTo(0.25, 5);
    expect(heatAt(90_000)).toBeCloseTo(0.425, 3); // midway 0.25 → 0.6
    expect(heatAt(180_000)).toBe(1);
    expect(heatAt(999_999)).toBe(1);
  });
});

describe('stepRound', () => {
  it('updates heat and hints the Rock once past the hint time', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 0, 0, '#fff')], {
      timeMs: ROUND.hintsStartMs,
    });
    stepRound(state, DT, new TestSink());
    expect(state.rockHinted).toBe(true);
    expect(state.heat).toBeGreaterThan(0);
  });

  it('auto-surfaces the Rock (loose) if undug by the deadline', () => {
    const site: DigSite = { id: 's1', x: 1200, y: 800, dug: false, reward: { kind: 'rock' } };
    const state = makeWorld([makeBoat('p0', 'You', false, 0, 0, '#fff')], {
      sites: [site],
      timeMs: ROUND.autoSurfaceAtMs,
      rock: { found: false, x: 1200, y: 800, siteId: 's1' },
    });
    const sink = new TestSink();
    stepRound(state, DT, sink);
    expect(state.rock.found).toBe(true);
    expect(state.rock.carrierId).toBeNull();
    expect(site.dug).toBe(true);
    expect(sink.names()).toContain('rock:found');
  });

  it('ends at the time limit with the richest smuggler when no one carries', () => {
    const a = makeBoat('p0', 'You', false, 0, 0, '#fff');
    a.cash = 300;
    const b = makeBoat('bot0', 'B', true, 100, 0, '#0f0');
    b.cash = 900;
    const state = makeWorld([a, b], { timeMs: ROUND.durationMs });
    const sink = new TestSink();
    stepRound(state, DT, sink);
    expect(state.over).toBe(true);
    const ended = sink.events.find((e) => e.name === 'round:ended');
    expect((ended?.payload as { winnerId: string }).winnerId).toBe('bot0');
  });

  it('the carrier wins on the buzzer', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 0, 0, '#fff')], {
      timeMs: ROUND.durationMs,
      rock: { found: true, carrierId: 'p0' },
    });
    const sink = new TestSink();
    stepRound(state, DT, sink);
    const ended = sink.events.find((e) => e.name === 'round:ended');
    expect((ended?.payload as { winnerId: string }).winnerId).toBe('p0');
  });

  it('reveal pulses fire on a throttle, not every step', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 0, 0, '#fff')], {
      timeMs: ROUND.revealPulseAfterMs,
    });
    const sink = new TestSink();
    stepRound(state, DT, sink);
    stepRound(state, DT, sink); // same time → throttled
    expect(sink.names().filter((n) => n === 'toast')).toHaveLength(1);
  });
});
