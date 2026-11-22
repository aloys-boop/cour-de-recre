import { Rng } from './rng';

/**
 * Accueil vivant (v5.23, saison 2, interface c) : derrière le titre, une bande de cour où
 * des élèves de toutes les couleurs jouent au chat. Le « chat » (étoile au-dessus de la tête)
 * poursuit l'élève libre le plus proche ; ceux qu'il approche détalent ; quand il en touche un,
 * « Touché ! », les rôles s'échangent et le nouveau chat compte un instant avant de repartir.
 * Choisir une équipe au menu fait sauter de joie l'élève de cette couleur (« Moi ! »).
 *
 * Logique pure (sans navigateur) : positions en pixels CSS le long de la bande, profondeur
 * `lane` de 0 (fond) à 1 (devant). Le dessin vit dans `ui/menu-backdrop.ts`.
 */

export const SCENE = {
  /** Marge aux deux bouts de la bande (px). */
  margin: 18,
  /** Vitesses (px/s). */
  wander: [32, 52] as const,
  flee: 78,
  chase: 86,
  /** Distance à laquelle un élève libre voit venir le chat (px). */
  fear: 120,
  /** Contact : écart horizontal (px) et de profondeur. */
  touchX: 14,
  touchLane: 0.3,
  /** Le nouveau chat compte avant de repartir (s). */
  count: 0.8,
  /** L'ancien chat ne peut pas être retouché tout de suite (s). */
  immune: 1.6,
  /** Saut de joie : durée (s), hauteur (px), nombre de bonds. */
  hopTime: 0.9,
  hopHeight: 9,
  hops: 2,
  /** Onomatopées : durée de vie (s) et nombre au plus. */
  popLife: 0.9,
  popMax: 3,
  /** Vitesse de changement de profondeur (par seconde). */
  laneSpeed: 0.45,
  /** Pas maximal d'une mise à jour (s) : un onglet revenu de veille ne téléporte personne. */
  maxStep: 0.1,
} as const;

export type KidRole = 'chat' | 'libre';

export interface SceneKid {
  team: number;
  x: number;
  lane: number;
  /** Vitesse horizontale actuelle (px/s), signe = sens de la course. */
  vx: number;
  /** Regard : 1 vers la droite, -1 vers la gauche. */
  face: 1 | -1;
  role: KidRole;
  /** Immobile (le chat qui compte) jusqu'à 0. */
  freeze: number;
  /** Ne peut pas être touché jusqu'à 0. */
  immune: number;
  /** Saut de joie en cours (s restantes). */
  hop: number;
  /** But de promenade (élève libre tranquille). */
  goalX: number;
  goalLane: number;
  /** Horloge propre (pas de course). */
  t: number;
}

export interface ScenePop {
  text: string;
  x: number;
  lane: number;
  t: number;
  team: number;
}

/** Nombre d'élèves selon la largeur de la bande (un par équipe au plus). */
export function kidCount(width: number, teams = 8): number {
  return Math.max(3, Math.min(teams, Math.round(width / 105)));
}

/** Hauteur du saut de joie à l'instant où il reste `left` secondes. */
export function hopOffset(left: number): number {
  if (left <= 0) return 0;
  const k = 1 - left / SCENE.hopTime; // 0 → 1
  return Math.abs(Math.sin(k * Math.PI * SCENE.hops)) * SCENE.hopHeight * (1 - k * 0.35);
}

/** Image de course (0 à 3) d'après le pas, ou -1 à l'arrêt. */
export function runFrame(kid: SceneKid): number {
  if (Math.abs(kid.vx) < 4 || kid.freeze > 0) return -1;
  return Math.floor(kid.t * 8) % 4;
}

export class MenuScene {
  kids: SceneKid[] = [];
  pops: ScenePop[] = [];
  /** Nombre de « Touché ! » depuis le début (tests). */
  tags = 0;
  private rng: Rng;

