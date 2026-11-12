import './controls.css';
import { DoubleTap, GROUP_COUNT } from '../core/controls';
import type { Game } from '../game';

/** Durée de l'appui long qui enregistre la sélection dans un groupe. */
export const GROUP_HOLD_MS = 400;

/**
 * Colonne de boutons tactiles à gauche de l'écran :
 *  - « 1 », « 2 », « 3 » : appui long = enregistrer la sélection, tap = rappeler le groupe,
 *    second tap rapide = centrer la caméra dessus ; le bouton affiche le nombre d'élèves vivants ;
 *  - « Camp » : repli de la sélection sur le camp le plus proche, pour se soigner ;
 *  - « Garder » : la sélection garde une case (celle où elle se tient, sinon la prochaine touchée) ;
 *  - « Conquérir » : la sélection devient une escouade qui prend seule les cases libres
 *    (retoucher le bouton lève la consigne) ; un petit drapeau marque les groupes en conquête ;
 *  - « Défendre » (v5.12) : la sélection devient une garnison mobile du secteur qui l'entoure ;
 *    un petit bouclier bleu marque les groupes en défense ;
 *  - « Suivre » (v5.13) : arme l'escorte ; le prochain tap sur un de ses élèves (ou un groupe 1-2-3)
 *    désigne le groupe à suivre ; un petit écusson vert marque les groupes en escorte.
 * « Camp », « Garder » et « Suivre » partagent une rangée ; « Conquérir » et « Défendre » la suivante.
 */
export class ControlsHud {
  readonly el: HTMLElement;
  private groupBtns: HTMLButtonElement[] = [];
  private campBtn: HTMLButtonElement;
  private guardBtn: HTMLButtonElement;
  private conquerBtn: HTMLButtonElement;
  private defendBtn: HTMLButtonElement;
  private followBtn: HTMLButtonElement;
  private taps = new DoubleTap(380, Infinity);
  private timer = 0;

  constructor(
    private root: HTMLElement,
    private getGame: () => Game | null,
    private hint: (text: string) => void = () => undefined,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'hud-controls';
    for (let i = 0; i < GROUP_COUNT; i++) {
      const b = this.makeGroupButton(i);
      this.groupBtns.push(b);
      this.el.appendChild(b);
    }
    this.campBtn = document.createElement('button');
    this.campBtn.type = 'button';
    this.campBtn.id = 'btn-camp';
    this.campBtn.className = 'ctl-btn ctl-camp';
    this.campBtn.setAttribute('aria-label', 'Renvoyer la sélection au camp pour se soigner');
    this.campBtn.innerHTML = `${campIcon()}<span class="ctl-label">Camp</span>`;
    this.campBtn.addEventListener('click', () => this.camp());
    // « Camp » et « Garder » côte à côte : la colonne garde sa hauteur (entre les bonus et « Tout sélectionner »).
    const row = document.createElement('div');
    row.className = 'ctl-row';
    row.appendChild(this.campBtn);
    this.el.appendChild(row);
    this.guardBtn = document.createElement('button');
    this.guardBtn.type = 'button';
    this.guardBtn.id = 'btn-guard';
    this.guardBtn.className = 'ctl-btn ctl-camp ctl-guard';
    this.guardBtn.setAttribute('aria-label', 'Garder une case avec la sélection');
    this.guardBtn.innerHTML = `${guardIcon()}<span class="ctl-label">Garder</span>`;
    this.guardBtn.addEventListener('click', () => this.guard());
    row.appendChild(this.guardBtn);
    this.followBtn = document.createElement('button');
    this.followBtn.type = 'button';
    this.followBtn.id = 'btn-follow';
    this.followBtn.className = 'ctl-btn ctl-camp ctl-follow';
    this.followBtn.setAttribute('aria-label', 'Suivre : la sélection escorte le groupe que tu touches ensuite');
    this.followBtn.innerHTML = `${followIcon()}<span class="ctl-label">Suivre</span>`;
    this.followBtn.addEventListener('click', () => this.follow());
    row.appendChild(this.followBtn);
    this.conquerBtn = document.createElement('button');
    this.conquerBtn.type = 'button';
    this.conquerBtn.id = 'btn-conquer';
    this.conquerBtn.className = 'ctl-btn ctl-camp ctl-conquer';
    this.conquerBtn.setAttribute('aria-label', 'Conquérir : la sélection prend seule les cases libres');
    this.conquerBtn.innerHTML = `${flagIcon()}<span class="ctl-label">Conquérir</span>`;
    this.conquerBtn.addEventListener('click', () => this.conquer());
    const row2 = document.createElement('div');
    row2.className = 'ctl-row';
    row2.appendChild(this.conquerBtn);
    this.defendBtn = document.createElement('button');
    this.defendBtn.type = 'button';
    this.defendBtn.id = 'btn-defend';
    this.defendBtn.className = 'ctl-btn ctl-camp ctl-conquer ctl-defend';
    this.defendBtn.setAttribute('aria-label', 'Défendre : la sélection tient seule les cases qui l’entourent');
    this.defendBtn.innerHTML = `${wallIcon()}<span class="ctl-label">Défendre</span>`;
    this.defendBtn.addEventListener('click', () => this.defend());
    row2.appendChild(this.defendBtn);
    this.el.appendChild(row2);
    this.root.appendChild(this.el);
    this.refresh();
    this.timer = window.setInterval(() => {
      if (!this.root.classList.contains('hidden')) this.refresh();
    }, 250);
  }

