import './tactics.css';

export interface TacticsHudHooks {
  /** Bascule le mode et retourne le nouveau mode (true = charger). */
  onToggleCharge(): boolean;
}

/**
 * Bouton « Fuir / Charger » du HUD, placé en haut à droite à côté du son et de la pause.
 * Il change le mode des ordres de déplacement du joueur.
 */
export class TacticsHud {
  readonly button: HTMLButtonElement;

  constructor(root: HTMLElement, hooks: TacticsHudHooks) {
    const host = root.querySelector('.hud-top-right') ?? root;
    let btn = root.querySelector<HTMLButtonElement>('#btn-charge');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-charge';
      btn.type = 'button';
      host.insertBefore(btn, host.firstChild);
    }
    btn.className = 'icon-btn mode-btn';
    this.button = btn;
    this.set(false);
    btn.addEventListener('click', () => this.set(hooks.onToggleCharge()));
  }

  /** Affiche le mode courant. */
  set(charge: boolean): void {
    const b = this.button;
    b.classList.toggle('charge', charge);
    b.setAttribute('aria-pressed', charge ? 'true' : 'false');
    b.setAttribute(
      'aria-label',
      charge ? 'Mode charge : les élèves se battent en chemin. Toucher pour passer en fuite' : 'Mode fuite : les élèves courent sans se battre. Toucher pour passer en charge',
    );
    b.innerHTML = `${charge ? chargeIcon() : fleeIcon()}<span class="mode-label">${charge ? 'Charger' : 'Fuir'}</span>`;
  }
}

/** Fuite : silhouette qui court, traits de vitesse. */
function fleeIcon(): string {
  return (
    '<svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true">' +
    '<path d="M1 6h5M0 9.5h4M1 13h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
    '<circle cx="13" cy="3" r="2.2" fill="#fff"/>' +
    '<path d="M12 6l-3 4 3 2-1 5M12 6l3 3 3-1M10.5 10l-3 1" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>'
  );
}

/** Charge : poing serré vers l'avant. */
function chargeIcon(): string {
  return (
    '<svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true">' +
    '<path d="M1 5.5h4M0 9h3M1 12.5h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
    '<rect x="7" y="4" width="10" height="10" rx="3" fill="#fff"/>' +
    '<path d="M10 4v5M13.3 4v5M7 9.5h4" stroke="#c45a10" stroke-width="1.3" stroke-linecap="round"/>' +
    '</svg>'
  );
}
