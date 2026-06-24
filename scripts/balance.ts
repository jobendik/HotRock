/**
 * Hot Rock — balance harness. Runs many full rounds headlessly (the pure GameSim
 * + the same BotAI the client uses; the "human" boat is driven by the bot brain
 * too, i.e. a skilled player), and reports the metrics that tell us whether the
 * hot-potato is FUN: can a carrier ever get away and deliver, or does the lobby
 * just bounce the Rock around forever?
 *
 *   npm run balance            # default rounds
 *   ROUNDS=300 npm run balance # more samples
 *
 * No Phaser/DOM — runs under vite-node (resolves the @/ alias from vite.config).
 */
import type { EventSink, Events } from '@/core/events';
import type { InputFrame, PlayerId } from '@/core/types';
import { ROUND } from '@/config/balance';
import { Rng } from '@/core/rng';
import { GameSim } from '@/sim/GameSim';
import { decide } from '@/sim/BotAI';

const DT_MS = 1000 / 60;
const ROUNDS = Number(process.env.ROUNDS ?? 150);
const BOT_COUNT = 8;

/** Counts the domain events we care about + remembers the round outcome. */
class Probe implements EventSink {
  steals = 0;
  drops = 0;
  extracted = false;
  winnerId: PlayerId | null = null;
  foundMs = -1;
  nowMs = 0;

  emit(name: keyof Events, payload?: unknown): void {
    switch (name) {
      case 'rock:stolen':
        this.steals++;
        break;
      case 'rock:dropped':
        this.drops++;
        break;
      case 'rock:extracted':
        this.extracted = true;
        break;
      case 'rock:found':
        if (this.foundMs < 0) this.foundMs = this.nowMs;
        break;
      case 'round:ended':
        this.winnerId = (payload as { winnerId: PlayerId | null }).winnerId;
        break;
      default:
        break;
    }
  }
}

interface RoundResult {
  extracted: boolean;
  durationSec: number;
  foundSec: number;
  steals: number;
  drops: number;
  /** Number of distinct carry segments (how many times someone held it). */
  handoffs: number;
  /** Longest single uninterrupted hold (s) — can anyone keep it long enough to run? */
  maxHoldSec: number;
  /** Total time the Rock was held vs loose. */
  carriedSec: number;
  winnerIsHuman: boolean;
}

function runRound(seed: number): RoundResult {
  const probe = new Probe();
  const sim = new GameSim(probe);
  sim.start(seed, { playerCount: 1, botCount: BOT_COUNT, durationMs: ROUND.durationMs });
  const rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
  const inputs = new Map<PlayerId, InputFrame>();
  const maxSteps = Math.ceil(ROUND.durationMs / DT_MS) + 30;

  let carrier: PlayerId | null = null;
  let segStartMs = 0;
  let handoffs = 0;
  let maxHoldMs = 0;
  let carriedMs = 0;

  for (let i = 0; i < maxSteps && !sim.getState().over; i++) {
    const st = sim.getState();
    probe.nowMs = st.timeMs;
    for (const b of st.boats) inputs.set(b.id, decide(st, b, rng));
    sim.step(DT_MS, inputs);

    const next = sim.getState().rock.carrierId;
    if (next !== carrier) {
      if (carrier !== null) {
        const held = sim.getState().timeMs - segStartMs;
        carriedMs += held;
        if (held > maxHoldMs) maxHoldMs = held;
      }
      if (next !== null) {
        handoffs++;
        segStartMs = sim.getState().timeMs;
      }
      carrier = next;
    }
  }
  if (carrier !== null) {
    const held = sim.getState().timeMs - segStartMs;
    carriedMs += held;
    if (held > maxHoldMs) maxHoldMs = held;
  }

  const durationMs = sim.getState().timeMs;
  return {
    extracted: probe.extracted,
    durationSec: durationMs / 1000,
    foundSec: probe.foundMs < 0 ? durationMs / 1000 : probe.foundMs / 1000,
    steals: probe.steals,
    drops: probe.drops,
    handoffs,
    maxHoldSec: maxHoldMs / 1000,
    carriedSec: carriedMs / 1000,
    winnerIsHuman: probe.winnerId === 'p0',
  };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function pct(n: number, total: number): string {
  return `${((100 * n) / total).toFixed(1)}%`;
}
function f(n: number): string {
  return n.toFixed(2);
}

const results: RoundResult[] = [];
for (let s = 1; s <= ROUNDS; s++) results.push(runRound(s));

const extracted = results.filter((r) => r.extracted).length;
const humanWins = results.filter((r) => r.winnerIsHuman).length;

console.log(`\nHot Rock — balance over ${ROUNDS} rounds (9 boats, all BotAI)\n`);
console.log(`  Extraction (delivered)   ${pct(extracted, ROUNDS)}   (rest = time ran out)`);
console.log(`  Human (p0) win rate      ${pct(humanWins, ROUNDS)}   (even share ≈ ${pct(1, 9)})`);
console.log(`  Round duration           ${f(mean(results.map((r) => r.durationSec)))} s avg`);
console.log(`  Rock found at            ${f(mean(results.map((r) => r.foundSec)))} s avg`);
console.log(`  Steals / round           ${f(mean(results.map((r) => r.steals)))} avg`);
console.log(`  Drops (rams) / round     ${f(mean(results.map((r) => r.drops)))} avg`);
console.log(`  Hand-offs / round        ${f(mean(results.map((r) => r.handoffs)))} avg  (carry segments)`);
console.log(`  Longest single hold      ${f(mean(results.map((r) => r.maxHoldSec)))} s avg, ${f(Math.max(...results.map((r) => r.maxHoldSec)))} s max`);
console.log(`  Rock carried (vs loose)  ${f(mean(results.map((r) => r.carriedSec)))} s avg per round`);
console.log('');
console.log('  Healthy target: extraction ~80–98%, hand-offs ~8–20, rounds ~50–90 s.');
console.log('  Bad signs: ~0% extraction (nobody can deliver) or 50+ hand-offs (chaotic dogpile).');
console.log('');
