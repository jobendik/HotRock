import Phaser from 'phaser';
import { BOAT } from '@/config/balance';
import { TEX } from '@/game/gfx/textures';

/**
 * Thin render mirror of a sim boat (no game logic). Adds the juice the design
 * calls for: a wake trail from the stern, a banking squash into turns, and a
 * gentle bob. Driven entirely by `sync()` from interpolated sim state.
 *
 * Render-feel constants live here (they don't affect the simulation, so they're
 * not balance.ts gameplay numbers).
 */
const BANK_PER_RADPS = 0.04; // squash amount per rad/s of turn
const BANK_MAX = 0.18;
const WAKE_SPEED_MIN = 45; // px/s before the wake kicks in
const BOB_SPEED = 0.005;

export class BoatView {
  readonly root: Phaser.GameObjects.Container;
  private readonly hull: Phaser.GameObjects.Image;
  private readonly wake: Phaser.GameObjects.Particles.ParticleEmitter;
  private wakeEnabled = true;

  constructor(scene: Phaser.Scene, color: string) {
    const tint = colorToInt(color);
    this.wake = scene.add
      .particles(0, 0, TEX.wake, {
        lifespan: 650,
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.5, end: 0 },
        frequency: 55,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(1);
    this.hull = scene.add.image(0, 0, TEX.boat).setTint(tint);
    this.root = scene.add.container(0, 0, [this.hull]).setDepth(2);
  }

  /** Position/orient from interpolated sim state. `time` drives the bob phase. */
  sync(
    x: number,
    y: number,
    angle: number,
    angularVel: number,
    speed: number,
    time: number,
  ): void {
    this.root.setPosition(x, y);
    this.hull.setRotation(angle);
    const squash = Math.min(Math.abs(angularVel) * BANK_PER_RADPS, BANK_MAX);
    this.hull.setScale(1, 1 - squash);
    this.hull.y = Math.sin(time * BOB_SPEED) * BOAT.bobAmplitude;

    const sternX = x - Math.cos(angle) * BOAT.radius;
    const sternY = y - Math.sin(angle) * BOAT.radius;
    this.wake.setPosition(sternX, sternY);
    this.wake.emitting = this.wakeEnabled && speed > WAKE_SPEED_MIN;
  }

  /** Low quality disables the wake particles. */
  setWakeEnabled(enabled: boolean): void {
    this.wakeEnabled = enabled;
    if (!enabled) this.wake.emitting = false;
  }

  destroy(): void {
    this.wake.destroy();
    this.root.destroy();
  }
}

function colorToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
