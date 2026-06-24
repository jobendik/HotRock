import type { EventSink } from '@/core/events';
import type { InputFrame, PlayerId, RoundConfig } from '@/core/types';
import { GameSim } from '@/sim/GameSim';
import type { WorldModel, WorldView } from '@/game/world/WorldModel';

/**
 * Authoritative-in-the-browser model: wraps the pure `GameSim` (and, from M5,
 * server-style `BotAI`). The same `GameSim` runs on the server in multiplayer,
 * where a `NetworkedWorldModel` replaces this class behind the same interface.
 */
export class LocalWorldModel implements WorldModel {
  private readonly sim: GameSim;
  /** Reused per tick so `update()` allocates nothing in the hot path. */
  private readonly inputs = new Map<PlayerId, InputFrame>();

  constructor(sink: EventSink) {
    this.sim = new GameSim(sink);
  }

  start(seed: number, config: RoundConfig): void {
    this.sim.start(seed, config);
  }

  update(dtMs: number, localInput: InputFrame): void {
    this.inputs.set(this.sim.getState().localId, localInput);
    // Bot inputs are added to this same map in M5.
    this.sim.step(dtMs, this.inputs);
  }

  getView(): WorldView {
    return this.sim.getState();
  }

  stop(): void {
    this.inputs.clear();
  }
}
