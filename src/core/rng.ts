/**
 * Deterministic, seedable PRNG (mulberry32). Serializable via {@link Rng.getState}
 * / {@link Rng.setState} so a round can live in the sim's WorldState and be
 * reproduced exactly — essential for tests and for server-authoritative netcode.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }

  /** Float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability `p` (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    const value = arr[this.int(arr.length)];
    if (value === undefined) throw new Error('Rng.pick: empty array');
    return value;
  }

  /** Weighted pick from `{ weight, value }` entries. */
  weighted<T>(entries: ReadonlyArray<{ weight: number; value: T }>): T {
    let total = 0;
    for (const e of entries) total += e.weight;
    let r = this.next() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r < 0) return e.value;
    }
    const last = entries[entries.length - 1];
    if (!last) throw new Error('Rng.weighted: no entries');
    return last.value;
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const a = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = a;
    }
    return arr;
  }

  /** Serialise the internal state (for replays / network sync). */
  getState(): number {
    return this.s >>> 0;
  }

  /** Restore a previously serialised state. */
  setState(state: number): void {
    this.s = state >>> 0;
  }

  /** Derive an independent stream from this one. */
  fork(): Rng {
    return new Rng((this.int(0xffffffff) ^ 0x9e3779b9) >>> 0);
  }
}
