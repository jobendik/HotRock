import type {
  PlayerId, ToolId, UpgradeId, QualityLevel, ToastKind, HitReason,
  DigReward, ToolState, PlayerResult, MinimapSnapshot,
} from '@/core/types';

/**
 * THE CONTRACT between the UI layer (DOM) and the game layer (Phaser/sim).
 *  - `intent:*`  = UI  -> game   (player wants something)
 *  - everything else = game -> UI (something happened)
 *
 * Neither layer imports the other. Both import ONLY this file (+ types).
 * In multiplayer, the server becomes another emitter of the domain events
 * below (forwarded onto the same bus) — so the UI never changes.
 */
export interface Events {
  // ---- intents (UI -> game) ----
  'intent:bootComplete': void;
  'intent:startRound': void;
  'intent:requeue': void;
  'intent:pause': void;
  'intent:resume': void;
  'intent:buyUpgrade': { id: UpgradeId };
  'intent:useTool': { id: ToolId };
  'intent:setQuality': { level: QualityLevel };
  'intent:toggleSound': { on: boolean };
  'intent:setVolume': { value: number }; // 0..1
  'intent:joystick': { x: number; y: number }; // normalised -1..1
  'intent:action': { action: 'boost' | 'tool' | 'dig'; down: boolean };

  // ---- lifecycle (game -> UI) ----
  'game:ready': void;
  'round:started': { durationMs: number; seed: number; playerCount: number };
  'round:tick': { timeLeftMs: number; heat: number };
  'round:ended': { winnerId: PlayerId | null; results: PlayerResult[] };

  // ---- throttled HUD state (game -> UI) ----
  'hud:update': {
    cash: number;
    speedTier: number;
    boostCharge: number;
    tools: ToolState[];
    carrying: boolean;
  };
  'minimap:snapshot': MinimapSnapshot;

  // ---- digging ----
  'dig:started': { siteId: string };
  'dig:progress': { siteId: string; t: number }; // 0..1
  'dig:cancelled': { siteId: string };
  'dig:completed': { siteId: string; reward: DigReward };

  // ---- economy ----
  'gem:collected': { value: number; worldX: number; worldY: number };

  // ---- the Hot Rock ----
  'rock:found': { byId: PlayerId; worldX: number; worldY: number };
  'rock:picked': { byId: PlayerId };
  'rock:dropped': { worldX: number; worldY: number };
  'rock:stolen': { fromId: PlayerId; toId: PlayerId };
  'rock:extracted': { byId: PlayerId };

  // ---- feedback ----
  'player:hit': { targetId: PlayerId; byId: PlayerId | null; reason: HitReason };
  'toast': { kind: ToastKind; text: string };
}

export type EventName = keyof Events;
