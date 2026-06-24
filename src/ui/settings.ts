import { bus } from '@/core/EventBus';
import { clamp } from '@/core/math';
import type { Settings } from '@/core/types';

/**
 * Persisted user settings (localStorage). On change it saves and re-broadcasts
 * the matching `intent:*` so the game (quality) and SFX (sound/volume) react via
 * the same event contract. Pure DOM/storage — no game/sim imports.
 */
const KEY = 'hotrock.settings';
const DEFAULTS: Settings = { sound: true, volume: 0.7, quality: 'high' };

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();
let state: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : DEFAULTS.sound,
      volume: clamp(typeof p.volume === 'number' ? p.volume : DEFAULTS.volume, 0, 1),
      quality:
        p.quality === 'low' || p.quality === 'medium' || p.quality === 'high'
          ? p.quality
          : DEFAULTS.quality,
    };
  } catch (e) {
    console.warn('[settings] load failed; using defaults', e);
    return { ...DEFAULTS };
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[settings] save failed', e);
  }
}

export const settings = {
  get(): Settings {
    return state;
  },
  set(patch: Partial<Settings>): void {
    const prev = state;
    state = { ...state, ...patch };
    persist();
    if (patch.sound !== undefined && patch.sound !== prev.sound) {
      bus.emit('intent:toggleSound', { on: state.sound });
    }
    if (patch.volume !== undefined && patch.volume !== prev.volume) {
      bus.emit('intent:setVolume', { value: state.volume });
    }
    if (patch.quality !== undefined && patch.quality !== prev.quality) {
      bus.emit('intent:setQuality', { level: state.quality });
    }
    for (const l of [...listeners]) l(state);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
