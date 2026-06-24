import { bus } from '@/core/EventBus';
import type { GameServices } from '@/core/types';
import { MainMenu } from '@/ui/screens/MainMenu';
import { Results } from '@/ui/screens/Results';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';
import { HowTo } from '@/ui/screens/HowTo';
import { Hud } from '@/ui/hud/Hud';
import { Toasts } from '@/ui/hud/Toasts';
import { Sfx } from '@/ui/audio/Sfx';
import { Mobile } from '@/ui/Mobile';

/**
 * Top-level DOM UI controller. Mounts into #ui-root and swaps screens from the
 * lifecycle events on the bus. Knows nothing about Phaser or the sim — it only
 * consumes the typed event bus + store snapshot, and reaches the platform purely
 * through the injected {@link GameServices} (so ui/ never imports platform/).
 */
export class UIRoot {
  private readonly menu: MainMenu;
  private readonly hud = new Hud();
  private readonly toasts = new Toasts();
  private readonly sfx = new Sfx();
  private readonly mobile = new Mobile();
  private readonly results: Results;
  private readonly settings: SettingsScreen;
  private readonly howto: HowTo;

  constructor(root: HTMLElement, services: GameServices) {
    this.menu = new MainMenu({
      onHowTo: () => this.howto.show(),
      onSettings: () => this.settings.show(),
    });
    this.results = new Results({
      onPlayAgain: () => {
        this.results.hide();
        void services.requestAd('midgame').finally(() => bus.emit('intent:requeue'));
      },
      onMenu: () => {
        this.results.hide();
        this.menu.show();
      },
      onDoublePayout: () => services.requestAd('rewarded'),
    });
    this.settings = new SettingsScreen(() => this.settings.hide());
    this.howto = new HowTo(() => this.howto.hide());

    this.menu.mount(root);
    this.hud.mount(root);
    this.results.mount(root);
    this.settings.mount(root);
    this.howto.mount(root);
    this.toasts.mount(root);
    this.sfx.start();
    this.mobile.start();

    bus.on('round:started', () => {
      this.menu.hide();
      this.results.hide();
      this.hud.show();
    });
    bus.on('round:ended', ({ winnerId, results }) => {
      this.hud.hide();
      this.results.show(results, winnerId);
    });
  }
}
