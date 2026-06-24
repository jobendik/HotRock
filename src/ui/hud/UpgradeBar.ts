import { bus } from '@/core/EventBus';
import { uiStore } from '@/core/store';
import type { HudSnapshot, UpgradeId } from '@/core/types';
import { UPGRADES, MAX_SPEED_TIER } from '@/config/balance';

/**
 * Buy bar (DOM). One button per upgrade; reflects affordability, the engine tier,
 * and owned tool counts from the store snapshot. Click → `intent:buyUpgrade`.
 * Costs are read from balance (the single source of truth) — the sim re-checks
 * and is authoritative, so a stale UI can never overspend.
 */
const ORDER: readonly UpgradeId[] = ['speed', 'boostRefill', 'net', 'smoke', 'radar'];

interface Row {
  id: UpgradeId;
  btn: HTMLButtonElement;
  cost: HTMLElement;
  badge: HTMLElement;
}

export class UpgradeBar {
  readonly el: HTMLElement;
  private readonly rows: Row[] = [];
  private unsub: (() => void) | undefined;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'upgrade-bar';
    for (const id of ORDER) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'up';
      btn.dataset.up = id;
      btn.innerHTML = `<span class="up__label">${UPGRADES[id].label}</span><span class="up__cost" data-cost></span><span class="up__badge" data-badge hidden></span>`;
      btn.addEventListener('click', () => bus.emit('intent:buyUpgrade', { id }));
      this.el.appendChild(btn);
      this.rows.push({ id, btn, cost: mustQ(btn, '[data-cost]'), badge: mustQ(btn, '[data-badge]') });
    }
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  show(): void {
    this.apply(uiStore.get());
    this.unsub = uiStore.subscribe((s) => this.apply(s));
  }

  hide(): void {
    this.unsub?.();
    this.unsub = undefined;
  }

  private apply(s: HudSnapshot): void {
    for (const row of this.rows) {
      const maxed = row.id === 'speed' && s.speedTier >= MAX_SPEED_TIER;
      const cost = costOf(row.id, s.speedTier);
      const affordable = !maxed && s.cash >= cost;

      row.cost.textContent = maxed ? 'MAX' : `◈ ${cost}`;
      row.btn.disabled = maxed || !affordable;
      row.btn.classList.toggle('is-affordable', affordable);

      if (row.id === 'speed') {
        row.badge.hidden = false;
        row.badge.textContent = `Mk${s.speedTier}`;
      } else {
        const owned = s.tools.find((t) => t.id === row.id)?.count ?? 0;
        row.badge.hidden = owned <= 0;
        row.badge.textContent = `×${owned}`;
      }
    }
  }
}

function costOf(id: UpgradeId, speedTier: number): number {
  if (id === 'speed') {
    const c = UPGRADES.speed.cost;
    return typeof c === 'number' ? c : (c[speedTier] ?? Infinity);
  }
  const c = UPGRADES[id].cost;
  return typeof c === 'number' ? c : Infinity;
}

function mustQ(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`UpgradeBar: missing ${sel}`);
  return el;
}
