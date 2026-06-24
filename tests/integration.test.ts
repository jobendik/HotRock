import { describe, it, expect } from 'vitest';
import type { InputFrame, PlayerId } from '@/core/types';
import { ROUND } from '@/config/balance';
import { Rng } from '@/core/rng';
import { GameSim } from '@/sim/GameSim';
import { decide } from '@/sim/BotAI';
import { TestSink, DT } from './helpers';

const NEUTRAL: InputFrame = { seq: 0, joystick: { x: 0, y: 0 }, boost: false, dig: false, tool: false };

/**
 * End-to-end: drive a whole round with the human idle and 8 bots playing via the
 * same BotAI the client uses. Proves the full loop resolves — the Rock always
 * surfaces (auto-surface backstop) and the round always ends.
 */
describe('full round vs bots', () => {
  it('always surfaces the Rock and resolves the round', () => {
    const sink = new TestSink();
    const sim = new GameSim(sink);
    sim.start(2024, { playerCount: 1, botCount: 8, durationMs: ROUND.durationMs });

    const botRng = new Rng(2024);
    const inputs = new Map<PlayerId, InputFrame>();
    const maxSteps = Math.ceil(ROUND.durationMs / (DT * 1000)) + 30;

    let steps = 0;
    for (; steps < maxSteps && !sim.getState().over; steps++) {
      const state = sim.getState();
      inputs.set(state.localId, NEUTRAL);
      for (const b of state.boats) if (b.isBot) inputs.set(b.id, decide(state, b, botRng));
      sim.step(DT * 1000, inputs);
    }

    const state = sim.getState();
    expect(state.over).toBe(true);
    expect(sink.names()).toContain('rock:found');
    expect(sink.names()).toContain('round:ended');
    expect(steps).toBeLessThan(maxSteps); // ended on its own, not by the safety cap
  });

  it('a healthy share of rounds end by delivery (balance guard — was 0%)', () => {
    const N = 16;
    let extracted = 0;
    for (let s = 0; s < N; s++) {
      const sink = new TestSink();
      const sim = new GameSim(sink);
      sim.start(1000 + s, { playerCount: 1, botCount: 8, durationMs: ROUND.durationMs });
      const botRng = new Rng(1000 + s);
      const inputs = new Map<PlayerId, InputFrame>();
      const maxSteps = Math.ceil(ROUND.durationMs / (DT * 1000)) + 30;
      for (let i = 0; i < maxSteps && !sim.getState().over; i++) {
        const state = sim.getState();
        for (const b of state.boats) inputs.set(b.id, decide(state, b, botRng)); // all skilled
        sim.step(DT * 1000, inputs);
      }
      if (sink.names().includes('rock:extracted')) extracted++;
    }
    // Carriers must be able to reach a dock and win; this was 0% before tuning.
    expect(extracted / N).toBeGreaterThan(0.5);
  });

  it('is reproducible from the seed', () => {
    const play = (seed: number): number => {
      const sim = new GameSim(new TestSink());
      sim.start(seed, { playerCount: 1, botCount: 8, durationMs: ROUND.durationMs });
      const botRng = new Rng(seed);
      const inputs = new Map<PlayerId, InputFrame>();
      const maxSteps = Math.ceil(ROUND.durationMs / (DT * 1000)) + 30;
      let steps = 0;
      for (; steps < maxSteps && !sim.getState().over; steps++) {
        const state = sim.getState();
        inputs.set(state.localId, NEUTRAL);
        for (const b of state.boats) if (b.isBot) inputs.set(b.id, decide(state, b, botRng));
        sim.step(DT * 1000, inputs);
      }
      return steps;
    };
    expect(play(77)).toBe(play(77));
  });
});
