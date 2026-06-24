import '@/ui/styles/tokens.css';
import '@/ui/styles/ui.css';
import { UIRoot } from '@/ui/UIRoot';
import { PhaserGame } from '@/game/PhaserGame';
import { createPlatform } from '@/platform/crazygames';

/**
 * Composition root. The ONLY place allowed to wire all layers together:
 *  - the DOM UI (UIRoot) mounts over #ui-root,
 *  - Phaser (PhaserGame) mounts into #game-root,
 *  - the CrazyGames platform adapter is initialised (no-op fallback off-platform).
 *
 * Everything communicates exclusively through the core event bus + store, so
 * each layer stays independently buildable, testable, and (for the game) movable
 * to a server later — see docs/ARCHITECTURE.md.
 */
async function boot(): Promise<void> {
  const platform = createPlatform();
  await platform.init();

  const uiRootEl = document.getElementById('ui-root');
  if (uiRootEl) new UIRoot(uiRootEl);

  new PhaserGame('game-root');
}

void boot();
