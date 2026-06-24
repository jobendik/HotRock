import { bus } from '@/core/EventBus';
import type { InputFrame, UpgradeId, ToolId } from '@/core/types';
import { KEY_BINDINGS, TOOL_HOTKEYS } from '@/config/controls';

/**
 * Unifies desktop keyboard and the DOM virtual joystick into one `InputFrame`
 * per fixed step. Continuous state (steering, boost) is read live; one-shot
 * commands (buy upgrade, use tool) are queued and drained one-per-sample so each
 * is applied to exactly one sim step — matching how the server consumes one
 * input per tick. Game-layer only — never imports ui/sim.
 */
const GAME_CODES = new Set<string>(Object.values(KEY_BINDINGS).flat());

interface Command {
  buyUpgrade?: UpgradeId;
  useTool?: ToolId;
}

export class InputController {
  private readonly pressed = new Set<string>();
  private readonly commands: Command[] = [];
  private joyX = 0;
  private joyY = 0;
  private boostHeld = false;
  private toolHeld = false;
  private seq = 0;
  private readonly offs: Array<() => void> = [];

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.pressed.has(e.code)) {
      const tool = TOOL_HOTKEYS[e.code];
      if (tool && tool !== 'boost') this.commands.push({ useTool: tool });
    }
    this.pressed.add(e.code);
    if (GAME_CODES.has(e.code)) e.preventDefault();
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.offs.push(
      bus.on('intent:joystick', ({ x, y }) => {
        this.joyX = x;
        this.joyY = y;
      }),
      bus.on('intent:action', ({ action, down }) => {
        if (action === 'boost') this.boostHeld = down;
        else if (action === 'tool') this.toolHeld = down;
      }),
      bus.on('intent:buyUpgrade', ({ id }) => this.commands.push({ buyUpgrade: id })),
      bus.on('intent:useTool', ({ id }) => this.commands.push({ useTool: id })),
    );
  }

  /** Build one fixed step's input. Magnitude clamped to 1 so diagonals aren't faster. */
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

    const frame: InputFrame = {
      seq: this.seq++,
      joystick: { x, y },
      boost: this.boostHeld || this.anyDown(KEY_BINDINGS.boost),
      dig: false,
      tool: this.toolHeld || this.anyDown(KEY_BINDINGS.tool),
    };
    const cmd = this.commands.shift();
    if (cmd?.buyUpgrade) frame.buyUpgrade = cmd.buyUpgrade;
    if (cmd?.useTool) frame.useTool = cmd.useTool;
    return frame;
  }

  private anyDown(codes: readonly string[]): boolean {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    for (const off of this.offs) off();
    this.pressed.clear();
    this.commands.length = 0;
  }
}
