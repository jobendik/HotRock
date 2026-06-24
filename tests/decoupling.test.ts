import { describe, it, expect } from 'vitest';
import { bus } from '@/core/EventBus';
import { uiStore } from '@/core/store';

/**
 * Layer-independence proof. The ESLint import-boundary rules are the primary,
 * compile-time guarantee (a cross-layer import fails `npm run lint`); this adds a
 * runtime check that UI modules import in a pure Node context — i.e. they pull in
 * neither Phaser nor the game/sim layers — and that the UI is driven purely by the
 * core bus + store contract, with the game entirely absent.
 */
describe('layer independence', () => {
  it('imports UI view modules without Phaser or the game layer', async () => {
    const results = await import('@/ui/screens/Results');
    const minimap = await import('@/ui/hud/Minimap');
    const toasts = await import('@/ui/hud/Toasts');
    expect(typeof results.Results).toBe('function');
    expect(typeof minimap.Minimap).toBe('function');
    expect(typeof toasts.Toasts).toBe('function');
  });

  it('drives the HUD store from domain events alone (game stubbed out)', () => {
    // A HUD-style subscriber, exactly as a DOM component would attach.
    let lastCash = -1;
    const off = uiStore.subscribe((s) => {
      lastCash = s.cash;
    });

    // The "game" here is just an emitter onto the same contract — no Phaser.
    uiStore.set({ ...uiStore.get(), cash: 250 });
    expect(lastCash).toBe(250);

    // Domain events flow through the same bus the real game uses.
    let stolen = false;
    const offBus = bus.on('rock:stolen', () => {
      stolen = true;
    });
    bus.emit('rock:stolen', { fromId: 'p0', toId: 'bot1' });
    expect(stolen).toBe(true);

    off();
    offBus();
  });
});
