import { clamp, TAU } from '@/core/math';
import { BOAT, WORLD } from '@/config/balance';
import type { Boat, Island } from '@/sim/WorldState';

/**
 * Portable circle physics for the simulation. Deliberately NOT Phaser Arcade —
 * the sim must run unchanged on an authoritative server (ARCHITECTURE ADR-2).
 * All functions mutate the passed entities in place (no per-step allocation).
 */

/** Rotate `current` toward `target` (radians) by at most `maxStep`, shortest arc. */
export function rotateToward(current: number, target: number, maxStep: number): number {
  let d = (target - current) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  if (d > maxStep) d = maxStep;
  else if (d < -maxStep) d = -maxStep;
  return current + d;
}

/** Resolve a boat overlapping an island: push it to the surface, kill inward velocity. */
export function collideBoatIsland(boat: Boat, island: Island): void {
  const dx = boat.x - island.x;
  const dy = boat.y - island.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const minDist = BOAT.radius + island.radius;
  if (d >= minDist) return;
  const nx = dx / d;
  const ny = dy / d;
  boat.x = island.x + nx * minDist;
  boat.y = island.y + ny * minDist;
  const vn = boat.vx * nx + boat.vy * ny; // velocity component along the normal
  if (vn < 0) {
    boat.vx -= vn * nx;
    boat.vy -= vn * ny;
  }
}

/** Separate two overlapping boats by pushing each half the overlap apart. */
export function separateBoats(a: Boat, b: Boat): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const minDist = BOAT.radius * 2;
  if (d >= minDist) return;
  const push = (minDist - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
}

/** Soft walls: a spring nudge within the padding band, plus a hard clamp at the very edge. */
export function applySoftWalls(boat: Boat, dt: number): void {
  const pad = WORLD.wallPadding;
  const k = WORLD.wallSpring;
  const r = BOAT.radius;
  if (boat.x < pad) boat.vx += (pad - boat.x) * k * dt;
  else if (boat.x > WORLD.width - pad) boat.vx -= (boat.x - (WORLD.width - pad)) * k * dt;
  if (boat.y < pad) boat.vy += (pad - boat.y) * k * dt;
  else if (boat.y > WORLD.height - pad) boat.vy -= (boat.y - (WORLD.height - pad)) * k * dt;
  boat.x = clamp(boat.x, r, WORLD.width - r);
  boat.y = clamp(boat.y, r, WORLD.height - r);
}

/** Current speed magnitude (px/s). */
export function speedOf(boat: Boat): number {
  return Math.hypot(boat.vx, boat.vy);
}
