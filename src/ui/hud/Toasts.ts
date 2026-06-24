import { bus } from '@/core/EventBus';
import type { ToastKind } from '@/core/types';

/**
 * Transient toast messages (DOM). Subscribes to `toast` events and shows a brief
 * stack. Lives at the UI root so it works on every screen. Honours reduced motion
 * via CSS. Pure DOM — no game/sim imports.
 */
const LIFETIME_MS = 2200;
const FADE_MS = 300;

export class Toasts {
  readonly el: HTMLElement;
  private off: (() => void) | undefined;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toasts';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
    this.off = bus.on('toast', ({ kind, text }) => this.push(kind, text));
  }

  destroy(): void {
    this.off?.();
    this.off = undefined;
  }

  private push(kind: ToastKind, text: string): void {
    const t = document.createElement('div');
    t.className = `toast toast--${kind}`;
    t.textContent = text;
    this.el.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-shown'));
    window.setTimeout(() => {
      t.classList.remove('is-shown');
      window.setTimeout(() => t.remove(), FADE_MS);
    }, LIFETIME_MS);
  }
}
