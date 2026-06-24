/**
 * Hot Rock — shared domain types.
 * Pure data only: NO Phaser, NO DOM imports. Importable by core, sim, game and ui.
 */

export type PlayerId = string;

export type ToolId = 'boost' | 'net' | 'smoke' | 'radar';
export type UpgradeId = 'speed' | 'boostRefill' | 'net' | 'smoke' | 'radar';
export type QualityLevel = 'low' | 'medium' | 'high';
export type ToastKind = 'info' | 'good' | 'bad' | 'epic';
export type HitReason = 'ram' | 'trap' | 'storm';

/** Reward revealed when a dig completes. */
export type DigReward =
  | { kind: 'none' }
  | { kind: 'gem'; value: number }
  | { kind: 'rock' } // the Hot Rock itself
  | { kind: 'trap' } // knockback + scatters a few gems for others
  | { kind: 'boost' }; // free boost refill

/** A single frame of player intent — produced by input, consumed by the sim, sent over the wire in MP. */
export interface InputFrame {
  seq: number; // monotonically increasing; used for netcode reconciliation
  joystick: { x: number; y: number }; // normalised, magnitude 0..1
  boost: boolean;
  dig: boolean;
  tool: boolean;
  useTool?: ToolId;
  buyUpgrade?: UpgradeId;
}

export interface RoundConfig {
  playerCount: number;
  botCount: number;
  durationMs: number;
}

/** Per-tool inventory/availability shown in the HUD. */
export interface ToolState {
  id: ToolId;
  count: number; // remaining one-shot charges (boost uses the charge meter instead)
  ready: boolean; // off-cooldown / usable now
}

/** UI-facing HUD snapshot. Pushed ~12–15Hz via the store — never every frame. */
export interface HudSnapshot {
  cash: number;
  speedTier: number;
  boostCharge: number; // 0..1
  tools: ToolState[];
  carrying: boolean; // is the LOCAL player holding the Rock?
  timeLeftMs: number;
  heat: number; // 0..1
}

export interface PlayerResult {
  id: PlayerId;
  name: string;
  isBot: boolean;
  cash: number;
  digs: number;
  steals: number;
  carrierMs: number; // total time spent holding the Rock
  extracted: boolean; // did this player win?
}

/* ---- minimap snapshot: read each rAF by the DOM minimap (still no Phaser) ---- */
export interface MiniBoat {
  id: PlayerId;
  x: number;
  y: number;
  isLocal: boolean;
  isBot: boolean;
  carrying: boolean;
  color: string;
}
export interface MiniSite { id: string; x: number; y: number; dug: boolean }
export interface MiniDock { x: number; y: number }
export interface MiniRock { x: number; y: number; carried: boolean }
export interface MiniStorm { x: number; y: number; radius: number }
export interface MinimapSnapshot {
  boats: MiniBoat[];
  sites: MiniSite[];
  docks: MiniDock[];
  rock: MiniRock | null;
  storm: MiniStorm | null;
  worldW: number;
  worldH: number;
}
