import type { PlayerId, PlayerResult } from '@/core/types';
import type { WorldState } from '@/sim/WorldState';

/** Build the end-of-round scoreboard from the final world state. */
export function buildResults(state: WorldState, winnerId: PlayerId | null): PlayerResult[] {
  return state.boats.map((b) => ({
    id: b.id,
    name: b.name,
    isBot: b.isBot,
    cash: b.cash,
    digs: b.digs,
    steals: b.steals,
    carrierMs: b.carrierMs,
    extracted: b.id === winnerId,
  }));
}
