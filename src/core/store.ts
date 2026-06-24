import type { HudSnapshot, MinimapSnapshot } from '@/core/types';

export type Listener<T> = (state: T) => void;

export interface Store<T> {
  get(): T;
  /** Shallow-merge a partial update and notify subscribers. */
  set(patch: Partial<T>): void;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: Listener<T>): () => void;
}

/** Minimal reactive store. UI components subscribe; the game pushes patches. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      for (const listener of [...listeners]) listener(state);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * UI-facing HUD state. The game pushes patches at ~12–15Hz (never per frame).
 * UI screens/HUD subscribe and re-render on change.
 */
export const uiStore = createStore<HudSnapshot>({
  cash: 0,
  speedTier: 0,
  boostCharge: 1,
  digProgress: 0,
  tools: [],
  carrying: false,
  rockFound: false,
  carrierName: null,
  dockArrowDeg: null,
  timeLeftMs: 0,
  heat: 0,
});

/**
 * Shared minimap snapshot, kept OUT of the store so it can be updated cheaply
 * every frame. The game writes `minimap.current`; the DOM minimap reads it each rAF.
 */
export const minimap: { current: MinimapSnapshot | null } = { current: null };
