import Phaser from 'phaser';
import { bus } from '@/core/EventBus';
import { uiStore } from '@/core/store';
import { clamp, lerp, lerpAngle } from '@/core/math';
import type { PlayerId, RoundConfig } from '@/core/types';
import { WORLD, ROUND, TICK, CAMERA, BOTS } from '@/config/balance';
import { LocalWorldModel } from '@/game/world/LocalWorldModel';
import type { WorldModel, WorldView } from '@/game/world/WorldModel';
import { InputController } from '@/game/input/InputController';
import { BoatView } from '@/game/render/BoatView';

interface PrevState {
  x: number;
  y: number;
  angle: number;
}

const HUD_PUSH_MS = 75; // ~13 Hz HUD snapshot push (never per frame)

/**
 * The world scene. Phaser owns rendering, the camera, and input capture only —
 * ALL rules live behind the `WorldModel` (here a `LocalWorldModel` wrapping the
 * pure `GameSim`). Runs a fixed-timestep accumulator and interpolates rendering
 * between sim states for smoothness regardless of frame rate.
 */
export class WorldScene extends Phaser.Scene {
  private model!: WorldModel;
  private inputCtl!: InputController;
  private running = false;
  private accumulatorMs = 0;
  private localId: PlayerId = 'p0';
  private camZoom = 1;
  private lastHudPushMs = 0;

  private readonly boatViews = new Map<PlayerId, BoatView>();
  private readonly prev = new Map<PlayerId, PrevState>();
  private islandGfx: Phaser.GameObjects.Graphics | undefined;

  private readonly roundConfig: RoundConfig = {
    playerCount: 1,
    botCount: BOTS.defaultCount,
    durationMs: ROUND.durationMs,
  };

  constructor() {
    super('world');
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.centerOn(WORLD.width / 2, WORLD.height / 2);
    this.drawWater();

    this.model = new LocalWorldModel(bus);
    this.inputCtl = new InputController();

    bus.on('intent:startRound', () => this.beginRound());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.inputCtl.destroy());
    bus.emit('game:ready');
  }

  // ---- round lifecycle ----

  private beginRound(): void {
    this.clearRound();
    const seed = (Date.now() & 0xffffffff) >>> 0;
    this.model.start(seed, this.roundConfig);

    const view = this.model.getView();
    this.localId = view.localId;
    this.drawIslands(view);
    this.syncBoatViews(view);
    this.snapshotPrev(view);

    const local = this.boatViews.get(this.localId);
    if (local) {
      this.cameras.main.startFollow(local.root, false, CAMERA.followLerp, CAMERA.followLerp);
    }
    this.camZoom = 1;
    this.cameras.main.setZoom(1);
    this.accumulatorMs = 0;
    this.lastHudPushMs = 0;
    this.running = true;
  }

  private clearRound(): void {
    this.cameras.main.stopFollow();
    for (const v of this.boatViews.values()) v.destroy();
    this.boatViews.clear();
    this.prev.clear();
    this.islandGfx?.destroy();
    this.islandGfx = undefined;
  }

  // ---- main loop ----

  override update(time: number, delta: number): void {
    if (!this.running) return;

    // Clamp the frame so a long stall can't trigger a step spiral.
    this.accumulatorMs += Math.min(delta, TICK.fixedDtMs * TICK.maxStepsPerFrame);
    const input = this.inputCtl.sample();

    let steps = 0;
    while (this.accumulatorMs >= TICK.fixedDtMs && steps < TICK.maxStepsPerFrame) {
      this.snapshotPrev(this.model.getView());
      this.model.update(TICK.fixedDtMs, input);
      this.accumulatorMs -= TICK.fixedDtMs;
      steps++;
    }

    const alpha = clamp(this.accumulatorMs / TICK.fixedDtMs, 0, 1);
    const view = this.model.getView();
    this.renderBoats(view, alpha, time);
    this.updateCamera(view);
    this.pushHud(view, time);
  }

  // ---- rendering ----

  private renderBoats(view: WorldView, alpha: number, time: number): void {
    for (const boat of view.boats) {
      let bv = this.boatViews.get(boat.id);
      if (!bv) {
        bv = new BoatView(this, boat.color);
        this.boatViews.set(boat.id, bv);
      }
      const p = this.prev.get(boat.id);
      const x = p ? lerp(p.x, boat.x, alpha) : boat.x;
      const y = p ? lerp(p.y, boat.y, alpha) : boat.y;
      const angle = p ? lerpAngle(p.angle, boat.angle, alpha) : boat.angle;
      const speed = Math.hypot(boat.vx, boat.vy);
      bv.sync(x, y, angle, boat.angularVel, speed, time);
    }
  }

  private updateCamera(view: WorldView): void {
    const local = this.findLocal(view);
    if (!local) return;
    const cam = this.cameras.main;
    cam.followOffset.set(-local.vx * CAMERA.lookAhead, -local.vy * CAMERA.lookAhead);
    const targetZoom = local.boosting ? CAMERA.boostZoomOut : 1;
    this.camZoom = lerp(this.camZoom, targetZoom, CAMERA.zoomLerp);
    cam.setZoom(this.camZoom);
  }

  private pushHud(view: WorldView, time: number): void {
    if (time - this.lastHudPushMs < HUD_PUSH_MS) return;
    this.lastHudPushMs = time;
    const local = this.findLocal(view);
    if (!local) return;
    uiStore.set({
      cash: 0,
      speedTier: local.speedTier,
      // Read the bar as full while a boost is actively firing, then refilling.
      boostCharge: local.boosting ? 1 : local.boostCharge,
      tools: [],
      carrying: false,
      timeLeftMs: 0,
      heat: 0,
    });
  }

  // ---- helpers ----

  private snapshotPrev(view: WorldView): void {
    for (const boat of view.boats) {
      const p = this.prev.get(boat.id);
      if (p) {
        p.x = boat.x;
        p.y = boat.y;
        p.angle = boat.angle;
      } else {
        this.prev.set(boat.id, { x: boat.x, y: boat.y, angle: boat.angle });
      }
    }
  }

  private syncBoatViews(view: WorldView): void {
    for (const boat of view.boats) {
      if (!this.boatViews.has(boat.id)) {
        this.boatViews.set(boat.id, new BoatView(this, boat.color));
      }
    }
  }

  private findLocal(view: WorldView): WorldView['boats'][number] | undefined {
    for (const b of view.boats) if (b.id === this.localId) return b;
    return undefined;
  }

  private drawWater(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x0c4254, 1);
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    g.lineStyle(1, 0x10566b, 0.45);
    const step = 200;
    for (let x = 0; x <= WORLD.width; x += step) g.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += step) g.lineBetween(0, y, WORLD.width, y);
  }

  private drawIslands(view: WorldView): void {
    const g = this.add.graphics().setDepth(0);
    for (const i of view.islands) {
      g.fillStyle(0x07252e, 0.55); // soft shadow / foam ring
      g.fillCircle(i.x, i.y, i.radius + 7);
      g.fillStyle(0xd9c79a, 1); // sand
      g.fillCircle(i.x, i.y, i.radius);
      g.fillStyle(0x6fb36a, 1); // vegetation
      g.fillCircle(i.x, i.y, i.radius * 0.62);
      g.fillStyle(0x4f9457, 1); // canopy highlight
      g.fillCircle(i.x - i.radius * 0.15, i.y - i.radius * 0.12, i.radius * 0.32);
    }
    this.islandGfx = g;
  }
}
