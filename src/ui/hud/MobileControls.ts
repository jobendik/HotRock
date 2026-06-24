import { bus } from '@/core/EventBus';
import { clamp } from '@/core/math';

/**
 * Touch controls (DOM): a left virtual joystick and a right Boost button. Emits
 * `intent:joystick` (normalised −1..1) and `intent:action` so the game's
 * InputController can fold them into the input frame. Shown only on coarse
 * pointers (CSS); desktop drives with the keyboard. No Phaser/game imports.
 */
const KNOB_RADIUS = 56; // px of knob travel == full deflection

export class MobileControls {
  readonly el: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly boostBtn: HTMLButtonElement;
  private readonly boostFill: HTMLElement;

  private joyPointer: number | null = null;
  private baseCx = 0;
  private baseCy = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'mobile-controls';
    this.el.innerHTML = `
      <div class="joystick" data-joy>
        <div class="joystick__base"></div>
        <div class="joystick__knob" data-knob></div>
      </div>
      <div class="action-buttons">
        <button class="action-btn action-btn--boost" type="button" data-boost aria-label="Boost">
          <span class="action-btn__fill" data-boost-fill></span>
          <span class="action-btn__label">Boost</span>
        </button>
      </div>`;

    this.base = mustQuery(this.el, '[data-joy]');
    this.knob = mustQuery(this.el, '[data-knob]');
    this.boostBtn = mustQuery<HTMLButtonElement>(this.el, '[data-boost]');
    this.boostFill = mustQuery(this.el, '[data-boost-fill]');

    this.bindJoystick();
    this.bindBoost();
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  /** Reflect the boost meter (0..1) on the button. */
  setBoostCharge(charge: number): void {
    const c = clamp(charge, 0, 1);
    this.boostFill.style.height = `${Math.round(c * 100)}%`;
    this.boostBtn.classList.toggle('is-ready', c >= 1);
  }

  private bindJoystick(): void {
    const onDown = (e: PointerEvent): void => {
      if (this.joyPointer !== null) return;
      this.joyPointer = e.pointerId;
      this.base.setPointerCapture(e.pointerId);
      const r = this.base.getBoundingClientRect();
      this.baseCx = r.left + r.width / 2;
      this.baseCy = r.top + r.height / 2;
      this.moveKnob(e);
    };
    const onMove = (e: PointerEvent): void => {
      if (e.pointerId === this.joyPointer) this.moveKnob(e);
    };
    const onUp = (e: PointerEvent): void => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.knob.style.transform = 'translate(-50%, -50%)';
      bus.emit('intent:joystick', { x: 0, y: 0 });
    };
    this.base.addEventListener('pointerdown', onDown);
    this.base.addEventListener('pointermove', onMove);
    this.base.addEventListener('pointerup', onUp);
    this.base.addEventListener('pointercancel', onUp);
  }

  private moveKnob(e: PointerEvent): void {
    let dx = e.clientX - this.baseCx;
    let dy = e.clientY - this.baseCy;
    const m = Math.hypot(dx, dy);
    if (m > KNOB_RADIUS) {
      dx = (dx / m) * KNOB_RADIUS;
      dy = (dy / m) * KNOB_RADIUS;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    bus.emit('intent:joystick', { x: dx / KNOB_RADIUS, y: dy / KNOB_RADIUS });
  }

  private bindBoost(): void {
    const down = (e: PointerEvent): void => {
      e.preventDefault();
      this.boostBtn.classList.add('is-down');
      bus.emit('intent:action', { action: 'boost', down: true });
    };
    const up = (): void => {
      this.boostBtn.classList.remove('is-down');
      bus.emit('intent:action', { action: 'boost', down: false });
    };
    this.boostBtn.addEventListener('pointerdown', down);
    this.boostBtn.addEventListener('pointerup', up);
    this.boostBtn.addEventListener('pointerleave', up);
    this.boostBtn.addEventListener('pointercancel', up);
  }
}

function mustQuery<T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`MobileControls: missing element ${sel}`);
  return el;
}
