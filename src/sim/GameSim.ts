import type { EventSink } from '@/core/events';
import type { InputFrame, PlayerId, RoundConfig } from '@/core/types';
import { Rng } from '@/core/rng';
import { WORLD } from '@/config/balance';
import { type WorldState, type Boat, makeBoat, PLAYER_COLORS } from '@/sim/WorldState';
import { generateIslands } from '@/sim/worldgen';
import { stepMovement } from '@/sim/systems/movement';

const LOCAL_ID: PlayerId = 'p0';

/**
 * The authoritative simulation. Transport-agnostic (no Phaser, no DOM): it owns
 * the `WorldState`, advances it on a fixed timestep, and announces domain events
 * through the injected {@link EventSink}. The identical class runs on the server
 * in multiplayer (docs/NETCODE.md) — write the rules once, run them in two places.
 */
export class GameSim {
  private state: WorldState;

  constructor(private readonly sink: EventSink) {
    this.state = GameSim.empty();
  }

  /** Build a fresh round from `seed` and announce it. */
  start(seed: number, config: RoundConfig): void {
    const rng = new Rng(seed);
    const spawnX = WORLD.width / 2;
    const spawnY = WORLD.height / 2;
    const islands = generateIslands(rng, spawnX, spawnY);
    const player: Boat = makeBoat(LOCAL_ID, 'You', false, spawnX, spawnY, PLAYER_COLORS[0]);

    this.state = {
      seed,
      rngState: rng.getState(),
      width: WORLD.width,
      height: WORLD.height,
      timeMs: 0,
      localId: LOCAL_ID,
      boats: [player],
      islands,
    };

    this.sink.emit('round:started', {
      durationMs: config.durationMs,
      seed,
      playerCount: config.playerCount,
    });
  }

  /** Advance the world by a fixed `dtMs` using the per-player inputs for this tick. */
  step(dtMs: number, inputs: Map<PlayerId, InputFrame>): void {
    const dt = dtMs / 1000;
    this.state.timeMs += dtMs;
    stepMovement(this.state, inputs, dt);
  }

  getState(): WorldState {
    return this.state;
  }

  private static empty(): WorldState {
    return {
      seed: 0,
      rngState: 1,
      width: WORLD.width,
      height: WORLD.height,
      timeMs: 0,
      localId: LOCAL_ID,
      boats: [],
      islands: [],
    };
  }
}
