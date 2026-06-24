import { bus } from '@/core/EventBus';

/**
 * Main menu (DOM/CSS only). Play → `intent:startRound`. "How to play" and
 * "Settings" are stubbed here in M0 and fleshed out in M6. No Phaser, no
 * game/sim imports — this screen only speaks the event contract.
 */
export interface MainMenuHandlers {
  onHowTo: () => void;
  onSettings: () => void;
}

export class MainMenu {
  readonly el: HTMLElement;

  constructor(handlers: MainMenuHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'screen menu';
    this.el.innerHTML = `
      <div class="menu__card">
        <h1 class="menu__title">Hot&nbsp;Rock</h1>
        <p class="menu__tag">Dig for gems. Find the Rock. Smuggle it home before they ram it loose.</p>
        <button class="btn btn--primary" type="button" data-action="play">Play</button>
        <div class="menu__row">
          <button class="btn" type="button" data-action="how">How to play</button>
          <button class="btn" type="button" data-action="settings">Settings</button>
        </div>
      </div>`;

    this.el.querySelector('[data-action="play"]')?.addEventListener('click', () => {
      bus.emit('intent:startRound');
    });
    this.el.querySelector('[data-action="how"]')?.addEventListener('click', () => handlers.onHowTo());
    this.el
      .querySelector('[data-action="settings"]')
      ?.addEventListener('click', () => handlers.onSettings());
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }
  show(): void {
    this.el.hidden = false;
  }
  hide(): void {
    this.el.hidden = true;
  }
  destroy(): void {
    this.el.remove();
  }
}
