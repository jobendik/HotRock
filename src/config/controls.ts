import type { ToolId } from '@/core/types';

/**
 * Desktop keyboard bindings. Values are `KeyboardEvent.code` so they are
 * layout-independent. Mobile uses the DOM virtual joystick + buttons, which emit
 * `intent:joystick` / `intent:action` instead (see ARCHITECTURE §5 input flow).
 */
export const KEY_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  boost: ['Space', 'ShiftLeft', 'ShiftRight'],
  tool: ['KeyE'],
} as const satisfies Record<string, readonly string[]>;

export type ControlAction = keyof typeof KEY_BINDINGS;

/** Number-row hotkeys to fire a specific tool directly (desktop convenience). */
export const TOOL_HOTKEYS: Readonly<Record<string, ToolId>> = {
  Digit1: 'boost',
  Digit2: 'net',
  Digit3: 'smoke',
  Digit4: 'radar',
};