  constructor(
    public width: number,
    seed = 7,
    teams = 8,
  ) {
    this.rng = new Rng(seed);
    const n = kidCount(width, teams);
    // Couleurs mélangées, puis réparties le long de la bande.
    const colors = Array.from({ length: teams }, (_, i) => i);
    for (let i = colors.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    for (let i = 0; i < n; i++) {
      const x = this.lo + ((i + 0.5) / n) * (this.hi - this.lo);
      this.kids.push({
        team: colors[i],
        x,
        lane: this.rng.next(),
        vx: 0,
        face: this.rng.next() < 0.5 ? 1 : -1,
        role: 'libre',
        freeze: 0,
        immune: 0,
        hop: 0,
        goalX: x,
        goalLane: this.rng.next(),
        t: this.rng.next(),
      });
    }
    const first = this.kids[this.rng.int(0, n - 1)];
    first.role = 'chat';
    first.freeze = SCENE.count;
  }

  private get lo(): number {
    return SCENE.margin;
  }
  private get hi(): number {
    return Math.max(SCENE.margin + 1, this.width - SCENE.margin);
  }

  /** La bande change de largeur (rotation, fenêtre) : tout le monde reste dedans. */
  setWidth(w: number): void {
    this.width = w;
    for (const k of this.kids) {
      k.x = Math.min(this.hi, Math.max(this.lo, k.x));
      k.goalX = Math.min(this.hi, Math.max(this.lo, k.goalX));
    }
  }

  get chat(): SceneKid {
    return this.kids.find((k) => k.role === 'chat') ?? this.kids[0];
  }

  /** L'élève de cette couleur saute de joie (équipe choisie au menu). Faux s'il n'est pas dans la cour. */
  cheer(team: number): boolean {
    const k = this.kids.find((x) => x.team === team);
    if (!k) return false;
    k.hop = SCENE.hopTime;
    this.pop('Moi !', k);
    return true;
  }

  private pop(text: string, k: SceneKid): void {
    this.pops.push({ text, x: k.x, lane: k.lane, t: 0, team: k.team });
    if (this.pops.length > SCENE.popMax) this.pops.splice(0, this.pops.length - SCENE.popMax);
  }

  step(dtIn: number): void {
    const dt = Math.min(SCENE.maxStep, Math.max(0, dtIn));
    if (dt === 0) return;
    const chat = this.chat;
    for (const k of this.kids) {
      k.freeze = Math.max(0, k.freeze - dt);
      k.immune = Math.max(0, k.immune - dt);
      k.hop = Math.max(0, k.hop - dt);
      let want = 0;
      let wantLane = k.lane;
      if (k.hop > 0 || k.freeze > 0) {
        want = 0;
      } else if (k.role === 'chat') {
        const prey = this.nearestPrey(k);
        if (prey) {
          const dx = prey.x - k.x;
          want = Math.sign(dx) * Math.min(SCENE.chase, Math.abs(dx) * 6);
          wantLane = prey.lane;
        }
      } else {
        const dx = k.x - chat.x;
        const near = Math.abs(dx) < SCENE.fear && chat.freeze <= 0 && k.immune <= 0;
        if (near) {
          let dir = dx === 0 ? (k.x < this.width / 2 ? 1 : -1) : Math.sign(dx);
          // Coincé contre un bout : il tente de passer à côté du chat (en changeant de profondeur).
          const cornered = (dir < 0 && k.x <= this.lo + 6) || (dir > 0 && k.x >= this.hi - 6);
          if (cornered) {
            dir = -dir;
            wantLane = chat.lane < 0.5 ? 1 : 0;
          } else wantLane = k.lane;
          want = dir * SCENE.flee;
          k.goalX = k.x;
        } else {
          if (Math.abs(k.goalX - k.x) < 4) {
            if (this.rng.next() < dt * 0.9) {
              k.goalX = this.rng.range(this.lo, this.hi);
              k.goalLane = this.rng.next();
            }
          } else {
            want = Math.sign(k.goalX - k.x) * this.rng.range(SCENE.wander[0], SCENE.wander[1]);
            wantLane = k.goalLane;
          }
        }
      }
      // Accélération douce : les élèves ne virent pas sur place.
      k.vx += (want - k.vx) * Math.min(1, dt * 8);
      k.x = Math.min(this.hi, Math.max(this.lo, k.x + k.vx * dt));
      const dl = wantLane - k.lane;
      k.lane += Math.sign(dl) * Math.min(Math.abs(dl), SCENE.laneSpeed * dt);
      if (Math.abs(k.vx) > 6) k.face = k.vx > 0 ? 1 : -1;
      k.t += dt * Math.max(0.3, Math.abs(k.vx) / 55);
    }
    // Contact : rôles échangés.
    if (chat.freeze <= 0 && chat.hop <= 0) {
      for (const k of this.kids) {
        if (k === chat || k.immune > 0) continue;
        if (Math.abs(k.x - chat.x) <= SCENE.touchX && Math.abs(k.lane - chat.lane) <= SCENE.touchLane) {
          chat.role = 'libre';
          chat.immune = SCENE.immune;
          chat.goalX = chat.x;
          k.role = 'chat';
          k.freeze = SCENE.count;
          k.vx = 0;
          this.tags++;
          this.pop('Touché !', k);
          break;
        }
      }
    }
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < SCENE.popLife);
  }

  private nearestPrey(chat: SceneKid): SceneKid | null {
    let best: SceneKid | null = null;
    let bd = Infinity;
    for (const k of this.kids) {
      if (k === chat || k.immune > 0) continue;
      const d = Math.abs(k.x - chat.x) + Math.abs(k.lane - chat.lane) * 40;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  }

  /** Ordre de dessin : du fond vers le devant. */
  drawOrder(): SceneKid[] {
    return [...this.kids].sort((a, b) => a.lane - b.lane);
  }
}

/** Retournement de carte (choix d'équipe, onglets) : la carte arrive de la tranche (ms). */
export const FLIP_MS = 240;

/** Délai d'apparition de la n-ième case d'une jauge (ms) : elles se remplissent l'une après l'autre. */
export function gaugeDelay(index: number, row = 0): number {
  return row * 40 + index * 55;
}
