import type { EventSink } from '@/core/events';
import { dist } from '@/core/math';
import { PICKUP } from '@/config/balance';
import type { WorldState } from '@/sim/WorldState';

/**
 * Loose gems (scattered by traps now; by Rock drops in M4). They drift out,
 * settle via friction, and are auto-collected by any boat that drives over them.
 * `gem:collected` is emitted only when the LOCAL player grabs one (HUD float).
 */
export function stepPickups(state: WorldState, dt: number, sink: EventSink): void {
  const friction = Math.pow(PICKUP.friction, dt);
  for (const p of state.pickups) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= friction;
    p.vy *= friction;
  }

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const p = state.pickups[i]!;
    for (const boat of state.boats) {
      if (dist(p.x, p.y, boat.x, boat.y) <= PICKUP.gemRadius) {
        boat.cash += p.value;
        if (boat.id === state.localId) {
          sink.emit('gem:collected', { value: p.value, worldX: p.x, worldY: p.y });
        }
        state.pickups.splice(i, 1);
        break;
      }
    }
  }
}
