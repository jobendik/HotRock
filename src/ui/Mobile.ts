import { bus } from '@/core/EventBus';
import { uiStore } from '@/core/store';
import { settings } from '@/ui/settings';
import type { HudSnapshot } from '@/core/types';

/**
 * Mobile quality-of-life (DOM/browser APIs only — no game/sim imports):
 *  - **Wake lock** keeps the screen on during a round.
 *  - **Haptics** buzz on the local player's big moments — derived from the store
 *    snapshot (which is already the local view), so no contract change is needed.
 *  - **Pause/resume** on tab visibility, via the existing `intent:pause/resume`.
 * Everything is feature-detected and degrades silently off-platform/desktop.
 */
interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
}
interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export class Mobile {
  private wakeLock: WakeLockSentinelLike | null = null;
  private inRound = false;
  private prev: HudSnapshot | null = null;
  private readonly offs: Array<() => void> = [];

  start(): void {
    this.offs.push(
      bus.on('round:started', () => {
        this.inRound = true;
        this.prev = null;
        void this.acquireWake();
      }),
      bus.on('round:ended', () => {
        this.inRound = false;
        this.vibrate([40, 30, 80]);
        void this.releaseWake();
      }),
      uiStore.subscribe((s) => this.onSnapshot(s)),
    );
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.releaseWake();
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      bus.emit('intent:pause');
      void this.releaseWake();
    } else {
      bus.emit('intent:resume');
      if (this.inRound) void this.acquireWake();
    }
  };

  /** Buzz on local-player transitions read straight from the HUD snapshot. */
  private onSnapshot(s: HudSnapshot): void {
    const prev = this.prev;
    this.prev = s;
    if (!prev) return;
    if (!prev.carrying && s.carrying) this.vibrate(35); // grabbed the Rock
    else if (prev.carrying && !s.carrying) this.vibrate([60, 40, 70]); // rammed off it
    if (!prev.rockFound && s.rockFound) this.vibrate([20, 30, 20]); // it surfaced
  }

  private vibrate(pattern: number | number[]): void {
    if (!settings.get().sound) return; // honour the feedback toggle
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* unsupported / blocked — ignore */
      }
    }
  }

  private async acquireWake(): Promise<void> {
    const wl = (navigator as { wakeLock?: WakeLockLike }).wakeLock;
    if (!wl || this.wakeLock) return;
    try {
      this.wakeLock = await wl.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch (e) {
      console.warn('[mobile] wake lock unavailable', e);
    }
  }

  private async releaseWake(): Promise<void> {
    const wl = this.wakeLock;
    this.wakeLock = null;
    if (wl) {
      try {
        await wl.release();
      } catch {
        /* already released — ignore */
      }
    }
  }
}
