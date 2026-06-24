import type { EventSink, Events } from '@/core/events';
import type { Boat, Rock, WorldState } from '@/sim/WorldState';

/** Fixed step in seconds — matches the sim clock. */
export const DT = 1 / 60;

/** Capturing event sink — pure, no bus/DOM; satisfies the typed EventSink. */
export class TestSink implements EventSink {
  readonly events: Array<{ name: keyof Events; payload?: unknown }> = [];
  emit(event: keyof Events, payload?: unknown): void {
    this.events.push({ name: event, payload });
  }
  /** Convenience: just the emitted event names. */
  names(): string[] {
    return this.events.map((e) => e.name);
  }
}

type WorldPatch = Partial<Omit<WorldState, 'rock'>> & { rock?: Partial<Rock> };

/** Build a minimal WorldState for system tests. `patch.rock` is merged onto defaults. */
export function makeWorld(boats: Boat[], patch: WorldPatch = {}): WorldState {
  const { rock: rockPatch, ...rest } = patch;
  const state: WorldState = {
    seed: 1,
    rngState: 1,
    width: 4000,
    height: 3000,
    timeMs: 0,
    localId: 'p0',
    boats,
    islands: [],
    sites: [],
    pickups: [],
    nextPickupId: 0,
    rock: {
      found: false,
      x: 0,
      y: 0,
      carrierId: null,
      lastCarrierId: null,
      dropLockoutMs: 0,
      extractMs: 0,
      siteId: null,
    },
    heat: 0,
    rockHinted: false,
    lastRevealPulseMs: 0,
    over: false,
    ...rest,
  };
  if (rockPatch) Object.assign(state.rock, rockPatch);
  return state;
}
