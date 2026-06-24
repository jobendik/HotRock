import { uiStore } from '@/core/store';
import type { HudSnapshot } from '@/core/types';
import { MobileControls } from '@/ui/hud/MobileControls';
import { Minimap } from '@/ui/hud/Minimap';

/**
 * In-round HUD overlay (DOM). Subscribes to the throttled store snapshot and
 * renders the cash counter (animated count-up), the radial dig ring, the corner
 * minimap, and the touch controls. Reads only the store — never the game/sim —
 * so the same HUD works unchanged when the simulation moves to a server.
 */
export class Hud {
  readonly el: HTMLElement;
  private readonly controls = new MobileControls();
  private readonly minimap = new Minimap();
  private readonly cashValue: HTMLElement;
  private readonly digRing: HTMLElement;

  private unsub: (() => void) | undefined;
  private shownCash = 0;
  private targetCash = 0;
  private cashRaf = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="hud__top">
        <div class="stat stat--cash">
          <span class="stat__icon">◈</span><span class="stat__value" data-cash>0</span>
        </div>
      </div>
      <div class="dig-ring" data-dig hidden>
        <div class="dig-ring__inner">Digging…</div>
      </div>`;

    this.cashValue = mustQuery(this.el, '[data-cash]');
    this.digRing = mustQuery(this.el, '[data-dig]');

    this.minimap.mount(this.el);
    this.controls.mount(this.el);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  show(): void {
    this.el.hidden = false;
    this.shownCash = 0;
    this.targetCash = 0;
    this.cashValue.textContent = '0';
    this.apply(uiStore.get());
    this.unsub = uiStore.subscribe((s) => this.apply(s));
    this.minimap.start();
    this.startCashAnim();
  }

  hide(): void {
    this.el.hidden = true;
    this.unsub?.();
    this.unsub = undefined;
    this.minimap.stop();
    cancelAnimationFrame(this.cashRaf);
    this.cashRaf = 0;
  }

  private apply(s: HudSnapshot): void {
    this.targetCash = s.cash;
    this.controls.setBoostCharge(s.boostCharge);
    const digging = s.digProgress > 0;
    this.digRing.hidden = !digging;
    if (digging) this.digRing.style.setProperty('--p', s.digProgress.toFixed(3));
  }

  /** Ease the displayed cash toward the target so gains "count up". */
  private startCashAnim(): void {
    const tick = (): void => {
      const diff = this.targetCash - this.shownCash;
      if (Math.abs(diff) >= 1) {
        this.shownCash += diff * 0.2;
        this.cashValue.textContent = String(Math.round(this.shownCash));
      } else if (this.shownCash !== this.targetCash) {
        this.shownCash = this.targetCash;
        this.cashValue.textContent = String(this.targetCash);
      }
      this.cashRaf = requestAnimationFrame(tick);
    };
    this.cashRaf = requestAnimationFrame(tick);
  }
}

function mustQuery<T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Hud: missing element ${sel}`);
  return el;
}