  /** Met à jour les compteurs des groupes et l'état du bouton « Camp ». */
  refresh(): void {
    const game = this.getGame();
    this.groupBtns.forEach((b, i) => {
      const n = game ? game.groupSize(i) : 0;
      const c = b.querySelector('.ctl-count')!;
      const txt = n > 0 ? String(n) : '';
      if (c.textContent !== txt) c.textContent = txt;
      b.classList.toggle('empty', n === 0);
      b.classList.toggle('conquering', n > 0 && !!game && game.groupConquering(i) * 2 >= n);
      b.classList.toggle('defending', n > 0 && !!game && game.groupDefending(i) * 2 >= n);
      b.classList.toggle('following', n > 0 && !!game && game.groupFollowing(i) * 2 >= n);
      b.classList.toggle('pick', !!game && game.followArmed && n > 0);
    });
    this.campBtn.classList.toggle('off', !game || game.selected.size === 0);
    this.guardBtn.classList.toggle('off', !game || game.selected.size === 0);
    this.guardBtn.classList.toggle('armed', !!game && game.guardArmed);
    this.conquerBtn.classList.toggle('off', !game || game.selected.size === 0);
    const on = !!game && game.selectionConquers;
    this.conquerBtn.classList.toggle('on', on);
    this.conquerBtn.setAttribute('aria-pressed', String(on));
    this.defendBtn.classList.toggle('off', !game || game.selected.size === 0);
    const def = !!game && game.selectionDefends;
    this.defendBtn.classList.toggle('on', def);
    this.defendBtn.setAttribute('aria-pressed', String(def));
    this.followBtn.classList.toggle('off', !game || game.selected.size === 0);
    this.followBtn.classList.toggle('armed', !!game && game.followArmed);
    const fol = !!game && game.selectionFollows;
    this.followBtn.classList.toggle('on', fol && !game.followArmed);
    this.followBtn.setAttribute('aria-pressed', String(fol));
  }

  destroy(): void {
    clearInterval(this.timer);
    this.el.remove();
  }

  // ---------------------------------------------------------------- actions

  /** Tap sur un groupe : rappel, puis centrage de la caméra au second tap rapide. */
  tapGroup(i: number): void {
    const game = this.getGame();
    if (!game) return;
    // « Suivre » armé : le groupe touché devient le protégé (la sélection ne change pas).
    if (game.followGroup(i)) {
      this.refresh();
      return;
    }
    const double = this.taps.hit(performance.now(), i);
    const n = game.recallGroup(i);
    if (n === 0) {
      if (!game.paused && !game.over) this.hint(`Groupe ${i + 1} vide : appui long pour y enregistrer la sélection.`);
    } else if (double) {
      game.centerOnGroup(i);
    }
    this.refresh();
  }

  /** Appui long sur un groupe : enregistre la sélection courante. */
  holdGroup(i: number): void {
    const game = this.getGame();
    if (!game) return;
    const n = game.saveGroup(i);
    const b = this.groupBtns[i];
    if (n === 0) {
      this.hint('Sélectionne d’abord des élèves, puis appui long sur un groupe pour l’enregistrer.');
      return;
    }
    navigator.vibrate?.(30);
    b.classList.remove('saved');
    void b.offsetWidth; // relance l'animation
    b.classList.add('saved');
    this.hint(`Groupe ${i + 1} enregistré : ${n} élève${n > 1 ? 's' : ''}.`);
    this.refresh();
  }

  camp(): void {
    const game = this.getGame();
    if (!game) return;
    const r = game.sendToCamp();
    if (r === 'vide' && !game.paused && !game.over) this.hint('Sélectionne des élèves à renvoyer au camp.');
    else if (r === 'sans-camp') this.hint('Tu n’as plus de camp pour te soigner.');
  }

  /** « Garder » : garde immédiate de la case où se tient la sélection, ou ordre armé (tap sur une case). */
  guard(): void {
    const game = this.getGame();
    if (!game) return;
    const r = game.guard();
    if (r === 'vide' && !game.paused && !game.over) this.hint('Sélectionne des élèves, puis « Garder » pour leur confier une case.');
    else if (r === 'arme') this.hint('Touche la case à garder : case bonus, camp ou trône.');
    else if (r === 'desarme') this.hint('Ordre « Garder » annulé.');
    if (r === 'garde') navigator.vibrate?.(20);
    this.refresh();
  }

