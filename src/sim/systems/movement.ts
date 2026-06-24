import type { InputFrame, PlayerId } from '@/core/types';
import { clamp } from '@/core/math';
import { BOAT, BOOST, MOVEMENT, SPEED_TIER_BONUS, ROCK } from '@/config/balance';
import type { Boat, WorldState } from '@/sim/WorldState';
import { rotateToward, collideBoatIsland, separateBoats, applySoftWalls } from '@/sim/physics';

/**
 * Boat movement: arcade steering with momentum and drift. The joystick sets a
 * desired heading the boat turns toward (angular lerp); thrust is applied along
 * the facing, scaled by stick magnitude; drag bleeds speed so idling coasts to a
 * stop. Pure over `WorldState` — identical on client and server.
 */

const DEG2RAD = Math.PI / 180;
const NEUTRAL: InputFrame = {
  seq: 0,
  joystick: { x: 0, y: 0 },
  boost: false,
  dig: false,
  tool: false,
};

export function stepMovement(
  state: WorldState,
  inputs: Map<PlayerId, InputFrame>,
  dt: number,
): void {
  for (const boat of state.boats) {
    updateBoat(boat, inputs.get(boat.id) ?? NEUTRAL, dt);
  }

  // Resolve collisions after integration so positions are consistent.
  for (const boat of state.boats) {
    for (const island of state.islands) collideBoatIsland(boat, island);
    applySoftWalls(boat, dt);
  }
  const boats = state.boats;
  for (let i = 0; i < boats.length; i++) {
    const a = boats[i];
    if (!a) continue;
    for (let j = i + 1; j < boats.length; j++) {
      const b = boats[j];
      if (b) separateBoats(a, b);
    }
  }
}

function updateBoat(boat: Boat, input: InputFrame, dt: number): void {
  updateBoost(boat, input, dt);

  const tierMul = 1 + boat.speedTier * SPEED_TIER_BONUS;
  const boostMul = boat.boosting ? BOOST.multiplier : 1;
  const carryMul = boat.carrying ? ROCK.carrierSpeedMult : 1; // small tax for holding the Rock
  const maxSpeed = BOAT.maxSpeed * tierMul * boostMul * carryMul;
  const accel = BOAT.acceleration * tierMul * boostMul;
  const turnStep = BOAT.turnRateDegPerSec * DEG2RAD * dt;

  const jx = input.joystick.x;
  const jy = input.joystick.y;
  const mag = clamp(Math.hypot(jx, jy), 0, 1);
  const prevAngle = boat.angle;

  const thrusting = mag > MOVEMENT.joystickDeadzone;
  if (thrusting) {
    const desired = Math.atan2(jy, jx);
    boat.angle = rotateToward(boat.angle, desired, turnStep);
    boat.vx += Math.cos(boat.angle) * accel * mag * dt;
    boat.vy += Math.sin(boat.angle) * accel * mag * dt;
  }
  boat.angularVel = (boat.angle - prevAngle) / dt;

  // Light drag while steering (momentum), strong drag when the stick is released
  // so the boat brakes to a stop and you can park on a dig site.
  const dragPerSec = thrusting ? BOAT.dragActive : BOAT.dragIdle;
  const drag = Math.pow(dragPerSec, dt);
  boat.vx *= drag;
  boat.vy *= drag;

  const sp = Math.hypot(boat.vx, boat.vy);
  if (sp > maxSpeed) {
    const s = maxSpeed / sp;
    boat.vx *= s;
    boat.vy *= s;
  }

  // Integrate thrust + (unclamped) knockback impulse, then decay the impulse.
  boat.x += (boat.vx + boat.knockVx) * dt;
  boat.y += (boat.vy + boat.knockVy) * dt;
  const knockDecay = Math.pow(BOAT.knockbackFriction, dt);
  boat.knockVx *= knockDecay;
  boat.knockVy *= knockDecay;
}

/** Boost meter: recharges while idle; firing spends the full meter for a fixed burst. */
function updateBoost(boat: Boat, input: InputFrame, dt: number): void {
  if (boat.boosting) {
    boat.boostMsLeft -= dt * 1000;
    if (boat.boostMsLeft <= 0) {
      boat.boosting = false;
      boat.boostMsLeft = 0;
    }
    return;
  }
  boat.boostCharge = clamp(boat.boostCharge + BOOST.rechargePerSec * dt, 0, 1);
  if (input.boost && boat.boostCharge >= 1) {
    boat.boosting = true;
    boat.boostMsLeft = BOOST.durationMs;
    boat.boostCharge = 0;
  }
}
