import Phaser from 'phaser';
import { bus } from '@/core/EventBus';
import { uiStore, minimap } from '@/core/store';
import { clamp, lerp, lerpAngle } from '@/core/math';
import type { PlayerId, RoundConfig, MinimapSnapshot, QualityLevel } from '@/core/types';
import { WORLD, ROUND, TICK, CAMERA, BOTS, DIG, DOCKS, EXTRACT } from '@/config/balance';
import { LocalWorldModel } from '@/game/world/LocalWorldModel';
import type { WorldModel, WorldView } from '@/game/world/WorldModel';
import { InputController } from '@/game/input/InputController';
import { BoatView } from '@/game/render/BoatView';
import { RockView } from '@/game/render/RockView';
import { CONSUMABLE_IDS } from '@/sim/systems/economy';

interface PrevState {
  x: number;
  y: number;
  angle: number;
}

const HUD_PUSH_MS = 75; // ~13 Hz HUD snapshot push (never per frame)
const MINI_PUSH_MS = 50; // ~20 Hz minimap snapshot (slightly smoother than HUD)

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
  private paused = false;
  private accumulatorMs = 0;
  private localId: PlayerId = 'p0';
  private camZoom = 1;
  private lastHudPushMs = 0;
  private lastMiniPushMs = 0;
  private quality: QualityLevel = 'high';
  private reducedMotion = false;
  private readonly offBus: Array<() => void> = [];

  private readonly boatViews = new Map<PlayerId, BoatView>();
  private readonly prev = new Map<PlayerId, PrevState>();
  private islandGfx: Phaser.GameObjects.Graphics | undefined;
  private sitesGfx: Phaser.GameObjects.Graphics | undefined;
  private dockGfx: Phaser.GameObjects.Graphics | undefined;
  private dockLabels: Phaser.GameObjects.Text[] = [];
  private rockView: RockView | undefined;

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

    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.offBus.push(bus.on('intent:startRound', () => this.beginRound()));
    this.offBus.push(bus.on('intent:requeue', () => this.beginRound()));
    this.offBus.push(bus.on('round:ended', () => this.endRound()));
    this.offBus.push(bus.on('intent:setQuality', ({ level }) => this.setQuality(level)));
    // Pause/resume (tab hidden on mobile). Reset the accumulator on resume so a
    // long pause never triggers a catch-up burst of steps.
    this.offBus.push(bus.on('intent:pause', () => (this.paused = true)));
    this.offBus.push(
      bus.on('intent:resume', () => {
        this.paused = false;
        this.accumulatorMs = 0;
      }),
    );
    // Screen shake on the big moments (skipped under reduced motion).
    this.offBus.push(
      bus.on('player:hit', ({ targetId }) => {
        if (this.running && targetId === this.localId) this.shake(220, 0.012);
      }),
    );
    this.offBus.push(bus.on('rock:found', () => this.shake(350, 0.008)));
    // Floating "+N" at the world position of a local gem pickup (juice).
    this.offBus.push(
      bus.on('gem:collected', ({ value, worldX, worldY }) => {
        if (this.running) this.spawnFloat(worldX, worldY, `+${value}`);
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputCtl.destroy();
      for (const off of this.offBus) off();
    });
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
    this.dockGfx = this.add.graphics().setDepth(0);
    this.dockLabels = DOCKS.map((d) =>
      this.add
        .text(d.x, d.y - 2, '$', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '32px',
          color: '#ffe49a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(1),
    );
    this.sitesGfx = this.add.graphics().setDepth(1);
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
    this.sitesGfx?.destroy();
    this.sitesGfx = undefined;
    this.dockGfx?.destroy();
    this.dockGfx = undefined;
    for (const l of this.dockLabels) l.destroy();
    this.dockLabels = [];
    this.rockView?.destroy();
    this.rockView = undefined;
  }

  /** Round decided (extraction or timeout): freeze the world but keep it on screen. */
  private endRound(): void {
    this.running = false;
    this.cameras.main.stopFollow();
  }

  private setQuality(level: QualityLevel): void {
    this.quality = level;
    for (const [id, bv] of this.boatViews) {
      bv.setWakeEnabled(this.wakeEnabledFor(id === this.localId));
    }
  }

  /** high = wake on every boat, medium = local boat only, low = none. */
  private wakeEnabledFor(isLocal: boolean): boolean {
    return this.quality === 'high' || (this.quality === 'medium' && isLocal);
  }

  private shake(durationMs: number, intensity: number): void {
    if (this.running && !this.reducedMotion) this.cameras.main.shake(durationMs, intensity);
  }

  // ---- main loop ----

  override update(time: number, delta: number): void {
    if (!this.running || this.paused) return;

    // Clamp the frame so a long stall can't trigger a step spiral.
    this.accumulatorMs += Math.min(delta, TICK.fixedDtMs * TICK.maxStepsPerFrame);

    // Sample once PER fixed step so one-shot commands (buy/use) apply exactly once.
    let steps = 0;
    while (this.accumulatorMs >= TICK.fixedDtMs && steps < TICK.maxStepsPerFrame) {
      this.snapshotPrev(this.model.getView());
      this.model.update(TICK.fixedDtMs, this.inputCtl.sample());
      this.accumulatorMs -= TICK.fixedDtMs;
      steps++;
    }

    const alpha = clamp(this.accumulatorMs / TICK.fixedDtMs, 0, 1);
    const view = this.model.getView();
    this.renderBoats(view, alpha, time);
    this.renderRock(view, alpha, time);
    this.drawDocks(view, time);
    this.drawSites(view, time);
    this.updateCamera(view);
    this.pushHud(view, time);
    this.pushMinimap(view, time);
  }

  private renderRock(view: WorldView, alpha: number, time: number): void {
    const rock = view.rock;
    if (!rock.found) {
      this.rockView?.setVisible(false);
      return;
    }
    if (!this.rockView) this.rockView = new RockView(this);
    this.rockView.setVisible(true);

    // While carried, track the carrier's interpolated render position for smoothness.
    let x = rock.x;
    let y = rock.y;
    if (rock.carrierId) {
      const cur = view.boats.find((b) => b.id === rock.carrierId);
      const p = this.prev.get(rock.carrierId);
      if (cur) {
        x = p ? lerp(p.x, cur.x, alpha) : cur.x;
        y = p ? lerp(p.y, cur.y, alpha) : cur.y;
      }
    }
    this.rockView.sync(x, y, time, rock.carrierId !== null);
  }

  /** Draw the black-market docks: a platform + a glowing extraction ring. The
   *  dock the local carrier is heading to is highlighted so "deliver here" reads. */
  private drawDocks(view: WorldView, time: number): void {
    const g = this.dockGfx;
    if (!g) return;
    g.clear();

    const local = this.findLocal(view);
    let targetIdx = -1;
    if (local?.carrying) {
      let bestD = Infinity;
      DOCKS.forEach((d, i) => {
        const dd = (d.x - local.x) ** 2 + (d.y - local.y) ** 2;
        if (dd < bestD) {
          bestD = dd;
          targetIdx = i;
        }
      });
    }

    const pulse = 1 + Math.sin(time * 0.005) * 0.06;
    DOCKS.forEach((d, i) => {
      const target = i === targetIdx;
      // extraction zone
      g.fillStyle(0xf0c24a, target ? 0.12 : 0.05);
      g.fillCircle(d.x, d.y, EXTRACT.dockRadius);
      g.lineStyle(target ? 5 : 3, target ? 0xffe49a : 0xf0c24a, target ? 0.95 : 0.55);
      g.strokeCircle(d.x, d.y, EXTRACT.dockRadius * (target ? pulse : 1));
      // platform (dark wood with gold trim)
      g.fillStyle(0x2e2013, 1);
      g.fillRoundedRect(d.x - 38, d.y - 38, 76, 76, 10);
      g.fillStyle(0x5a4326, 1);
      g.fillRoundedRect(d.x - 30, d.y - 30, 60, 60, 8);
      g.lineStyle(2, 0x2e2013, 0.7);
      for (let p = -19; p <= 19; p += 12) g.lineBetween(d.x - 30, d.y + p, d.x + 30, d.y + p);
      g.lineStyle(3, 0xf0c24a, 0.9);
      g.strokeRoundedRect(d.x - 30, d.y - 30, 60, 60, 8);
    });
  }

  /** Redraw dig-site markers (cheap: a handful of circles), pulsing while undug. */
  private drawSites(view: WorldView, time: number): void {
    const g = this.sitesGfx;
    if (!g) return;
    g.clear();
    const pulse = 1 + Math.sin(time * 0.004) * 0.08;
    for (const s of view.sites) {
      if (s.dug) {
        g.lineStyle(2, 0x2a4d57, 0.5);
        g.strokeCircle(s.x, s.y, DIG.radius * 0.45);
      } else {
        g.lineStyle(3, 0xefe3c6, 0.45);
        g.strokeCircle(s.x, s.y, DIG.radius * 0.6 * pulse);
        g.fillStyle(0xf0c24a, 0.9);
        g.fillCircle(s.x, s.y, 5);
      }
    }
  }

  // ---- rendering ----

  private renderBoats(view: WorldView, alpha: number, time: number): void {
    for (const boat of view.boats) {
      let bv = this.boatViews.get(boat.id);
      if (!bv) {
        bv = new BoatView(this, boat.color);
        bv.setWakeEnabled(this.wakeEnabledFor(boat.id === this.localId));
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
    const rock = view.rock;
    const carrier = rock.carrierId ? view.boats.find((b) => b.id === rock.carrierId) : undefined;
    uiStore.set({
      cash: local.cash,
      speedTier: local.speedTier,
      // Read the bar as full while a boost is actively firing, then refilling.
      boostCharge: local.boosting ? 1 : local.boostCharge,
      digProgress: local.digSiteId ? clamp(local.digMs / DIG.timeMs, 0, 1) : 0,
      tools: CONSUMABLE_IDS.map((id) => {
        const t = local.tools[id];
        return { id, count: t.count, ready: t.count > 0 && t.activeMsLeft === 0, activeMsLeft: t.activeMsLeft };
      }),
      carrying: local.carrying,
      rockFound: rock.found,
      carrierName: carrier?.name ?? null,
      dockArrowDeg: local.carrying ? this.bearingToNearestDock(local.x, local.y) : null,
      timeLeftMs: Math.max(0, this.roundConfig.durationMs - view.timeMs),
      heat: view.heat,
    });
  }

  private pushMinimap(view: WorldView, time: number): void {
    if (time - this.lastMiniPushMs < MINI_PUSH_MS) return;
    this.lastMiniPushMs = time;
    minimap.current = this.buildMinimap(view);
  }

  private buildMinimap(view: WorldView): MinimapSnapshot {
    const rock = view.rock;
    return {
      boats: view.boats.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        isLocal: b.id === this.localId,
        isBot: b.isBot,
        carrying: b.id === rock.carrierId,
        color: b.color,
      })),
      sites: view.sites.map((s) => ({ id: s.id, x: s.x, y: s.y, dug: s.dug })),
      docks: DOCKS.map((d) => ({ x: d.x, y: d.y })),
      // Show the Rock once surfaced, or hinted on the minimap late-game.
      rock:
        rock.found || view.rockHinted
          ? { x: rock.x, y: rock.y, carried: rock.carrierId !== null }
          : null,
      storm: null,
      worldW: view.width,
      worldH: view.height,
    };
  }

  /** Screen-space bearing (deg) from a point to the nearest dock; 0 = east, CW. */
  private bearingToNearestDock(x: number, y: number): number {
    let best = DOCKS[0];
    let bestD = Infinity;
    for (const d of DOCKS) {
      const dd = (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y);
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    const dock = best ?? { x, y };
    return (Math.atan2(dock.y - y, dock.x - x) * 180) / Math.PI;
  }

  private spawnFloat(x: number, y: number, text: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#f0c24a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.tweens.add({
      targets: label,
      y: y - 42,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.out',
      onComplete: () => label.destroy(),
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
