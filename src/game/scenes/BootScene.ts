import Phaser from 'phaser';

/**
 * Boot: (M1+) generate the programmatic placeholder textures, then hand off to
 * the world. Kept intentionally tiny — texture generation lands with the boat
 * in M1 via gfx/textures.ts.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    this.scene.start('world');
  }
}
