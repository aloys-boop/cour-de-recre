import { TUNING } from '../config';
import { dirFromVector } from './math';
import type { Anim, Dir, UnitOrder, Vec2 } from './types';
import type { UnitClass } from './classes';
import type { Tile } from './tile';

export type UnitState = 'idle' | 'moving' | 'attacking' | 'ko';

let nextId = 1;
export function resetUnitIds(): void {
  nextId = 1;
}

export class Unit {
  readonly id: number;
  readonly team: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dir: Dir = 1;
  anim: Anim = 'idle';
  animTime = 0;
  state: UnitState = 'idle';
  /** Ordre explicite donné par le joueur ou l'IA. */
  order: UnitOrder = { kind: 'none', target: { x: 0, y: 0 } };
  /** Chemin courant (centres de cellules). */
  path: Vec2[] = [];
  /** Identifiant de l'ennemi engagé au contact, ou -1. */
  engagedId = -1;
  attackCooldown = 0;
  /** Temps restant avant que le coup en cours ne porte (0 si aucun). */
  pendingHit = 0;
  koTimer = 0;
  /** Vitesse de recul. */
  kx = 0;
  ky = 0;
  /** Décalage du tirage au sort pour étaler les recherches de cibles. */
  phase: number;
  /** Instant de la dernière recherche de cible. */
  lastScan = 0;
  /** Dernière destination du chemin calculé (pour re-calculer si la cible bouge). */
  pathGoal: Vec2 | null = null;
  /** Chemin réel en attente de calcul (file de World) : en attendant, l'élève va tout droit. */
  pathPending = false;
  /** Champ libre pour l'IA (rôle courant). */
  aiTag = 0;
  /** Instant (temps du monde) du dernier soin reçu sur un camp ou un cœur, -1 sinon. */
  healedAt = -1;
  /** Option « Surveillants » : identifiant du surveillant combattu (0 : aucun ; exclusif avec engagedId). */
  supId = 0;
  /** Multiplicateurs propres à l'élève (améliorations de son camp d'origine, classe), en plus de ceux de l'équipe. */
  /** Classe d'élève (voir classes.ts). */
  cls: UnitClass = 'eleve';
  /** Figé par une sonnerie jusqu'à cet instant (temps du monde). */
  frozenUntil = 0;
  /** Pion (surveillant d'équipe, voir pion.ts) et son camp. */
  pion = false;
  home: Tile | null = null;
  hpMul = 1;
  dmgMul = 1;
  speedMul = 1;

  constructor(team: number, x: number, y: number) {
    this.id = nextId++;
    this.team = team;
    this.x = x;
    this.y = y;
    this.hp = TUNING.unitHp;
    this.maxHp = TUNING.unitHp;
    this.phase = (this.id * 0.137) % 1;
  }

  get alive(): boolean {
    return this.state !== 'ko';
  }

  get pos(): Vec2 {
    return { x: this.x, y: this.y };
  }

  face(tx: number, ty: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    if (dx !== 0 || dy !== 0) this.dir = dirFromVector(dx, dy);
  }

  setAnim(a: Anim): void {
    if (this.anim !== a) {
      this.anim = a;
      this.animTime = 0;
    }
  }

  clearOrder(): void {
    this.order = { kind: 'none', target: { x: this.x, y: this.y } };
    this.path = [];
    this.pathGoal = null;
    this.pathPending = false;
  }

  /** Inflige des dégâts ; retourne vrai si l'élève vient d'être mis KO. */
  takeDamage(amount: number, fromX: number, fromY: number): boolean {
    if (this.state === 'ko') return false;
    this.hp -= amount;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    // Un pion (adulte) recule à peine.
    const k = TUNING.knockback * 4 * (this.pion ? 0.15 : 1);
    this.kx += (dx / d) * k;
    this.ky += (dy / d) * k;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'ko';
      this.koTimer = TUNING.koSeconds;
      this.setAnim('ko');
      this.clearOrder();
      this.engagedId = -1;
      this.supId = 0;
      return true;
    }
    return false;
  }
}

/** Dégâts d'un coup de poing (tirage dans l'intervalle de réglage). */
export function punchDamage(random: () => number): number {
  return Math.round(TUNING.punchDamageMin + (TUNING.punchDamageMax - TUNING.punchDamageMin) * random());
}
