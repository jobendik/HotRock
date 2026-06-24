import type { EventSink } from '@/core/events';
import type { InputFrame, PlayerId, RoundConfig } from '@/core/types';
import { Rng } from '@/core/rng';
import { WORLD } from '@/config/balance';
import { type WorldState, type Boat, makeBoat, PLAYER_COLORS, BOT_NAMES, botColor } from '@/sim/WorldState';
import { generateIslands, generateSites, botSpawns } from '@/sim/worldgen';
import { stepEconomy } from '@/sim/systems/economy';
import { stepMovement } from '@/sim/systems/movement';
import { stepDigging } from '@/sim/systems/digging';
import { stepPickups } from '@/sim/systems/pickups';
import { stepCarry } from '@/sim/systems/carry';
import { stepRound } from '@/sim/systems/round';

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
    const sites = generateSites(rng, islands, spawnX, spawnY);

    // Bury the Rock at exactly one random site (never via the loot table).
    const rockSite = sites.length > 0 ? (sites[rng.int(sites.length)] ?? null) : null;
    if (rockSite) rockSite.reward = { kind: 'rock' };

    const boats: Boat[] = [makeBoat(LOCAL_ID, 'You', false, spawnX, spawnY, PLAYER_COLORS[0])];
    const spawns = botSpawns(rng, config.botCount, islands, { x: spawnX, y: spawnY });
    for (let i = 0; i < config.botCount; i++) {
      const s = spawns[i] ?? { x: spawnX, y: spawnY };
      const name = BOT_NAMES[i % BOT_NAMES.length] ?? `Bot ${i + 1}`;
      boats.push(makeBoat(`bot${i}`, name, true, s.x, s.y, botColor(i)));
    }

    this.state = {
      seed,
      rngState: rng.getState(),
      width: WORLD.width,
      height: WORLD.height,
      timeMs: 0,
      localId: LOCAL_ID,
      boats,
      islands,
      sites,
      pickups: [],
      nextPickupId: 0,
      rock: {
        found: false,
        x: rockSite?.x ?? 0,
        y: rockSite?.y ?? 0,
        carrierId: null,
        lastCarrierId: null,
        dropLockoutMs: 0,
        graceMsLeft: 0,
        extractMs: 0,
        siteId: rockSite?.id ?? null,
      },
      heat: 0,
      rockHinted: false,
      lastRevealPulseMs: 0,
      over: false,
    };

    this.sink.emit('round:started', {
      durationMs: config.durationMs,
      seed,
      playerCount: boats.length,
    });
  }

  /** Advance the world by a fixed `dtMs` using the per-player inputs for this tick. */
  step(dtMs: number, inputs: Map<PlayerId, InputFrame>): void {
    if (this.state.over) return; // round decided; idle until the next start()
    const dt = dtMs / 1000;
    this.state.timeMs += dtMs;
    stepRound(this.state, dt, this.sink); // heat, hints/pulses, auto-surface, timeout
    if (this.state.over) return;
    stepEconomy(this.state, inputs, dt, this.sink);
    stepMovement(this.state, inputs, dt);
    stepDigging(this.state, dt, this.sink);
    stepPickups(this.state, dt, this.sink);
    stepCarry(this.state, dt, this.sink);
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
        graceMsLeft: 0,
        extractMs: 0,
        siteId: null,
      },
      heat: 0,
      rockHinted: false,
      lastRevealPulseMs: 0,
      over: false,
    };
  }
}
