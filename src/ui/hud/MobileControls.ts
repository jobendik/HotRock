import { bus } from '@/core/EventBus';
import { clamp } from '@/core/math';

/**
 * Touch controls (DOM): a **floating** left-thumb joystick and a right Boost
 * button. The left half of the screen is a touch zone — press anywhere and the
 * stick spawns under your thumb and follows it (far better feel than a fixed
 * stick you have to find). Emits `intent:joystick` (normalised −1..1) and
 * `intent:action`. Shown only on coarse pointers; desktop uses the keyboard.
 * No Phaser/game imports.
 */
const KNOB_RADIUS = 60; // px of thumb travel == full deflection

export class MobileControls {
  readonly el: HTMLElement;
  private readonly zone: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly boostBtn: HTMLButtonElement;
  private readonly boostFill: HTMLElement;

  private joyPointer: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'mobile-controls';
    this.el.innerHTML = `
      <div class="joystick-zone" data-zone>
        <div class="joystick" data-stick hidden>
          <div class="joystick__base"></div>
          <div class="joystick__knob" data-knob></div>
        </div>
      </div>
      <div class="action-buttons">
        <button class="action-btn action-btn--boost" type="button" data-boost aria-label="Boost">
          <span class="action-btn__fill" data-boost-fill></span>
          <span class="action-btn__label">Boost</span>
        </button>
      </div>`;

    this.zone = mustQuery(this.el, '[data-zone]');
    this.stick = mustQuery(this.el, '[data-stick]');
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
      this.zone.setPointerCapture(e.pointerId);
      const rect = this.zone.getBoundingClientRect();
      this.originX = e.clientX - rect.left;
      this.originY = e.clientY - rect.top;
      this.stick.style.left = `${this.originX}px`;
      this.stick.style.top = `${this.originY}px`;
      this.stick.hidden = false;
      this.knob.style.transform = 'translate(-50%, -50%)';
    };
    const onMove = (e: PointerEvent): void => {
      if (e.pointerId !== this.joyPointer) return;
      const rect = this.zone.getBoundingClientRect();
      let dx = e.clientX - rect.left - this.originX;
      let dy = e.clientY - rect.top - this.originY;
      const m = Math.hypot(dx, dy);
      if (m > KNOB_RADIUS) {
        dx = (dx / m) * KNOB_RADIUS;
        dy = (dy / m) * KNOB_RADIUS;
      }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      bus.emit('intent:joystick', { x: dx / KNOB_RADIUS, y: dy / KNOB_RADIUS });
    };
    const onUp = (e: PointerEvent): void => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.stick.hidden = true;
      bus.emit('intent:joystick', { x: 0, y: 0 });
    };
    this.zone.addEventListener('pointerdown', onDown);
    this.zone.addEventListener('pointermove', onMove);
    this.zone.addEventListener('pointerup', onUp);
    this.zone.addEventListener('pointercancel', onUp);
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
