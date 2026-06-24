import Phaser from 'phaser';
import { bus } from '@/core/EventBus';
import { WORLD, ROUND } from '@/config/balance';

/**
 * The world scene. Phaser owns rendering + input only.
 *
 * M0: draws a blank ocean grid (proving the render/camera pipeline is live) and
 * closes the contract loop — when the UI emits `intent:startRound`, the scene
 * announces `round:started`. M1 replaces the placeholder with a `WorldModel`
 * driving a rendered boat; the simulation always lives behind that seam.
 */
export class WorldScene extends Phaser.Scene {
  constructor() {
    super('world');
  }

  create(): void {
    this.drawOcean();
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.centerOn(WORLD.width / 2, WORLD.height / 2);

    bus.on('intent:startRound', () => this.startRound());
    bus.emit('game:ready');
  }

  /** Placeholder ocean: a faint grid so the camera + renderer are visibly alive. */
  private drawOcean(): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0x114a5c, 0.5);
    const step = 200;
    for (let x = 0; x <= WORLD.width; x += step) g.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += step) g.lineBetween(0, y, WORLD.width, y);
  }

  /**
   * M0 stub: emit the lifecycle event the UI is waiting on. In M1 this becomes
   * `this.model.start(seed, config)`, with the sim emitting `round:started`.
   */
  private startRound(): void {
    bus.emit('round:started', {
      durationMs: ROUND.durationMs,
      seed: 1,
      playerCount: 1,
    });
  }
}
