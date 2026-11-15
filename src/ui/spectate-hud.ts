import './spectate.css';
import { TEAM_COLORS } from '../config';
import { teamPlural } from '../core/diplomacy';

export interface SpectateHudHooks {
  /** « Regarder » : la caméra va vers un coéquipier (le suivant à chaque tap). Renvoie sa couleur, ou -1. */
  onWatch(): number;
  /** « ×2 » : bascule la vitesse accélérée. Renvoie le nouvel état. */
  onFast(): boolean;
  /** « Terminer » : quitter sans attendre la fin (écran de fin avec statistiques). */
  onLeave(): void;
}

/**
 * Mode Équipes, suite (v5.16) : bandeau du spectateur, en bas au centre, quand le joueur est
 * éliminé mais que ses coéquipiers tiennent encore. Les commandes de jeu (sélection, consignes,
 * pouvoirs, pause tactique) disparaissent : il n'y a plus d'élèves à commander.
 */
export class SpectateHud {
  readonly el: HTMLDivElement;
  private watchBtn: HTMLButtonElement;
  private fastBtn: HTMLButtonElement;
  private leaveBtn: HTMLButtonElement;
  private text: HTMLSpanElement;

  constructor(
    private root: HTMLElement,
    private hooks: SpectateHudHooks,
  ) {
    this.el = document.createElement('div');
    this.el.id = 'spectate-bar';
    this.el.className = 'spectate-bar hidden';
    this.el.setAttribute('role', 'status');
    this.text = document.createElement('span');
    this.text.className = 'sp-text';
    this.watchBtn = this.button('sp-watch', `${eyeIcon()}<span>Regarder</span>`, 'Regarder un coéquipier', () => this.setWatched(this.hooks.onWatch()));
    this.fastBtn = this.button('sp-fast', '<b>×2</b>', 'Accélérer la partie', () => this.setFast(this.hooks.onFast()));
    this.leaveBtn = this.button('sp-leave', 'Terminer', 'Terminer la partie', () => this.hooks.onLeave());
    const info = document.createElement('div');
    info.className = 'sp-info';
    info.innerHTML = `<span class="sp-title">${eyeIcon('#ffe27a')}<b>Spectateur</b></span>`;
    info.append(this.text);
    this.el.append(info, this.watchBtn, this.fastBtn, this.leaveBtn);
    root.appendChild(this.el);
  }

  private button(cls: string, html: string, label: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `sp-btn ${cls}`;
    b.innerHTML = html;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onTap);
    return b;
  }

  /** Entrée en spectateur : bandeau visible, commandes de jeu masquées. `watched` : couleur regardée. */
  show(watched: number): void {
    this.el.classList.remove('hidden');
    this.root.classList.add('spectating');
    this.setFast(false);
    this.setWatched(watched);
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.root.classList.remove('spectating');
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  setWatched(color: number): void {
    if (color < 0) return;
    const c = TEAM_COLORS[color] ?? TEAM_COLORS[0];
    const who = teamPlural(color);
    this.text.textContent = `Tu es KO : ${who} jouent pour l’équipe.`;
    this.watchBtn.style.setProperty('--mate', c.light);
  }

  setFast(on: boolean): void {
    this.fastBtn.classList.toggle('on', on);
    this.fastBtn.setAttribute('aria-pressed', String(on));
  }
}

function eyeIcon(color = '#16234a'): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.6-4.4 6-6.6 10-6.6S19.4 7.6 22 12c-2.6 4.4-6 6.6-10 6.6S4.6 16.4 2 12z" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="${color}"/></svg>`;
}
