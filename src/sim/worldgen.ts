import type { Rng } from '@/core/rng';
import { dist } from '@/core/math';
import { WORLD, ISLANDS, DOCKS, DIG_SITES, DIG, LOOT_TABLE } from '@/config/balance';
import type { Island, DigSite } from '@/sim/WorldState';

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

const SITE_EDGE_MARGIN = 150;
const SITE_SPAWN_CLEARANCE = 260;
const SITE_DOCK_CLEARANCE = 200;

/**
 * Scatter dig sites on open water — off islands (reachable), clear of docks and
 * the spawn, and spaced apart. Each site's reward is pre-rolled from the loot
 * table so the round is fully reproducible from its seed.
 */
export function generateSites(
  rng: Rng,
  islands: Island[],
  spawnX: number,
  spawnY: number,
): DigSite[] {
  const sites: DigSite[] = [];
  const maxAttempts = DIG_SITES.count * 60;
  let attempts = 0;

  while (sites.length < DIG_SITES.count && attempts < maxAttempts) {
    attempts++;
    const x = rng.range(SITE_EDGE_MARGIN, WORLD.width - SITE_EDGE_MARGIN);
    const y = rng.range(SITE_EDGE_MARGIN, WORLD.height - SITE_EDGE_MARGIN);

    if (dist(x, y, spawnX, spawnY) < SITE_SPAWN_CLEARANCE) continue;
    if (islands.some((i) => dist(x, y, i.x, i.y) < i.radius + DIG.radius)) continue;
    if (DOCKS.some((d) => dist(x, y, d.x, d.y) < SITE_DOCK_CLEARANCE)) continue;
    if (sites.some((s) => dist(x, y, s.x, s.y) < DIG_SITES.minSpacing)) continue;

    const reward = rng.weighted(LOOT_TABLE.map((e) => ({ weight: e.weight, value: e.reward })));
    sites.push({ id: `site-${sites.length}`, x, y, dug: false, reward });
  }
  return sites;
}
