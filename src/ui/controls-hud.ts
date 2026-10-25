import './controls.css';
import { DoubleTap, GROUP_COUNT } from '../core/controls';
import type { Game } from '../game';

/** Durée de l'appui long qui enregistre la sélection dans un groupe. */
export const GROUP_HOLD_MS = 400;

/**
 * Colonne de boutons tactiles à gauche de l'écran :
 *  - « 1 », « 2 », « 3 » : appui long = enregistrer la sélection, tap = rappeler le groupe,
 *    second tap rapide = centrer la caméra dessus ; le bouton affiche le nombre d'élèves vivants ;
 *  - « Camp » : repli de la sélection sur le camp le plus proche, pour se soigner.
 */
export class ControlsHud {
  readonly el: HTMLElement;
  private groupBtns: HTMLButtonElement[] = [];
  private campBtn: HTMLButtonElement;
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
    this.el.appendChild(this.campBtn);
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
    });
    this.campBtn.classList.toggle('off', !game || game.selected.size === 0);
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

  // ---------------------------------------------------------------- boutons

  private makeGroupButton(i: number): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `btn-group-${i + 1}`;
    b.className = 'ctl-btn ctl-group empty';
    b.setAttribute('aria-label', `Groupe ${i + 1} : toucher pour le sélectionner, appui long pour y enregistrer la sélection`);
    b.innerHTML = `<span class="ctl-num">${i + 1}</span><span class="ctl-count"></span>`;
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