  /** « Conquérir » : la sélection part en conquête (ou s'arrête si elle y est déjà). */
  conquer(): void {
    const game = this.getGame();
    if (!game) return;
    const r = game.conquer();
    if (r === 'vide' && !game.paused && !game.over) this.hint('Sélectionne des élèves, puis « Conquérir » : ils prendront seuls les cases libres.');
    this.refresh();
  }

  /** « Défendre » : la sélection tient le secteur qui l'entoure (ou lève la consigne si elle y est déjà). */
  defend(): void {
    const game = this.getGame();
    if (!game) return;
    const r = game.defend();
    if (r === 'vide' && !game.paused && !game.over) this.hint('Sélectionne des élèves près de tes cases, puis « Défendre » : ils tiendront seuls le secteur.');
    this.refresh();
  }

  /** « Suivre » : arme l'escorte (puis tap sur le groupe à suivre), désarme, ou lève la consigne. */
  follow(): void {
    const game = this.getGame();
    if (!game) return;
    const r = game.follow();
    if (r === 'vide' && !game.paused && !game.over) this.hint('Sélectionne des élèves, puis « Suivre » et touche le groupe qu’ils doivent escorter.');
    else if (r === 'arme') this.hint('Touche le groupe à escorter : un de tes élèves, ou un bouton 1, 2, 3.');
    else if (r === 'desarme') this.hint('Consigne « Suivre » annulée.');
    this.refresh();
  }

  // ---------------------------------------------------------------- boutons

  private makeGroupButton(i: number): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `btn-group-${i + 1}`;
    b.className = 'ctl-btn ctl-group empty';
    b.setAttribute('aria-label', `Groupe ${i + 1} : toucher pour le sélectionner, appui long pour y enregistrer la sélection`);
    b.innerHTML = `<span class="ctl-num">${i + 1}</span><span class="ctl-count"></span><span class="ctl-flag" aria-hidden="true">${flagIcon(12)}</span><span class="ctl-shield" aria-hidden="true">${wallIcon(12)}</span><span class="ctl-escort" aria-hidden="true">${followIcon(12)}</span>`;
    let hold = 0;
    let fired = false;
    let down = false;
    const cancel = () => {
      clearTimeout(hold);
      down = false;
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture?.(e.pointerId);
      down = true;
      fired = false;
      clearTimeout(hold);
      hold = window.setTimeout(() => {
        fired = true;
        this.holdGroup(i);
      }, GROUP_HOLD_MS);
    });
    b.addEventListener('pointerup', () => {
      const wasDown = down;
      cancel();
      if (wasDown && !fired) this.tapGroup(i);
    });
    b.addEventListener('pointercancel', cancel);
    b.addEventListener('animationend', () => b.classList.remove('saved'));
    // Clavier (Entrée / Espace) : simple rappel.
    b.addEventListener('click', (e) => {
      if (e.detail === 0) this.tapGroup(i);
    });
    return b;
  }
}

function campIcon(): string {
  return '<svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M11 2L2 16h18z" fill="#fff"/><path d="M11 8l-3.5 8h7z" fill="#2b2b33"/><path d="M11 2V0.5M11 0.5h4l-1 1.2 1 1.2h-4" stroke="#ff6a4a" stroke-width="1.4" fill="#ff6a4a"/></svg>';
}

function guardIcon(): string {
  return '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5c3 1.4 5.6 1.8 8 1.6v6.4c0 4.4-3.3 7.6-8 9-4.7-1.4-8-4.6-8-9V3.1c2.4.2 5-.2 8-1.6z" fill="#fff"/><path d="M10 4.2c2 .9 3.8 1.2 5.4 1.1v4.2c0 3-2.2 5.2-5.4 6.2z" fill="#2b2b33"/></svg>';
}

function flagIcon(size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 2v16.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M5.5 2.6c3-1.4 5.2 1.4 9.8.2v7.2c-4.6 1.2-6.8-1.6-9.8-.2z" fill="#ff6a4a" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}

/** Bouclier bleu barré d'un rempart : « Défendre ». */
function wallIcon(size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5c3 1.4 5.6 1.8 8 1.6v6.4c0 4.4-3.3 7.6-8 9-4.7-1.4-8-4.6-8-9V3.1c2.4.2 5-.2 8-1.6z" fill="#3f8cff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 8.2h2v-1.6h1.6v1.6h1.8v-1.6h1.6v1.6h2v4.3h-9z" fill="#fff"/></svg>`;
}

/** Rond vert à double chevron : « Suivre ». */
function followIcon(size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.6" fill="#22b573" stroke="#fff" stroke-width="1.4"/><path d="M6 6l3.6 4L6 14M10.6 6l3.6 4-3.6 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
