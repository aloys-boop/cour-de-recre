// Tutoriel : petite carte à deux équipes et étapes guidées, chacune validée par l'action
// réelle du joueur (sélection, ordre, capture…). Logique pure : la bulle et la main animée
// sont dans ui/tutorial-ui.ts.
import { awardMerit, meritsOf } from './merits';
import { POWERS } from './powers';
import { UPGRADES } from './upgrades';
import type { Tile } from './tile';
import { NO_TEAM, type MapDef, type Vec2 } from './types';
import type { WorldEvent } from './world';
import type { World } from './world';

/** Identifiant de niveau du tutoriel (hors de la liste des niveaux : les codes de carte restent inchangés). */
export const TUTORIAL_ID = 'tutoriel';

/**
 * Carte du tutoriel : 11 × 11, ton camp à l'ouest, celui des Verts à l'est, cinq cases bonus
 * (un cœur tout près de toi pour la première capture), un seul obstacle.
 */
export const TUTORIAL_MAP: MapDef = {
  id: TUTORIAL_ID,
  name: 'Tutoriel',
  w: 11,
  h: 11,
  teams: 2,
  unitCap: 30,
  spawnInterval: 6,
  startUnits: 6,
  tiles: [
    { kind: 'camp', x: 0, y: 9, owner: 0 },
    { kind: 'camp', x: 9, y: 0, owner: 1 },
    { kind: 'bonus', x: 3, y: 7, suit: 'heart' },
    { kind: 'bonus', x: 5, y: 5, suit: 'spade' },
    { kind: 'bonus', x: 2, y: 4, suit: 'club' },
    { kind: 'bonus', x: 6, y: 8, suit: 'diamond' },
    { kind: 'bonus', x: 7, y: 3, suit: 'heart' },
  ],
  obstacles: [{ x: 5, y: 2 }],
  seed: 1,
};

/** Action du joueur, telle que la rapporte Game (voir PlayerAction). */
export interface TutorialAction {
  kind: string;
  box?: boolean;
  count?: number;
}

/** Ce que montre la main animée. */
export type TutorialTarget =
  | { kind: 'unit'; team: 'mine' | 'enemy' }
  | { kind: 'tile'; which: 'heart' | 'free' | 'enemyCamp' | 'myCamp' }
  | { kind: 'ground' }
  | { kind: 'drag' }
  | { kind: 'button'; selector: string }
  | { kind: 'none' };

export interface TutorialStep {
  id: string;
  /** Texte court de la bulle. */
  text: string;
  target: TutorialTarget;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'select', text: 'Touche un de tes élèves pour le sélectionner.', target: { kind: 'unit', team: 'mine' } },
  { id: 'box', text: 'Appui long sur le sol, puis glisse : tu sélectionnes tout un groupe.', target: { kind: 'drag' } },
  { id: 'move', text: 'Touche le sol pour envoyer ta sélection. Elle court sans se battre.', target: { kind: 'ground' } },
  { id: 'capture', text: 'Envoie tes élèves sur la case ♥ et reste dessus : la jauge se remplit.', target: { kind: 'tile', which: 'heart' } },
  { id: 'attack', text: 'Des Verts arrivent ! Sélectionne tes élèves, puis touche un ennemi pour attaquer.', target: { kind: 'unit', team: 'enemy' } },
  { id: 'rally', text: 'Touche « Annuler », puis appui long sur le sol : les nouveaux élèves iront au drapeau.', target: { kind: 'button', selector: '#btn-cancel' } },
  { id: 'camera', text: 'Glisse un doigt pour bouger la vue, pince pour zoomer, ou touche la mini-carte.', target: { kind: 'button', selector: '#minimap' } },
  { id: 'merits', text: 'Chaque case prise rapporte des bons points ★. Prends une autre case !', target: { kind: 'tile', which: 'free' } },
  { id: 'upgrade', text: 'Sans sélection, touche ton camp (ou la pastille ★) et améliore-le.', target: { kind: 'button', selector: '#merit-pill' } },
  { id: 'power', text: 'Touche le gâteau, vise tes élèves sur la carte, puis touche la zone.', target: { kind: 'button', selector: '#btn-power-gouter' } },
  { id: 'win', text: 'Dernière étape : prends le camp des Verts pour gagner !', target: { kind: 'tile', which: 'enemyCamp' } },
];

export type TutorialEvent = { kind: 'step'; index: number } | { kind: 'done' };

/**
 * Déroulé du tutoriel. Game lui transmet les actions du joueur et les événements du monde ;
 * à chaque étape franchie, il prépare la suivante (ennemis qui approchent, bons points offerts,
 * réveil de l'IA pour la dernière étape).
 */
export class TutorialState {
  index = 0;
  done = false;
  /** L'IA adverse joue-t-elle (dernière étape seulement) ? */
  aiActive = false;
  private events: TutorialEvent[] = [];
  private earnedAtStart = 0;

  constructor(
    readonly world: World,
    readonly player = 0,
  ) {
    this.prepare();
  }

  get step(): TutorialStep {
    return TUTORIAL_STEPS[Math.min(this.index, TUTORIAL_STEPS.length - 1)];
  }

  get total(): number {
    return TUTORIAL_STEPS.length;
  }

