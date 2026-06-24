import type { Events } from '@/core/events';

type Handler<T> = (payload: T) => void;

/** Event names whose payload is `void` (can be emitted with no second argument). */
type VoidKeys = { [K in keyof Events]: Events[K] extends void ? K : never }[keyof Events];

/**
 * The ONLY channel between the UI layer (DOM) and the game layer (Phaser/sim).
 * Strongly typed against {@link Events}. Neither layer imports the other; both
 * import this. In multiplayer the server simply becomes another emitter.
 */
export class EventBus {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => {
      this.handlers.get(event)?.delete(handler as Handler<never>);
    };
  }

  /** Subscribe for a single emission. Returns an unsubscribe function. */
  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  emit<K extends VoidKeys>(event: K): void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
  emit(event: keyof Events, payload?: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy so a handler may (un)subscribe during dispatch without surprises.
    for (const handler of [...set]) (handler as Handler<unknown>)(payload);
  }

  /** Remove every subscription (e.g. on teardown / between rounds if desired). */
  clear(): void {
    this.handlers.clear();
  }
}

/** App-wide singleton bus. */
export const bus = new EventBus();
