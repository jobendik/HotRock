import Phaser from 'phaser';

/**
 * Programmatic placeholder art so the slice runs with NO external assets. Boats
 * are drawn white and tinted per-player at runtime; the wake is a soft additive
 * blob. Generated once in BootScene; replaced by a real atlas post-slice (P11).
 */
export const TEX = {
  boat: 'tex-boat',
  wake: 'tex-wake',
  rock: 'tex-rock',
  glow: 'tex-glow',
} as const;

export function generateTextures(scene: Phaser.Scene): void {
  generateBoat(scene);
  generateWake(scene);
  generateRock(scene);
  generateGlow(scene);
}

/** A boat hull pointing +x (so sprite rotation == sim angle). White → tintable. */
function generateBoat(scene: Phaser.Scene): void {
  const w = 56;
  const h = 40;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.lineStyle(3, 0x10303a, 1);
  g.beginPath();
  g.moveTo(54, h / 2); // bow tip (front, right)
  g.lineTo(30, 5);
  g.lineTo(9, 9); // stern top
  g.lineTo(9, h - 9); // stern bottom
  g.lineTo(30, h - 5);
  g.closePath();
  g.fillPath();
  g.strokePath();
  // cabin — lighter so it tints to a lighter shade of the player colour
  g.fillStyle(0xa9dcea, 1);
  g.fillRoundedRect(15, 13, 18, 14, 3);
  g.generateTexture(TEX.boat, w, h);
  g.destroy();
}

/** Soft round wake puff: stacked translucent circles fake a radial falloff. */
function generateWake(scene: Phaser.Scene): void {
  const r = 16;
  const g = scene.add.graphics();
  for (let i = r; i > 0; i--) {
    g.fillStyle(0xcfeefb, 0.06);
    g.fillCircle(r, r, i);
  }
  g.generateTexture(TEX.wake, r * 2, r * 2);
  g.destroy();
}

/** The Rock — a faceted diamond, drawn light so it reads against the glow. */
function generateRock(scene: Phaser.Scene): void {
  const s = 26;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.lineStyle(2, 0x6fd0ff, 0.9);
  g.beginPath();
  g.moveTo(s / 2, 2); // top
  g.lineTo(s - 2, s * 0.42);
  g.lineTo(s / 2, s - 2); // bottom
  g.lineTo(2, s * 0.42);
  g.closePath();
  g.fillPath();
  g.strokePath();
  // facet lines
  g.lineStyle(1, 0x9fe0ff, 0.8);
  g.lineBetween(2, s * 0.42, s - 2, s * 0.42);
  g.lineBetween(s / 2, 2, s / 2, s - 2);
  g.generateTexture(TEX.rock, s, s);
  g.destroy();
}

/** Soft white radial glow, tinted at runtime for the carrier beam/pillar. */
function generateGlow(scene: Phaser.Scene): void {
  const r = 48;
  const g = scene.add.graphics();
  for (let i = r; i > 0; i--) {
    g.fillStyle(0xffffff, 0.035);
    g.fillCircle(r, r, i);
  }
  g.generateTexture(TEX.glow, r * 2, r * 2);
  g.destroy();
}
