// Logique pure des contrôles au doigt (groupes mémorisés, repli au camp, double-tap,
// sélection à l'écran). Aucun accès au DOM : testée par Vitest.

import type { Vec2 } from './types';

/** Nombre de groupes mémorisables (boutons « 1 », « 2 », « 3 »). */
export const GROUP_COUNT = 3;

/** Groupes mémorisés : pour chaque emplacement, les identifiants des élèves enregistrés. */
export class ControlGroups {
  private groups: number[][];

  constructor(count = GROUP_COUNT) {
    this.groups = Array.from({ length: count }, () => []);
  }

  get count(): number {
    return this.groups.length;
  }

  /** Enregistre une sélection dans un groupe (remplace l'ancien contenu). Faux si l'emplacement n'existe pas. */
  save(index: number, ids: Iterable<number>): boolean {
    if (!this.valid(index)) return false;
    this.groups[index] = [...new Set(ids)];
    return true;
  }

  /** Élèves encore en vie du groupe ; les disparus sont oubliés au passage. */
  recall(index: number, isAlive: (id: number) => boolean): number[] {
    if (!this.valid(index)) return [];
    const alive = this.groups[index].filter(isAlive);
    this.groups[index] = alive;
    return alive.slice();
  }

  /** Nombre d'élèves vivants du groupe (sans modifier le groupe). */
  aliveCount(index: number, isAlive: (id: number) => boolean): number {
    if (!this.valid(index)) return 0;
    let n = 0;
    for (const id of this.groups[index]) if (isAlive(id)) n++;
    return n;
  }

  /** Identifiants enregistrés (vivants ou non), pour inspection. */
  ids(index: number): readonly number[] {
    return this.valid(index) ? this.groups[index] : [];
  }

  clear(index: number): void {
    if (this.valid(index)) this.groups[index] = [];
  }

  private valid(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.groups.length;
  }
}

/** Centre (moyenne) d'un ensemble de positions, ou null si vide. */
export function centroid(points: readonly Vec2[]): Vec2 | null {
  if (points.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export interface CampLike {
  isCamp: boolean;
  owner: number;
  cx: number;
  cy: number;
}

/** Camp de l'équipe le plus proche d'un point, ou null si l'équipe n'en possède aucun. */
export function nearestOwnCamp<T extends CampLike>(tiles: readonly T[], team: number, from: Vec2): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const t of tiles) {
    if (!t.isCamp || t.owner !== team) continue;
    const d = (t.cx - from.x) ** 2 + (t.cy - from.y) ** 2;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

/**
 * Détection d'un second tap rapide sur la même cible (élève, bouton de groupe…).
 * `hit` renvoie vrai si ce tap complète un double-tap ; le tap suivant repart de zéro.
 */
export class DoubleTap {
  private lastTime = -Infinity;
  private lastKey: string | number | null = null;
  private lastPos: Vec2 | null = null;

  constructor(
    readonly maxDelayMs = 350,
    readonly maxDist = 36,
  ) {}

  hit(now: number, key: string | number, pos?: Vec2): boolean {
    const near = !pos || !this.lastPos || Math.hypot(pos.x - this.lastPos.x, pos.y - this.lastPos.y) <= this.maxDist;
    const ok = key === this.lastKey && now - this.lastTime <= this.maxDelayMs && near;
    if (ok) {
      this.reset();
      return true;
    }
    this.lastTime = now;
    this.lastKey = key;
    this.lastPos = pos ? { x: pos.x, y: pos.y } : null;
    return false;
  }

  reset(): void {
    this.lastTime = -Infinity;
    this.lastKey = null;
    this.lastPos = null;
  }
}

/** Le point écran est-il dans la vue (avec une marge éventuelle, négative pour rogner) ? */
export function onScreen(p: Vec2, viewW: number, viewH: number, margin = 0): boolean {
  return p.x >= -margin && p.x <= viewW + margin && p.y >= -margin && p.y <= viewH + margin;
}
