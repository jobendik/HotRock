import type { EventSink } from '@/core/events';
import type { InputFrame, PlayerId, UpgradeId, ConsumableToolId } from '@/core/types';
import { dist } from '@/core/math';
import { UPGRADES, TOOLS, MAX_SPEED_TIER } from '@/config/balance';
import type { WorldState, Boat } from '@/sim/WorldState';

/**
 * Upgrades & tools. Reads the one-shot `buyUpgrade` / `useTool` carried on the
 * input frame (the UI emits intents → InputController queues them, one per fixed
 * step, so each is applied exactly once), spends cash, and ticks tool windows.
 * Toasts are emitted for the LOCAL player only. All upgrades reset each round
 * (no pay-to-win): they live on the boat, which is rebuilt at round start.
 */
export const CONSUMABLE_IDS: readonly ConsumableToolId[] = ['net', 'smoke', 'radar'];

export function stepEconomy(
  state: WorldState,
  inputs: Map<PlayerId, InputFrame>,
  dt: number,
  sink: EventSink,
): void {
  const dtMs = dt * 1000;
  for (const boat of state.boats) {
    for (const id of CONSUMABLE_IDS) {
      const t = boat.tools[id];
      if (t.activeMsLeft > 0) t.activeMsLeft = Math.max(0, t.activeMsLeft - dtMs);
    }
    const input = inputs.get(boat.id);
    if (!input) continue;
    if (input.buyUpgrade) buyUpgrade(state, boat, input.buyUpgrade, sink);
    if (input.useTool && input.useTool !== 'boost') useTool(state, boat, input.useTool, sink);
  }
}

/** Cost of the player's NEXT engine tier, or Infinity if maxed. */
export function nextTierCost(tier: number): number {
  if (tier >= MAX_SPEED_TIER) return Infinity;
  const c = UPGRADES.speed.cost;
  return typeof c === 'number' ? c : (c[tier] ?? Infinity);
}

/** Flat cost of a non-tiered upgrade. */
export function flatCost(id: Exclude<UpgradeId, 'speed'>): number {
  const c = UPGRADES[id].cost;
  return typeof c === 'number' ? c : Infinity;
}

function buyUpgrade(state: WorldState, boat: Boat, id: UpgradeId, sink: EventSink): void {
  const isLocal = boat.id === state.localId;
  if (id === 'speed') {
    if (boat.speedTier >= MAX_SPEED_TIER) return;
    const cost = nextTierCost(boat.speedTier);
    if (boat.cash < cost) return;
    boat.cash -= cost;
    boat.speedTier++;
    if (isLocal) sink.emit('toast', { kind: 'good', text: `Engine Mk${boat.speedTier}` });
    return;
  }
  if (id === 'boostRefill') {
    if (boat.boostCharge >= 1 && !boat.boosting) return; // already full
    const cost = flatCost('boostRefill');
    if (boat.cash < cost) return;
    boat.cash -= cost;
    boat.boostCharge = 1;
    boat.boosting = false;
    boat.boostMsLeft = 0;
    if (isLocal) sink.emit('toast', { kind: 'good', text: 'Boost refueled' });
    return;
  }
  // net | smoke | radar — buy a charge
  const cost = flatCost(id);
  if (boat.cash < cost) return;
  boat.cash -= cost;
  boat.tools[id].count++;
  if (isLocal) sink.emit('toast', { kind: 'info', text: `+1 ${UPGRADES[id].label}` });
}

function useTool(state: WorldState, boat: Boat, id: ConsumableToolId, sink: EventSink): void {
  const t = boat.tools[id];
  if (t.count <= 0 || t.activeMsLeft > 0) return;
  t.count--;
  t.activeMsLeft = TOOLS[id].durationMs;
  const isLocal = boat.id === state.localId;

  // M3 opens the active window; net (steal) + smoke (hide) effects land with the
  // Rock/bots. Radar resolves immediately into a directional ping.
  if (id === 'radar') pingNearestSite(state, boat, sink, isLocal);
  else if (isLocal) sink.emit('toast', { kind: 'info', text: `${UPGRADES[id].label} active` });
}

const COMPASS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;

function pingNearestSite(state: WorldState, boat: Boat, sink: EventSink, isLocal: boolean): void {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const s of state.sites) {
    if (s.dug) continue;
    const d = dist(boat.x, boat.y, s.x, s.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!isLocal) return;
  if (!best) {
    sink.emit('toast', { kind: 'info', text: 'Sonar: no sites left' });
    return;
  }
  // -y is North; bucket the bearing into 8 points.
  const ang = Math.atan2(-(best.y - boat.y), best.x - boat.x); // -PI..PI
  const idx = ((Math.round((ang / (Math.PI * 2)) * 8) % 8) + 8) % 8;
  sink.emit('toast', { kind: 'info', text: `Sonar: nearest site ${COMPASS[idx]}` });
}
