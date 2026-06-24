import { settings } from '@/ui/settings';
import type { QualityLevel } from '@/core/types';

/**
 * Settings overlay (DOM): sound, volume, render quality. Writes through the
 * settings store, which persists and re-broadcasts the matching intents.
 */
const QUALITIES: readonly QualityLevel[] = ['low', 'medium', 'high'];

export class SettingsScreen {
  readonly el: HTMLElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly volume: HTMLInputElement;
  private readonly qualityWrap: HTMLElement;
  private readonly fsField: HTMLElement;
  private readonly fsBtn: HTMLButtonElement;
  private readonly fsSupported = typeof document.documentElement.requestFullscreen === 'function';

  constructor(private readonly onClose: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'screen modal-screen';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="modal">
        <h2 class="modal__title">Settings</h2>
        <div class="field">
          <span class="field__label">Sound</span>
          <button class="toggle" type="button" data-sound></button>
        </div>
        <div class="field">
          <span class="field__label">Volume</span>
          <input class="slider" type="range" min="0" max="100" data-volume />
        </div>
        <div class="field">
          <span class="field__label">Quality</span>
          <div class="seg" data-quality>
            ${QUALITIES.map((q) => `<button class="seg__btn" type="button" data-q="${q}">${q}</button>`).join('')}
          </div>
        </div>
        <div class="field" data-fs-field hidden>
          <span class="field__label">Fullscreen</span>
          <button class="toggle" type="button" data-fs>Off</button>
        </div>
        <button class="btn btn--primary" type="button" data-close>Done</button>
      </div>`;

    this.soundBtn = mustQ<HTMLButtonElement>(this.el, '[data-sound]');
    this.volume = mustQ<HTMLInputElement>(this.el, '[data-volume]');
    this.qualityWrap = mustQ(this.el, '[data-quality]');
    this.fsField = mustQ(this.el, '[data-fs-field]');
    this.fsBtn = mustQ<HTMLButtonElement>(this.el, '[data-fs]');

    this.soundBtn.addEventListener('click', () => settings.set({ sound: !settings.get().sound }));
    this.volume.addEventListener('input', () =>
      settings.set({ volume: Number(this.volume.value) / 100 }),
    );
    this.qualityWrap.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((btn) => {
      btn.addEventListener('click', () => settings.set({ quality: btn.dataset.q as QualityLevel }));
    });
    mustQ(this.el, '[data-close]').addEventListener('click', () => this.onClose());

    if (this.fsSupported) {
      this.fsField.hidden = false;
      this.fsBtn.addEventListener('click', () => this.toggleFullscreen());
      document.addEventListener('fullscreenchange', () => this.reflect());
    }

    settings.subscribe(() => this.reflect());
  }

  private toggleFullscreen(): void {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch (e) {
      console.warn('[settings] fullscreen toggle failed', e);
    }
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  show(): void {
    this.reflect();
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  private reflect(): void {
    const s = settings.get();
    this.soundBtn.textContent = s.sound ? 'On' : 'Off';
    this.soundBtn.classList.toggle('is-on', s.sound);
    this.volume.value = String(Math.round(s.volume * 100));
    this.qualityWrap.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.q === s.quality);
    });
    if (this.fsSupported) {
      const on = document.fullscreenElement !== null;
      this.fsBtn.textContent = on ? 'On' : 'Off';
      this.fsBtn.classList.toggle('is-on', on);
    }
  }
}

function mustQ<T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`SettingsScreen: missing ${sel}`);
  return el;
}
