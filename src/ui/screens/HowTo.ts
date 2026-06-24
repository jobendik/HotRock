/**
 * "How to play" overlay (DOM). Static copy — the one-screen pitch + controls.
 */
export class HowTo {
  readonly el: HTMLElement;

  constructor(private readonly onClose: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'screen modal-screen';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="modal">
        <h2 class="modal__title">How to play</h2>
        <ul class="howto">
          <li>🛥️ <b>Drive</b> with WASD / arrows (or the on-screen stick). <b>Boost</b> with Space / the Boost button.</li>
          <li>⛏️ <b>Dig</b> sites for gems — slow down on a marker to mine it. Gems are cash; spend it on upgrades.</li>
          <li>💎 Someone digs up <b>the Rock</b> and the whole map lights up. The carrier glows and is pinned on the minimap.</li>
          <li>💥 <b>Ram</b> the carrier to knock the Rock loose, then grab it. One hit can flip the whole game.</li>
          <li>🏁 <b>Smuggle</b> the Rock to a black-market <b>dock</b> and hold to win. No eliminations — losers still bank gems.</li>
        </ul>
        <button class="btn btn--primary" type="button" data-close>Got it</button>
      </div>`;
    const close = this.el.querySelector('[data-close]');
    close?.addEventListener('click', () => this.onClose());
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  show(): void {
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