  drainEvents(): TutorialEvent[] {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** Action du joueur : franchit l'étape courante si c'est celle attendue. */
  onAction(a: TutorialAction): void {
    if (this.done) return;
    const id = this.step.id;
    const ok =
      (id === 'select' && a.kind === 'select') ||
      (id === 'box' && a.kind === 'select' && a.box === true) ||
      (id === 'move' && a.kind === 'move') ||
      (id === 'attack' && a.kind === 'attack') ||
      (id === 'rally' && a.kind === 'rally') ||
      (id === 'camera' && a.kind === 'camera') ||
      (id === 'upgrade' && a.kind === 'upgrade') ||
      (id === 'power' && a.kind === 'power');
    if (ok) this.next();
  }

  /** Événements du monde : captures et gains de bons points. */
  onWorldEvent(ev: WorldEvent): void {
    if (this.done) return;
    const id = this.step.id;
    if (id === 'capture' && ev.kind === 'captured' && ev.team === this.player && !ev.camp) this.next();
    else if (id === 'merits' && ev.kind === 'merit' && ev.team === this.player && ev.reason === 'capture') this.next();
  }

  /** Fin de partie : la dernière étape est réussie si le joueur gagne. */
  onVictory(): void {
    if (this.done) return;
    this.index = TUTORIAL_STEPS.length - 1;
    this.finish();
  }

  /** Passer le tutoriel. */
  skip(): void {
    this.finish();
  }

  /** Vérifications continues (le joueur a pu faire l'action avant que l'étape ne s'affiche). */
  update(): void {
    if (this.done) return;
    const id = this.step.id;
    if (id === 'merits' && this.world.merits.earned[this.player] - this.earnedAtStart >= 20) this.next();
    // Case déjà prise en chemin : l'étape est faite.
    else if (id === 'capture' && this.world.tiles.some((t) => t.kind === 'bonus' && t.owner === this.player)) this.next();
  }

  private next(): void {
    this.index++;
    if (this.index >= TUTORIAL_STEPS.length) return this.finish();
    this.prepare();
    this.events.push({ kind: 'step', index: this.index });
  }

  private finish(): void {
    this.done = true;
    this.events.push({ kind: 'done' });
  }

  /** Mise en place de l'étape qui commence. */
  private prepare(): void {
    const w = this.world;
    const id = this.step.id;
    this.earnedAtStart = w.merits.earned[this.player];
    // Avant la fin, les Verts ne produisent pas : ils attendent sagement chez eux.
    w.productionScale[1 - this.player] = id === 'win' ? 0.5 : 0;
    if (id === 'attack') {
      // Deux Verts approchent du groupe du joueur.
      const mine = w.units.filter((u) => u.team === this.player && u.alive);
      const c = mine.length ? { x: mine.reduce((s, u) => s + u.x, 0) / mine.length, y: mine.reduce((s, u) => s + u.y, 0) / mine.length } : { x: 4, y: 6 };
      for (let i = 0; i < 2; i++) {
        const e = w.spawnUnit(1 - this.player, Math.min(w.map.w - 1, c.x + 2.6 + i * 0.4), Math.max(1, c.y - 2.2), false);
        w.orderMove([e], { x: c.x + 1.2, y: c.y - 0.8 }, true);
      }
    }
    if (id === 'upgrade') topUp(w, this.player, UPGRADES.prod.costs[0] + 5);
    if (id === 'power') topUp(w, this.player, POWERS.gouter.cost + 5);
    if (id === 'win') this.aiActive = true;
  }

  /** Point de la carte à montrer pour l'étape courante (grille), ou null. */
  targetPoint(): Vec2 | null {
    const w = this.world;
    const t = this.step.target;
    if (t.kind === 'unit') {
      const enemy = t.team === 'enemy';
      const u = w.units.find((x) => x.alive && !x.pion && (enemy ? x.team !== this.player : x.team === this.player));
      return u ? { x: u.x, y: u.y } : null;
    }
    if (t.kind === 'tile') {
      const tile = this.targetTile(t.which);
      return tile ? { x: tile.cx, y: tile.cy } : null;
    }
    if (t.kind === 'ground' || t.kind === 'drag') {
      const mine = w.units.filter((u) => u.team === this.player && u.alive);
      if (!mine.length) return null;
      const c = { x: mine.reduce((s, u) => s + u.x, 0) / mine.length, y: mine.reduce((s, u) => s + u.y, 0) / mine.length };
      return t.kind === 'ground' ? w.grid.clampPos({ x: c.x + 1.5, y: c.y - 1.5 }, 0.8) : c;
    }
    return null;
  }

  private targetTile(which: 'heart' | 'free' | 'enemyCamp' | 'myCamp'): Tile | null {
    const w = this.world;
    if (which === 'enemyCamp') return w.tiles.find((t) => t.isCamp && t.owner !== this.player) ?? null;
    if (which === 'myCamp') return w.tiles.find((t) => t.isCamp && t.owner === this.player) ?? null;
    if (which === 'heart') return w.tiles.find((t) => t.suit === 'heart' && t.owner !== this.player) ?? w.tiles.find((t) => t.suit === 'heart') ?? null;
    // Case libre la plus proche du camp du joueur.
    const home = this.targetTile('myCamp');
    const free = w.tiles.filter((t) => t.kind === 'bonus' && t.owner === NO_TEAM);
    if (!free.length) return null;
    const ref = home ?? free[0];
    return free.sort((a, b) => Math.hypot(a.cx - ref.cx, a.cy - ref.cy) - Math.hypot(b.cx - ref.cx, b.cy - ref.cy))[0];
  }
}

/** Le directeur offre de quoi essayer : le solde est complété jusqu'à `n` bons points. */
function topUp(w: World, team: number, n: number): void {
  const have = meritsOf(w, team);
  if (have < n) awardMerit(w, team, n - have, w.map.w / 2, w.map.h / 2, 'hold');
}
