import { bus } from '@/core/EventBus';
import { uiStore } from '@/core/store';
import type { HudSnapshot, ConsumableToolId } from '@/core/types';

/**
 * Use-buttons for owned consumable tools (Net / Smoke / Sonar). Each appears
 * once you own a charge, shows the count, and rings while its window is active.
 * Click → `intent:useTool`. Reads only the store snapshot.
 */
const ORDER: readonly ConsumableToolId[] = ['net', 'smoke', 'radar'];
const SHORT: Record<ConsumableToolId, string> = { net: 'NET', smoke: 'SMK', radar: 'SON' };

interface Row {
  id: ConsumableToolId;
  btn: HTMLButtonElement;
  badge: HTMLElement;
}

export class ToolButtons {
  readonly el: HTMLElement;
  private readonly rows: Row[] = [];
  private unsub: (() => void) | undefined;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'tool-buttons';
    for (const id of ORDER) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-btn';
      btn.dataset.tool = id;
      btn.hidden = true;
      btn.innerHTML = `<span class="tool-btn__code">${SHORT[id]}</span><span class="tool-btn__badge" data-badge>0</span>`;
      btn.addEventListener('click', () => bus.emit('intent:useTool', { id }));
      this.el.appendChild(btn);
      this.rows.push({ id, btn, badge: mustQ(btn, '[data-badge]') });
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
      const t = s.tools.find((x) => x.id === row.id);
      const owned = (t?.count ?? 0) > 0 || (t?.activeMsLeft ?? 0) > 0;
      row.btn.hidden = !owned;
      if (!owned) continue;
      row.badge.textContent = String(t?.count ?? 0);
      row.btn.classList.toggle('is-active', (t?.activeMsLeft ?? 0) > 0);
      row.btn.disabled = !(t?.ready ?? false);
    }
  }
}

function mustQ(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`ToolButtons: missing ${sel}`);
  return el;
}
