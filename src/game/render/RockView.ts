import Phaser from 'phaser';
import { TEX } from '@/game/gfx/textures';

/**
 * Renders the Hot Rock: a pulsing gold glow, a faceted gem, and — while carried —
 * a light pillar so the carrier reads across the whole map. Purely cosmetic;
 * position comes from interpolated sim state via `sync()`.
 */
const GOLD = 0xffd76a;

export class RockView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly beam: Phaser.GameObjects.Image;
  private readonly gem: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.beam = scene.add
      .image(0, -120, TEX.glow)
      .setTint(GOLD)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.6, 5)
      .setAlpha(0.35);
    this.glow = scene.add
      .image(0, 0, TEX.glow)
      .setTint(GOLD)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.4);
    this.gem = scene.add.image(0, 0, TEX.rock);
    this.root = scene.add.container(0, 0, [this.beam, this.glow, this.gem]).setDepth(4);
  }

  sync(x: number, y: number, time: number, carried: boolean): void {
    this.root.setPosition(x, y);
    const pulse = 0.85 + Math.sin(time * 0.006) * 0.15;
    this.glow.setScale(1.4 * pulse);
    this.glow.setAlpha(0.5 * pulse);
    this.beam.setVisible(carried);
    this.gem.setRotation(time * 0.001);
  }

  setVisible(v: boolean): void {
    this.root.setVisible(v);
  }

  destroy(): void {
    this.root.destroy();
  }
}
