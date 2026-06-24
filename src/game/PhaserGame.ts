import Phaser from 'phaser';
import { createGameConfig } from '@/config/gameConfig';
import { BootScene } from '@/game/scenes/BootScene';
import { WorldScene } from '@/game/scenes/WorldScene';

/**
 * Owns the single Phaser.Game instance and mounts it into the #game-root element.
 * Everything that renders the game world lives below here. The UI layer never
 * touches this — it only speaks the core event contract.
 */
export class PhaserGame {
  readonly game: Phaser.Game;

  constructor(parentId: string) {
    this.game = new Phaser.Game(createGameConfig(parentId, [BootScene, WorldScene]));
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
