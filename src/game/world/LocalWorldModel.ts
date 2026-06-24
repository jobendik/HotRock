import type { EventSink } from '@/core/events';
import type { InputFrame, PlayerId, RoundConfig } from '@/core/types';
import { Rng } from '@/core/rng';
import { GameSim } from '@/sim/GameSim';
import { decide } from '@/sim/BotAI';
import type { WorldModel, WorldView } from '@/game/world/WorldModel';

/**
 * Authoritative-in-the-browser model: wraps the pure `GameSim` and drives the
 * bots with the same server-style `BotAI`. The simulation only ever advances
 * given a full input map (human + bots), exactly as the server will — so the
 * same `GameSim`/`BotAI` run in both places. A `NetworkedWorldModel` later
 * replaces this class behind the same interface.
 */
export class LocalWorldModel implements WorldModel {
  private readonly sim: GameSim;
  /** Reused per tick so `update()` allocates only the per-bot input frames. */
  private readonly inputs = new Map<PlayerId, InputFrame>();
  /** Dedicated deterministic stream for bot decisions (kept off the sim RNG). */
  private botRng = new Rng(1);

  constructor(sink: EventSink) {
    this.sim = new GameSim(sink);
  }

  start(seed: number, config: RoundConfig): void {
    this.sim.start(seed, config);
    this.botRng = new Rng((seed ^ 0x5bd1e995) >>> 0);
  }

  update(dtMs: number, localInput: InputFrame): void {
    const state = this.sim.getState();
    this.inputs.set(state.localId, localInput);
    for (const boat of state.boats) {
      if (boat.isBot) this.inputs.set(boat.id, decide(state, boat, this.botRng));
    }
    this.sim.step(dtMs, this.inputs);
  }

  getView(): WorldView {
    return this.sim.getState();
  }

  stop(): void {
    this.inputs.clear();
  }
}
