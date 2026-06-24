import { bus } from '@/core/EventBus';
import type { InputFrame } from '@/core/types';
import { KEY_BINDINGS } from '@/config/controls';

/**
 * Unifies desktop keyboard and the DOM virtual joystick into one `InputFrame`
 * per frame. Keyboard is read from `window` by `KeyboardEvent.code` (matching
 * config/controls); the mobile joystick + buttons arrive via `intent:joystick`
 * / `intent:action` on the bus. The two are summed so either input works, and
 * both work together. Game-layer only — never imports ui/sim.
 */
const GAME_CODES = new Set<string>(Object.values(KEY_BINDINGS).flat());

export class InputController {
  private readonly pressed = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private boostHeld = false;
  private toolHeld = false;
  private seq = 0;
  private readonly offJoy: () => void;
  private readonly offAct: () => void;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.pressed.add(e.code);
    if (GAME_CODES.has(e.code)) e.preventDefault(); // stop space/arrows scrolling the page
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.offJoy = bus.on('intent:joystick', ({ x, y }) => {
      this.joyX = x;
      this.joyY = y;
    });
    this.offAct = bus.on('intent:action', ({ action, down }) => {
      if (action === 'boost') this.boostHeld = down;
      else if (action === 'tool') this.toolHeld = down;
      // 'dig' is auto-prompt + hold, handled by the digging system in M2.
    });
  }

  /** Build this frame's input. Magnitude is clamped to 1 so diagonals aren't faster. */
  sample(): InputFrame {
    let kx = 0;
    let ky = 0;
    if (this.anyDown(KEY_BINDINGS.left)) kx -= 1;
    if (this.anyDown(KEY_BINDINGS.right)) kx += 1;
    if (this.anyDown(KEY_BINDINGS.up)) ky -= 1;
    if (this.anyDown(KEY_BINDINGS.down)) ky += 1;

    let x = kx + this.joyX;
    let y = ky + this.joyY;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }

    return {
      seq: this.seq++,
      joystick: { x, y },
      boost: this.boostHeld || this.anyDown(KEY_BINDINGS.boost),
      dig: false,
      tool: this.toolHeld || this.anyDown(KEY_BINDINGS.tool),
    };
  }

  private anyDown(codes: readonly string[]): boolean {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.offJoy();
    this.offAct();
    this.pressed.clear();
  }
}
