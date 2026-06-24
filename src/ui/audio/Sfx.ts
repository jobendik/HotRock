import { bus } from '@/core/EventBus';
import { settings } from '@/ui/settings';

/**
 * Tiny WebAudio synth so the slice has real audio feedback with ZERO assets
 * (the asset-based audio sprite is post-slice, P11). Subscribes to domain events
 * and plays short blips, gated by the sound setting + volume. Never throws into
 * gameplay; the AudioContext is created lazily after the first user gesture.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private readonly offs: Array<() => void> = [];

  start(): void {
    this.offs.push(
      bus.on('gem:collected', () => this.blip(880, 0.08, 'square', 0.12)),
      bus.on('dig:completed', () => this.blip(240, 0.12, 'sine', 0.16)),
      bus.on('rock:found', () => this.arp([523, 659, 784], 0.12)),
      bus.on('rock:picked', () => this.blip(680, 0.1, 'triangle', 0.16)),
      bus.on('rock:stolen', () => this.blip(150, 0.18, 'sawtooth', 0.2)),
      bus.on('player:hit', () => this.blip(95, 0.14, 'sawtooth', 0.2)),
      bus.on('rock:extracted', () => this.arp([659, 784, 1047], 0.16)),
      bus.on('round:ended', () => this.arp([523, 659, 784, 1047], 0.18)),
    );
  }

  stop(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  private ctxOrNull(): AudioContext | null {
    if (!settings.get().sound) return null;
    try {
      this.ctx = this.ctx ?? new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch (e) {
      console.warn('[sfx] audio unavailable', e);
      return null;
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctxOrNull();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const peak = Math.max(0.0001, vol * settings.get().volume);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  private arp(freqs: number[], step: number): void {
    freqs.forEach((f, i) => {
      window.setTimeout(() => this.blip(f, step, 'triangle', 0.16), i * step * 700);
    });
  }
}
