import Phaser from 'phaser';
import { generateTextures } from '@/game/gfx/textures';

/**
 * Boot: generate the programmatic placeholder textures, then hand off to the
 * world scene. No external assets — everything is drawn at runtime (gfx/textures).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    generateTextures(this);
    this.scene.start('world');
  }
}
