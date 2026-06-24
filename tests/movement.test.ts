import { describe, it, expect } from 'vitest';
import type { EventSink, Events } from '@/core/events';
import type { InputFrame, PlayerId } from '@/core/types';
import { BOAT } from '@/config/balance';
import { GameSim } from '@/sim/GameSim';
import { stepMovement } from '@/sim/systems/movement';
import { makeBoat, type Boat, type WorldState } from '@/sim/WorldState';

/** Capturing event sink — pure, no bus/DOM, satisfies the typed EventSink. */
class TestSink implements EventSink {
  readonly events: Array<{ name: keyof Events; payload?: unknown }> = [];
  emit(event: keyof Events, payload?: unknown): void {
    this.events.push({ name: event, payload });
  }
}

const DT = 1000 / 60;
const CFG = { playerCount: 1, botCount: 8, durationMs: 180_000 };

const input = (x: number, y: number, boost = false): InputFrame => ({
  seq: 0,
  joystick: { x, y },
  boost,
  dig: false,
  tool: false,
});

function worldWith(boats: Boat[]): WorldState {
  return {
    seed: 1,
    rngState: 1,
    width: 4000,
    height: 3000,
    timeMs: 0,
    localId: 'p0',
    boats,
    islands: [],
  };
}

function drive(state: WorldState, frame: InputFrame, steps: number): Boat {
  const inputs = new Map<PlayerId, InputFrame>([['p0', frame]]);
  for (let i = 0; i < steps; i++) stepMovement(state, inputs, DT / 1000);
  return state.boats[0]!;
}

describe('GameSim.start', () => {
  it('emits round:started and builds a world with one boat + islands', () => {
    const sink = new TestSink();
    const sim = new GameSim(sink);
    sim.start(123, CFG);

    const started = sink.events.find((e) => e.name === 'round:started');
    expect(started?.payload).toMatchObject({ seed: 123, playerCount: 1 });

    const state = sim.getState();
    expect(state.boats).toHaveLength(1);
    expect(state.islands.length).toBeGreaterThan(0);
  });

  it('is deterministic: same seed + inputs ⇒ identical state', () => {
    const run = (seed: number): WorldState => {
      const sim = new GameSim(new TestSink());
      sim.start(seed, CFG);
      const inputs = new Map<PlayerId, InputFrame>([['p0', input(1, 0, true)]]);
      for (let i = 0; i < 200; i++) sim.step(DT, inputs);
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
    const state = worldWith([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    const b = drive(state, input(1, 0), 40);
    expect(b.x).toBeGreaterThan(2000);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('coasts down with momentum when the stick is released (drift)', () => {
    const state = worldWith([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    drive(state, input(1, 0), 60);
    const moving = Math.hypot(state.boats[0]!.vx, state.boats[0]!.vy);
    expect(moving).toBeGreaterThan(0);
    // Floaty drag (0.9/s) bleeds speed gradually — clearly slower after 10s of coasting.
    const b = drive(state, input(0, 0), 600);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(moving * 0.5);
  });

  it('clamps to max speed without boost', () => {
    const state = worldWith([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    const b = drive(state, input(1, 0), 600);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(BOAT.maxSpeed + 1e-6);
  });

  it('never penetrates an island', () => {
    const state = worldWith([makeBoat('p0', 'You', false, 1700, 1500, '#fff')]);
    state.islands.push({ x: 2000, y: 1500, radius: 120 });
    const b = drive(state, input(1, 0, true), 300);
    const d = Math.hypot(b.x - 2000, b.y - 1500);
    expect(d).toBeGreaterThanOrEqual(120 + BOAT.radius - 0.5);
  });

  it('keeps the boat inside the world via soft walls', () => {
    const state = worldWith([makeBoat('p0', 'You', false, 200, 200, '#fff')]);
    const b = drive(state, input(-1, -1, true), 600);
    expect(b.x).toBeGreaterThanOrEqual(BOAT.radius - 1e-6);
    expect(b.y).toBeGreaterThanOrEqual(BOAT.radius - 1e-6);
    expect(b.x).toBeLessThanOrEqual(4000 - BOAT.radius + 1e-6);
  });
});

describe('boost', () => {
  it('fires when charged, then exceeds base max speed', () => {
    const state = worldWith([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    const first = drive(state, input(1, 0, true), 1);
    expect(first.boosting).toBe(true);
    expect(first.boostCharge).toBe(0);

    const b = drive(state, input(1, 0, true), 60);
    expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(BOAT.maxSpeed);
  });

  it('cannot fire on an empty meter', () => {
    const state = worldWith([makeBoat('p0', 'You', false, 2000, 1500, '#fff')]);
    state.boats[0]!.boostCharge = 0.3;
    const b = drive(state, input(0, 0, true), 1);
    expect(b.boosting).toBe(false);
  });
});
