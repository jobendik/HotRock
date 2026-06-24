/**
 * CrazyGames SDK adapter — the platform leaf (wired ONLY by main.ts).
 *
 * On crazygames.com the SDK is present on `window.CrazyGames`. Anywhere else
 * (local dev, CI, Vitest) we fall back to a no-op so gameplay is NEVER gated on
 * the platform — see CONVENTIONS ("platform must never block gameplay"). Every
 * call is guarded; nothing here is allowed to throw into the game loop.
 *
 * M0 ships the seam + no-op fallback. The ad call-sites land in M6.
 */

export type AdType = 'midgame' | 'rewarded';

export interface PlatformAdapter {
  /** True when the real CrazyGames SDK is driving (false = no-op fallback). */
  readonly available: boolean;
  /** Load + initialise the SDK. Always resolves, even when the SDK is absent. */
  init(): Promise<void>;
  /** Mark the start of active gameplay (mutes site music, pauses banners…). */
  gameplayStart(): void;
  /** Mark gameplay paused/stopped (menus, results). */
  gameplayStop(): void;
  /** A natural break the platform may use for a banner/refresh moment. */
  happytime(): void;
  /**
   * Request an ad. Resolves `true` when a rewarded ad completed (or a midgame
   * break finished), `false` when a rewarded ad was not earned. Never rejects.
   */
  requestAd(type: AdType): Promise<boolean>;
}

/* ---- Minimal shape of the v3 SDK bits we touch (kept local; no `any`). ---- */
interface CrazySdk {
  init?: () => Promise<void> | void;
  game?: {
    gameplayStart?: () => void;
    gameplayStop?: () => void;
    happytime?: () => void;
  };
  ad?: {
    requestAd?: (
      type: AdType,
      callbacks?: { adFinished?: () => void; adError?: (e: unknown) => void },
    ) => void;
  };
}

function readSdk(): CrazySdk | null {
  const w = globalThis as { CrazyGames?: { SDK?: unknown } };
  const sdk = w.CrazyGames?.SDK;
  return sdk && typeof sdk === 'object' ? (sdk as CrazySdk) : null;
}

/** Used in local dev / tests / non-CrazyGames hosting. Does nothing, rewards optimistically. */
class NoopPlatform implements PlatformAdapter {
  readonly available = false;
  init(): Promise<void> {
    return Promise.resolve();
  }
  gameplayStart(): void {}
  gameplayStop(): void {}
  happytime(): void {}
  requestAd(_type: AdType): Promise<boolean> {
    // No platform → grant the reward so local play isn't penalised by missing ads.
    return Promise.resolve(true);
  }
}

/** Drives the real SDK when hosted on CrazyGames. Every call is guarded. */
class CrazyGamesPlatform implements PlatformAdapter {
  readonly available = true;
  constructor(private readonly sdk: CrazySdk) {}

  async init(): Promise<void> {
    try {
      await this.sdk.init?.();
    } catch (e) {
      console.warn('[platform] SDK init failed; continuing without it.', e);
    }
  }

  gameplayStart(): void {
    this.guard(() => this.sdk.game?.gameplayStart?.());
  }
  gameplayStop(): void {
    this.guard(() => this.sdk.game?.gameplayStop?.());
  }
  happytime(): void {
    this.guard(() => this.sdk.game?.happytime?.());
  }

  requestAd(type: AdType): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ad = this.sdk.ad;
        if (!ad?.requestAd) {
          resolve(type !== 'rewarded');
          return;
        }
        ad.requestAd(type, {
          adFinished: () => resolve(true),
          adError: (e) => {
            console.warn('[platform] ad error', e);
            resolve(type !== 'rewarded'); // midgame break is "done"; rewarded is not earned
          },
        });
      } catch (e) {
        console.warn('[platform] requestAd threw', e);
        resolve(type !== 'rewarded');
      }
    });
  }

  private guard(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.warn('[platform] SDK call failed', e);
    }
  }
}

/** Pick the real adapter when the SDK is present, otherwise the no-op fallback. */
export function createPlatform(): PlatformAdapter {
  const sdk = readSdk();
  return sdk ? new CrazyGamesPlatform(sdk) : new NoopPlatform();
}
