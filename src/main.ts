import '@/ui/styles/tokens.css';
import '@/ui/styles/ui.css';
import '@/ui/styles/hud.css';
import { bus } from '@/core/EventBus';
import { UIRoot } from '@/ui/UIRoot';
import { settings } from '@/ui/settings';
import { PhaserGame } from '@/game/PhaserGame';
import { createPlatform } from '@/platform/crazygames';

/**
 * Composition root. The ONLY place allowed to wire all layers together:
 *  - the DOM UI (UIRoot) mounts over #ui-root,
 *  - Phaser (PhaserGame) mounts into #game-root,
 *  - the CrazyGames platform adapter is initialised (no-op fallback off-platform)
 *    and handed to the UI as GameServices (so ui/ never imports platform/).
 *
 * Everything communicates through the core event bus + store, so each layer
 * stays independently buildable, testable, and (for the game) movable to a
 * server later — see docs/ARCHITECTURE.md.
 */
async function boot(): Promise<void> {
  const platform = createPlatform();
  await platform.init();

  const uiRootEl = document.getElementById('ui-root');
  if (uiRootEl) new UIRoot(uiRootEl, platform);

  // Platform gameplay lifecycle (mutes site music / pauses banners during play).
  bus.on('round:started', () => platform.gameplayStart());
  bus.on('round:ended', () => platform.gameplayStop());
  // Apply the persisted render quality once the world scene is listening.
  bus.on('game:ready', () => bus.emit('intent:setQuality', { level: settings.get().quality }));

  new PhaserGame('game-root');
}

void boot();
