import { uiStore } from '@/core/store';
import { MobileControls } from '@/ui/hud/MobileControls';

/**
 * In-round HUD overlay (DOM). M1 hosts the touch controls and mirrors the boost
 * meter from the store snapshot. The cash counter, timer/heat, upgrade bar,
 * minimap and carrier banner are added in later milestones — each subscribes to
 * the same throttled store, never reading the game directly.
 */
export class Hud {
  readonly el: HTMLElement;
  private readonly controls = new MobileControls();
  private unsub: (() => void) | undefined;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.hidden = true;
    this.controls.mount(this.el);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  show(): void {
    this.el.hidden = false;
    this.controls.setBoostCharge(uiStore.get().boostCharge);
    this.unsub = uiStore.subscribe((s) => this.controls.setBoostCharge(s.boostCharge));
  }

  hide(): void {
    this.el.hidden = true;
    this.unsub?.();
    this.unsub = undefined;
  }
}
