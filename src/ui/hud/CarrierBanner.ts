import { uiStore } from '@/core/store';
import type { HudSnapshot } from '@/core/types';

/**
 * Carrier banner (DOM). Once the Rock surfaces it announces who holds it; when
 * the local player carries it, it points an arrow at the nearest black-market
 * dock (bearing supplied by the game in the snapshot). Reads only the store.
 */
export class CarrierBanner {
  readonly el: HTMLElement;
  private readonly text: HTMLElement;
  private readonly arrow: HTMLElement;
  private unsub: (() => void) | undefined;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'carrier-banner';
    this.el.hidden = true;
    this.el.innerHTML = `
      <span class="carrier-banner__gem">💎</span>
      <span class="carrier-banner__text" data-text></span>
      <span class="carrier-banner__arrow" data-arrow hidden>➤</span>`;
    this.text = mustQ(this.el, '[data-text]');
    this.arrow = mustQ(this.el, '[data-arrow]');
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
    this.el.hidden = true;
  }

  private apply(s: HudSnapshot): void {
    if (!s.rockFound) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    this.el.classList.toggle('is-mine', s.carrying);

    if (s.carrying) {
      this.text.textContent = 'You have the Rock — smuggle it to a dock!';
      this.arrow.hidden = false;
      if (s.dockArrowDeg !== null) this.arrow.style.transform = `rotate(${s.dockArrowDeg}deg)`;
    } else if (s.carrierName) {
      this.text.textContent = `${s.carrierName} has the Rock!`;
      this.arrow.hidden = true;
    } else {
      this.text.textContent = 'The Rock is loose — grab it!';
      this.arrow.hidden = true;
    }
  }
}

function mustQ(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`CarrierBanner: missing ${sel}`);
  return el;
}
