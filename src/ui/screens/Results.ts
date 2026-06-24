import type { PlayerResult, PlayerId } from '@/core/types';

export interface ResultsHandlers {
  onPlayAgain: () => void;
  onMenu: () => void;
  /** Show a rewarded ad; resolves true if the payout should double. */
  onDoublePayout: () => Promise<boolean>;
}

/**
 * Results screen (DOM). Crowns the winner, shows YOUR run (gems smuggled, digs,
 * steals, time as carrier) so losers still feel rewarded, lists the lobby, and
 * offers Play Again + a rewarded double-payout. Reads only the round:ended
 * payload — no game/sim imports.
 */
export class Results {
  readonly el: HTMLElement;
  private readonly headline: HTMLElement;
  private readonly board: HTMLElement;
  private readonly doubleBtn: HTMLButtonElement;
  private localCash = 0;

  constructor(private readonly h: ResultsHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'screen results';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="results__card">
        <h1 class="results__headline" data-headline></h1>
        <div class="results__board" data-board></div>
        <div class="results__actions">
          <button class="btn btn--primary" type="button" data-play>Play Again</button>
          <button class="btn" type="button" data-double>2× Payout (Ad)</button>
          <button class="btn" type="button" data-menu>Menu</button>
        </div>
      </div>`;
    this.headline = mustQ(this.el, '[data-headline]');
    this.board = mustQ(this.el, '[data-board]');
    this.doubleBtn = mustQ<HTMLButtonElement>(this.el, '[data-double]');

    mustQ(this.el, '[data-play]').addEventListener('click', () => this.h.onPlayAgain());
    mustQ(this.el, '[data-menu]').addEventListener('click', () => this.h.onMenu());
    this.doubleBtn.addEventListener('click', () => void this.doublePayout());
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  show(results: PlayerResult[], winnerId: PlayerId | null): void {
    const local = results.find((r) => !r.isBot) ?? null;
    const winner = results.find((r) => r.id === winnerId) ?? null;
    this.localCash = local?.cash ?? 0;

    this.headline.textContent = headlineFor(local, winner);
    this.doubleBtn.disabled = !local;
    this.doubleBtn.textContent = '2× Payout (Ad)';
    this.renderBoard(results, winnerId, local?.id ?? null);
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  private renderBoard(results: PlayerResult[], winnerId: PlayerId | null, localId: PlayerId | null): void {
    const sorted = [...results].sort(
      (a, b) => Number(b.extracted) - Number(a.extracted) || b.cash - a.cash,
    );
    this.board.innerHTML = sorted
      .map((r, i) => {
        const me = r.id === localId ? ' is-me' : '';
        const win = r.id === winnerId ? '👑 ' : '';
        const tag = r.id === localId ? '<span class="row__tag">YOU</span>' : '';
        return `<div class="row${me}">
          <span class="row__rank">${i + 1}</span>
          <span class="row__name">${win}${escapeHtml(r.name)}${tag}</span>
          <span class="row__cash">◈ ${r.cash}</span>
          <span class="row__stat">⛏ ${r.digs}</span>
          <span class="row__stat">✦ ${r.steals}</span>
          <span class="row__stat">⏱ ${Math.round(r.carrierMs / 1000)}s</span>
        </div>`;
      })
      .join('');
  }

  private async doublePayout(): Promise<void> {
    this.doubleBtn.disabled = true;
    const ok = await this.h.onDoublePayout();
    if (ok) {
      this.localCash *= 2;
      this.doubleBtn.textContent = `Doubled! ◈ ${this.localCash}`;
      const meCash = this.board.querySelector<HTMLElement>('.row.is-me .row__cash');
      if (meCash) meCash.textContent = `◈ ${this.localCash}`;
    } else {
      this.doubleBtn.disabled = false;
    }
  }
}

function headlineFor(local: PlayerResult | null, winner: PlayerResult | null): string {
  if (!winner) return "Time! No one smuggled the Rock.";
  if (local && winner.id === local.id) {
    return winner.extracted ? 'You smuggled the Rock! 💎' : 'You win! 🏆';
  }
  return winner.extracted ? `${winner.name} smuggled the Rock!` : `${winner.name} wins!`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function mustQ<T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Results: missing ${sel}`);
  return el;
}
