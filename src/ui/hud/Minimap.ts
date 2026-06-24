import { minimap } from '@/core/store';
import { TAU } from '@/core/math';

/**
 * Corner minimap — a DOM `<canvas>` (NOT Phaser) that reads the shared
 * `minimap.current` snapshot each rAF and draws docks, dig sites, and boats.
 * Everything it needs is in the snapshot, so it imports no game/sim code.
 */
const W = 168;
const H = 126;

export class Minimap {
  readonly el: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;
  private raf = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'minimap';
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    this.el.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Minimap: 2D canvas context unavailable');
    this.ctx = ctx;
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  start(): void {
    const loop = (): void => {
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6, 21, 26, 0.82)';
    ctx.fillRect(0, 0, W, H);

    const snap = minimap.current;
    if (!snap) return;
    const sx = W / snap.worldW;
    const sy = H / snap.worldH;

    // dig sites
    for (const s of snap.sites) {
      ctx.fillStyle = s.dug ? 'rgba(189, 176, 148, 0.22)' : 'rgba(239, 227, 198, 0.7)';
      ctx.beginPath();
      ctx.arc(s.x * sx, s.y * sy, 1.4, 0, TAU);
      ctx.fill();
    }

    // docks — the delivery points; outlined gold squares so they stand out
    for (const d of snap.docks) {
      const dx = d.x * sx;
      const dy = d.y * sy;
      ctx.fillStyle = '#ffe49a';
      ctx.fillRect(dx - 3, dy - 3, 6, 6);
      ctx.strokeStyle = '#06151a';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx - 3, dy - 3, 6, 6);
    }

    // boats (local drawn last + ringed so it's always readable)
    for (const b of snap.boats) {
      if (b.isLocal) continue;
      this.dot(b.x * sx, b.y * sy, b.color, 2.2, false);
    }
    const me = snap.boats.find((b) => b.isLocal);
    if (me) this.dot(me.x * sx, me.y * sy, me.color, 3, true);

    // the Rock — a pulsing gold beacon, always visible once surfaced
    if (snap.rock) {
      const t = (Date.now() % 1000) / 1000;
      const r = 3 + Math.sin(t * Math.PI * 2) * 1.5;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(snap.rock.x * sx, snap.rock.y * sy, r, 0, TAU);
      ctx.fill();
    }
  }

  private dot(x: number, y: number, color: string, r: number, ring: boolean): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (ring) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
