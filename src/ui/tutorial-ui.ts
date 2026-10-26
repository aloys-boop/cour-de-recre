import './tutorial.css';
import type { Game } from '../game';

/**
 * Habillage du tutoriel : bulle de texte (étape n / 11, consigne), main animée qui montre
 * où toucher (un élève, une case, un bouton…), et bouton « Passer » toujours visible.
 * La position de la main est recalculée à chaque image (la caméra bouge, les élèves aussi).
 */
export class TutorialUi {
  readonly el: HTMLElement;
  readonly bubble: HTMLElement;
  readonly hand: HTMLElement;
  readonly skipBtn: HTMLButtonElement;
  private text: HTMLElement;
  private count: HTMLElement;
  private game: Game | null = null;
  private lastIndex = -1;

  constructor(root: HTMLElement, onSkip: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'tuto hidden';
    this.bubble = document.createElement('div');
    this.bubble.className = 'tuto-bubble';
    this.bubble.setAttribute('role', 'status');
    this.bubble.setAttribute('aria-live', 'polite');
    this.count = document.createElement('span');
    this.count.className = 'tuto-count';
    this.text = document.createElement('p');
    this.text.className = 'tuto-text';
    this.skipBtn = document.createElement('button');
    this.skipBtn.type = 'button';
    this.skipBtn.id = 'btn-tuto-skip';
    this.skipBtn.className = 'btn btn-secondary tuto-skip';
    this.skipBtn.textContent = 'Passer';
    this.skipBtn.addEventListener('click', onSkip);
    this.bubble.append(this.count, this.text, this.skipBtn);
    this.hand = document.createElement('div');
    this.hand.className = 'tuto-hand';
    this.hand.innerHTML = handIcon();
    this.el.append(this.bubble, this.hand);
    root.appendChild(this.el);
  }

  show(game: Game): void {
    this.game = game;
    this.lastIndex = -1;
    this.el.classList.remove('hidden');
    this.refresh();
  }

  hide(): void {
    this.game = null;
    this.el.classList.add('hidden');
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  /** Met à jour la bulle et place la main (appelé à chaque image). */
  refresh(): void {
    const g = this.game;
    const t = g?.tutorial;
    if (!g || !t) return;
    if (t.done) {
      this.hand.classList.add('hidden');
      return;
    }
    const step = t.step;
    if (t.index !== this.lastIndex) {
      this.lastIndex = t.index;
      this.count.textContent = `Étape ${t.index + 1} / ${t.total}`;
      this.text.textContent = step.text;
      this.bubble.classList.remove('pop');
      void this.bubble.offsetWidth;
      this.bubble.classList.add('pop');
    }
    const at = this.handPoint(g);
    this.hand.classList.toggle('hidden', !at);
    this.hand.classList.toggle('drag', step.target.kind === 'drag');
    this.hand.classList.toggle('swipe', step.id === 'camera' && !at?.button);
    if (at) {
      this.hand.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
    }
  }

  /** Point (px, coordonnées de la page) que montre la main pour l'étape courante. */
  private handPoint(g: Game): { x: number; y: number; button?: boolean } | null {
    const t = g.tutorial!;
    const step = t.step;
    // Un bouton du HUD (ou, selon l'avancement, ce qu'il ouvre).
    const button = (selector: string) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, button: true };
    };
    const world = (p: { x: number; y: number } | null) => {
      if (!p) return null;
      const s = g.cam.gridToScreen(p.x, p.y);
      return { x: s.x, y: s.y - 18 * g.cam.zoom };
    };
    if (step.id === 'rally' && g.selected.size === 0) {
      const home = g.mainCamp();
      return home ? world({ x: home.cx + 2.2, y: home.cy - 1.2 }) : null;
    }
    if (step.id === 'upgrade') {
      const panel = document.getElementById('camp-panel');
      if (panel && !panel.classList.contains('hidden')) return button('#camp-panel .camp-row[data-branch="prod"] .camp-buy');
      if (g.selected.size > 0) return button('#btn-cancel');
      return button(step.target.kind === 'button' ? step.target.selector : '#merit-pill');
    }
    if (step.id === 'power' && g.armedPower) return world(g.powerAim);
    if (step.target.kind === 'button') return button(step.target.selector);
    if (step.id === 'attack' && g.selected.size === 0) {
      const mine = g.world.units.find((u) => u.team === g.playerTeam && u.alive && !u.pion);
      return mine ? world(mine) : null;
    }
    return world(t.targetPoint());
  }
}

/** Main qui pointe (index tendu vers le haut à gauche : le bout du doigt est en (0, 0)). */
function handIcon(): string {
  return (
    '<svg width="44" height="50" viewBox="0 0 44 50" aria-hidden="true">' +
    '<path d="M6 4c2.5-1.5 5 0 5.5 2.5L15 22l1-6c.4-2.5 4-2.6 4.6 0l.6 4 .6-2.8c.6-2.5 4.1-2.3 4.4.2l.4 3.4.8-1.8c1-2.2 4.3-1.5 4.3 1V33c0 7-5 13-12 13h-2c-5 0-8-2.5-10.5-6.5L3.5 31c-1.5-2.4 1-5 3.4-3.6L11 30 4.2 9C3.5 7 4.2 5 6 4z" fill="#fff" stroke="#1e1e28" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M15.5 22l1.4 7M21 19.5l.6 8.5M26.5 20l.2 8" stroke="#1e1e28" stroke-width="1.6" stroke-linecap="round"/>' +
    '</svg>'
  );
}
