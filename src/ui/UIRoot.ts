import { bus } from '@/core/EventBus';
import { MainMenu } from '@/ui/screens/MainMenu';
import { Hud } from '@/ui/hud/Hud';
import { Toasts } from '@/ui/hud/Toasts';

/**
 * Top-level DOM UI controller. Mounts into #ui-root and swaps screens in
 * response to lifecycle events from the game. Knows nothing about Phaser or the
 * sim — it consumes the typed event bus + store snapshot only, which is exactly
 * what lets multiplayer slot in behind the WorldModel seam without touching UI.
 */
export class UIRoot {
  private readonly root: HTMLElement;
  private readonly menu = new MainMenu();
  private readonly hud = new Hud();
  private readonly toasts = new Toasts();

  constructor(root: HTMLElement) {
    this.root = root;
    this.menu.mount(this.root);
    this.hud.mount(this.root);
    this.toasts.mount(this.root); // persists across screens

    bus.on('round:started', () => {
      this.menu.hide();
      this.hud.show();
    });
    bus.on('round:ended', () => {
      this.hud.hide();
      this.menu.show();
    });
  }
}
