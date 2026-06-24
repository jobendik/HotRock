import { describe, it, expect } from 'vitest';
import type { InputFrame, PlayerId } from '@/core/types';
import { BOAT } from '@/config/balance';
import { GameSim } from '@/sim/GameSim';
import { stepMovement } from '@/sim/systems/movement';
import { makeBoat, type Boat, type WorldState } from '@/sim/WorldState';
import { TestSink, makeWorld, DT } from './helpers';

const CFG = { playerCount: 1, botCount: 8, durationMs: 180_000 };

const input = (x: number, y: number, boost = false): InputFrame => ({
  seq: 0,
  joystick: { x, y },
  boost,
  dig: false,
  tool: false,
});

function drive(state: WorldState, frame: InputFrame, steps: number): Boat {
  const inputs = new Map<PlayerId, InputFrame>([['p0', frame]]);
  for (let i = 0; i < steps; i++) stepMovement(state, inputs, DT);
  return state.boats[0]!;
}

describe('GameSim.start', () => {
  it('emits round:started and builds a world with one boat + islands', () => {
    const sink = new TestSink();
    const sim = new GameSim(sink);
    sim.start(123, CFG);

    const started = sink.events.find((e) => e.name === 'round:started');
    expect(started?.payload).toMatchObject({ seed: 123, playerCount: 1 + CFG.botCount });

    const state = sim.getState();
    expect(state.boats).toHaveLength(1 + CFG.botCount);
    expect(state.boats.filter((b) => b.isBot)).toHaveLength(CFG.botCount);
    expect(state.islands.length).toBeGreaterThan(0);
  });

  it('is deterministic: same seed + inputs ⇒ identical state', () => {
    const run = (seed: number): WorldState => {
      const sim = new GameSim(new TestSink());
      sim.start(seed, CFG);
      const inputs = new Map<PlayerId, InputFrame>([['p0', input(1, 0, true)]]);
      for (let i = 0; i < 200; i++) sim.step(DT * 1000, inputs);
      return sim.getState();
    };
    const a = run(42);
    const b = run(42);
    expect(a.boats[0]!.x).toBe(b.boats[0]!.x);
    expect(a.boats[0]!.y).toBe(b.boats[0]!.y);
    expect(a.islands).toEqual(b.islands);
  });

  it('different seeds produce different archipelagos', () => {
    const islands = (seed: number) => {
      const sim = new GameSim(new TestSink());
      sim.start(seed, CFG);
      return sim.getState().islands;
    };
    expect(islands(1)).not.toEqual(islands(2));
  });
});

describe('movement', () => {
  it('accelerates toward the stick direction', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    const b = drive(state, input(1, 0), 40);
    expect(b.x).toBeGreaterThan(2000);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('brakes to a stop quickly when the stick is released (so you can park to dig)', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    drive(state, input(1, 0), 60);
    const moving = Math.hypot(state.boats[0]!.vx, state.boats[0]!.vy);
    expect(moving).toBeGreaterThan(150);
    // Release for 1.5s — must be essentially stopped, not still sliding away.
    const b = drive(state, input(0, 0), 90);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(10);
  });

  it('still keeps momentum while actively steering (drift, not instant stop)', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    drive(state, input(1, 0), 90); // up to speed heading +x
    // Snap the stick to +y: the boat should curve, retaining some +x momentum.
    const b = drive(state, input(0, 1), 6);
    expect(b.vx).toBeGreaterThan(40); // hasn't instantly killed the old heading
  });

  it('clamps to max speed without boost', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    const b = drive(state, input(1, 0), 600);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(BOAT.maxSpeed + 1e-6);
  });

  it('never penetrates an island', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 1700, 1500, '#fff')]);
    state.islands.push({ x: 2000, y: 1500, radius: 120 });
    const b = drive(state, input(1, 0, true), 300);
    const d = Math.hypot(b.x - 2000, b.y - 1500);
    expect(d).toBeGreaterThanOrEqual(120 + BOAT.radius - 0.5);
  });

  it('keeps the boat inside the world via soft walls', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 200, 200, '#fff')]);
    const b = drive(state, input(-1, -1, true), 600);
    expect(b.x).toBeGreaterThanOrEqual(BOAT.radius - 1e-6);
    expect(b.y).toBeGreaterThanOrEqual(BOAT.radius - 1e-6);
    expect(b.x).toBeLessThanOrEqual(4000 - BOAT.radius + 1e-6);
  });

  it('the Rock carrier is slightly slower (carry tax)', () => {
    const free = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    const held = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    held.boats[0]!.carrying = true;
    const a = drive(free, input(1, 0), 600);
    const b = drive(held, input(1, 0), 600);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(Math.hypot(a.vx, a.vy));
  });
});

describe('boost', () => {
  it('fires when charged, then exceeds base max speed', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    const first = drive(state, input(1, 0, true), 1);
    expect(first.boosting).toBe(true);
    expect(first.boostCharge).toBe(0);

    const b = drive(state, input(1, 0, true), 60);
    expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(BOAT.maxSpeed);
  });

  it('cannot fire on an empty meter', () => {
    const state = makeWorld([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    state.boats[0]!.boostCharge = 0.3;
    const b = drive(state, input(0, 0, true), 1);
    expect(b.boosting).toBe(false);
  });
});
