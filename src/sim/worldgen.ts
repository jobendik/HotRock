import type { Rng } from '@/core/rng';
import { dist } from '@/core/math';
import { WORLD, ISLANDS, DOCKS } from '@/config/balance';
import type { Island } from '@/sim/WorldState';

/**
 * Deterministically scatter island colliders for a round. Rejection-samples so
 * islands keep clear of the map edges, the docks (which must stay approachable),
 * the player spawn, and each other. Same seed ⇒ same archipelago.
 */
export function generateIslands(rng: Rng, spawnX: number, spawnY: number): Island[] {
  const islands: Island[] = [];
  const maxAttempts = ISLANDS.count * 50;
  let attempts = 0;

  while (islands.length < ISLANDS.count && attempts < maxAttempts) {
    attempts++;
    const r = rng.range(ISLANDS.minRadius, ISLANDS.maxRadius);
    const x = rng.range(ISLANDS.edgeMargin + r, WORLD.width - ISLANDS.edgeMargin - r);
    const y = rng.range(ISLANDS.edgeMargin + r, WORLD.height - ISLANDS.edgeMargin - r);

    if (dist(x, y, spawnX, spawnY) < r + ISLANDS.spawnClearance) continue;
    if (DOCKS.some((d) => dist(x, y, d.x, d.y) < r + ISLANDS.dockClearance)) continue;
    if (islands.some((i) => dist(x, y, i.x, i.y) < r + i.radius + ISLANDS.minGap)) continue;

    islands.push({ x, y, radius: r });
  }
  return islands;
}
