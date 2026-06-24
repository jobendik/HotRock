import type { EventSink } from '@/core/events';
import type { PlayerId } from '@/core/types';
import { ROUND } from '@/config/balance';
import type { WorldState, Boat } from '@/sim/WorldState';
import { autoSurfaceRock } from '@/sim/systems/carry';
import { buildResults } from '@/sim/results';

/**
 * Round flow & heat — the guarantee that every round resolves. Interpolates the
 * heat curve, hints then pulses the Rock's location, auto-surfaces it late if
 * still undug, and ends the round on the time limit (winner = current carrier,
 * else most cash). Extraction ends it earlier from the carry system.
 */
export function stepRound(state: WorldState, _dt: number, sink: EventSink): void {
  if (state.over) return;

  state.heat = heatAt(state.timeMs);
  state.rockHinted = state.timeMs >= ROUND.hintsStartMs;

  if (!state.rock.found && state.timeMs >= ROUND.autoSurfaceAtMs) {
    autoSurfaceRock(state, sink);
  }
  maybePulse(state, sink);

  if (state.timeMs >= ROUND.durationMs) endByTimeout(state, sink);
}

/** Linear interpolation of the heat keyframes [atMs, heat]. */
export function heatAt(timeMs: number): number {
  const kf = ROUND.heatKeyframes;
  if (timeMs <= kf[0]![0]) return kf[0]![1];
  for (let i = 1; i < kf.length; i++) {
    const a = kf[i - 1]!;
    const b = kf[i]!;
    if (timeMs <= b[0]) {
      const t = (timeMs - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return kf[kf.length - 1]![1];
}

/** Periodic "the Rock pulses" reveal once past the threshold and still loose/unfound. */
function maybePulse(state: WorldState, sink: EventSink): void {
  if (state.timeMs < ROUND.revealPulseAfterMs) return;
  if (state.rock.carrierId !== null) return; // a carrier already broadcasts their position
  if (state.timeMs - state.lastRevealPulseMs < ROUND.revealPulseEveryMs) return;
  state.lastRevealPulseMs = state.timeMs;
  sink.emit('toast', { kind: 'epic', text: 'The Rock pulses!' });
}

function endByTimeout(state: WorldState, sink: EventSink): void {
  const winner = winnerAtTimeout(state);
  state.over = true;
  sink.emit('round:ended', { winnerId: winner, results: buildResults(state, winner) });
}

/** Carrier wins on the buzzer; otherwise the richest smuggler. */
function winnerAtTimeout(state: WorldState): PlayerId | null {
  if (state.rock.carrierId) return state.rock.carrierId;
  let best: Boat | null = null;
  for (const b of state.boats) {
    if (!best || b.cash > best.cash) best = b;
  }
  return best ? best.id : null;
}
