import '@/ui/styles/tokens.css';
import { bus } from '@/core/EventBus';
import { uiStore } from '@/core/store';

/**
 * Composition root. This minimal version proves the layered wiring works
 * (bus + store + CSS pipeline). Replace it during M0/M1 with the real boot:
 * mount the DOM UI (UIRoot), start Phaser (PhaserGame), and connect the
 * CrazyGames platform adapter — all communicating only via the event bus.
 */
function boot(): void {
  const root = document.getElementById('ui-root');
  if (root) {
    root.innerHTML =
      '<div class="boot">Hot Rock — scaffolding ready.<br>Implement milestones per docs/ROADMAP.md.</div>';
  }

  // Prove the contract end-to-end: someone listens for an intent, we announce readiness.
  bus.on('intent:startRound', () => console.info('[bus] intent:startRound received'));
  bus.emit('game:ready');

  // The store is wired and ready for the HUD to subscribe to.
  void uiStore;
}

boot();
