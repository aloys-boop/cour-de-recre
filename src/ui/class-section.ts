import { CLASSES, classCount, classUnlocked, UNIT_CLASSES, type UnitClass } from '../core/classes';
import type { Tile } from '../core/tile';
import type { Game } from '../game';
import { buildSheet, FRAME_H, FRAME_W } from '../render/sprites';
import type { CampSection } from './camp-panel';

/**
 * Section « Ce camp produit » du panneau du camp : élève normal (gratuit), Costaud, Sprinteur,
 * Infirmier (payés à chaque élève produit, débloqués au niveau 2 de Production du camp).
 */
export class ClassSection implements CampSection {
  readonly el: HTMLElement;
  private buttons = new Map<UnitClass, HTMLButtonElement>();
  private note: HTMLElement;
  private color = -1;

  constructor(private hint: (text: string, ms?: number) => void = () => undefined) {
    this.el = document.createElement('div');
    this.el.className = 'camp-section class-section';
    const h = document.createElement('h3');
    h.textContent = 'Ce camp produit';
    const row = document.createElement('div');
    row.className = 'class-row';
    for (const cls of UNIT_CLASSES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'class-btn';
      b.dataset.cls = cls;
      const info = CLASSES[cls];
      b.innerHTML =
        '<canvas class="class-icon" width="40" height="58"></canvas>' +
        `<span class="class-name">${info.label}</span>` +
        `<span class="class-cost">${info.cost ? `${info.cost} ★` : 'gratuit'}</span>`;
      b.title = info.blurb;
      b.setAttribute('aria-label', `${info.label} : ${info.blurb}${info.cost ? `, ${info.cost} bons points par élève` : ''}`);
      b.addEventListener('click', () => this.pick(cls));
      row.append(b);
      this.buttons.set(cls, b);
    }
    this.note = document.createElement('p');
    this.note.className = 'class-note';
    this.el.append(h, row, this.note);
  }

  private game: Game | null = null;
  private camp: Tile | null = null;

  private pick(cls: UnitClass): void {
    if (!this.game || !this.camp) return;
    const r = this.game.setCampProduce(this.camp, cls);
    if (r === 'verrouille') this.hint('Débloque d’abord les classes dans « Toute l’équipe ».', 2600);
    else if (r === 'ok') this.hint(cls === 'eleve' ? 'Ce camp produit des élèves normaux.' : `Ce camp produit des ${CLASSES[cls].label.toLowerCase()}s (${CLASSES[cls].cost} ★ chacun).`, 2200);
    this.refresh(this.game, this.camp);
  }

  refresh(game: Game, camp: Tile): void {
    this.game = game;
    this.camp = camp;
    const color = game.world.teamColors[game.playerTeam];
    if (color !== this.color) this.drawIcons(color);
    const unlocked = classUnlocked(game.world, game.playerTeam, 'costaud');
    for (const [cls, b] of this.buttons) {
      b.classList.toggle('active', camp.produce === cls);
      b.classList.toggle('locked', cls !== 'eleve' && !unlocked);
      const info = CLASSES[cls];
      if (info.max > 0) {
        const n = classCount(game.world, game.playerTeam, cls);
        const cost = b.querySelector('.class-cost')!;
        const text = `${info.cost} ★ · ${n}/${info.max}`;
        if (cost.textContent !== text) cost.textContent = text;
      }
    }
    const text = !unlocked
      ? 'À débloquer dans « Toute l’équipe ».'
      : camp.produce === 'eleve'
        ? ''
        : `${CLASSES[camp.produce].blurb} ; sans bons points, élève normal.`;
    if (this.note.textContent !== text) this.note.textContent = text;
  }

  /** Vignettes : le vrai sprite de chaque classe, aux couleurs du joueur. */
  private drawIcons(color: number): void {
    this.color = color;
    for (const [cls, b] of this.buttons) {
      const c = b.querySelector('canvas')!;
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = c.getContext('2d');
      } catch {
        ctx = null;
      }
      if (!ctx) continue;
      const sheet = buildSheet(color, (w, h) => {
        const s = document.createElement('canvas');
        s.width = w;
        s.height = h;
        return s;
      }, cls);
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet as CanvasImageSource, 0, FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
    }
  }
}
