import Phaser from 'phaser';

/**
 * Phaser.Game configuration. Phaser does rendering/camera/particles/input only —
 * its built-in physics is OFF because the simulation uses its own portable circle
 * physics so the exact same rules can run on an authoritative server (ARCHITECTURE
 * ADR-2). Scale RESIZE keeps the canvas filling the viewport on desktop and mobile.
 *
 * Rendering colours (not gameplay numbers) live here / in the render layer, never
 * in balance.ts.
 */

/** Open-water background fill behind the world. */
export const WATER_COLOR = 0x0a3b4a;

export function createGameConfig(
  parent: string,
  scene: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: WATER_COLOR,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    render: { antialias: true, powerPreference: 'high-performance' },
    // No Arcade/Matter physics — see ADR-2.
    scene,
  };
}
