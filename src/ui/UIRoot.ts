import { bus } from '@/core/EventBus';
import { MainMenu } from '@/ui/screens/MainMenu';

/**
 * Top-level DOM UI controller. Mounts into #ui-root and swaps screens in
 * response to lifecycle events from the game. Knows nothing about Phaser or the
 * sim — it consumes the typed event bus + store snapshot only, which is exactly
 * what lets multiplayer slot in behind the WorldModel seam without touching UI.
 */
export class UIRoot {
  private readonly root: HTMLElement;
  private readonly menu = new MainMenu();

  constructor(root: HTMLElement) {
    this.root = root;
    this.menu.mount(this.root);

    bus.on('round:started', () => this.menu.hide());
    bus.on('round:ended', () => this.menu.show());
  }
}
