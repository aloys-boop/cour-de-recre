import { AI_PROFILES, type AiProfile } from '../config';
import type { Tile } from './tile';
import { NO_TEAM, type Difficulty } from './types';
import type { Unit } from './unit';
import type { World } from './world';

const TAG_FREE = 0;
const TAG_DEFEND = 1;
const TAG_ATTACK = 2;
const TAG_RALLY = 3;

/**
 * Contrôleur d'une équipe IA.
 *  - évalue les cases voisines et faibles ;
 *  - garde une part de ses élèves près de ses cases ;
 *  - regroupe les élèves libres avant de lancer une attaque ;
 *  - renvoie des défenseurs sur ses cases menacées.
 */
export class TeamAi {
  readonly profile: AiProfile;
  private timer: number;
  private target: Tile | null = null;
  private targetSince = 0;

  constructor(
    readonly world: World,
    readonly team: number,
    difficulty: Difficulty,
  ) {
    this.profile = AI_PROFILES[difficulty];
    // Décalage initial pour que les IA ne jouent pas toutes au même instant.
    this.timer = 0.5 + team * 0.4;
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    const p = this.profile;
    this.timer = p.reaction * (0.8 + 0.4 * this.world.rng.next());
    this.think();
  }

  private think(): void {
    const w = this.world;
    const mine = w.units.filter((u) => u.team === this.team && u.alive);
    if (mine.length === 0) return;
    for (const u of mine) if (u.order.kind === 'none' && u.aiTag !== TAG_RALLY) u.aiTag = TAG_FREE;

    const owned = w.tiles.filter((t) => t.owner === this.team);
    const enemies = w.units.filter((u) => u.team !== this.team && u.alive);

    // --- Défense des cases menacées ---------------------------------------
    for (const t of owned) {
      const threat = enemies.filter((e) => Math.hypot(e.x - t.cx, e.y - t.cy) < 2.6).length;
      const capturing = t.capTeam !== NO_TEAM && t.capTeam !== this.team;
      if (threat === 0 && !capturing) continue;
      const defendersNear = mine.filter((u) => Math.hypot(u.x - t.cx, u.y - t.cy) < 2.2).length;
      // Un camp menacé est défendu en priorité et plus largement.
      const need = Math.ceil(threat * (t.isCamp ? 1.6 : 1.2) + (capturing ? (t.isCamp ? 4 : 2) : 0)) - defendersNear;
      if (need <= 0) continue;
      const candidates = mine
        .filter((u) => u.aiTag !== TAG_DEFEND && u.state !== 'attacking')
        .sort((a, b) => dist(a, t) - dist(b, t))
        .slice(0, need);
      if (candidates.length) {
        w.orderMove(candidates, { x: t.cx, y: t.cy }, true);
        for (const u of candidates) u.aiTag = TAG_DEFEND;
      }
    }

    // --- Choix de la cible --------------------------------------------------
    const free = mine.filter((u) => u.aiTag === TAG_FREE || u.aiTag === TAG_RALLY);
    if (free.length === 0) return;
    const centroid = center(free);
    const total = mine.length;
    const homeGuard = Math.floor(total * this.profile.keepHome);
    const available = free.slice().sort((a, b) => d2(a, centroid) - d2(b, centroid));
    // Les élèves restant « à la maison » sont ceux qui sont déjà près d'une case possédée.
    const guards = new Set<Unit>();
    for (const u of available) {
      if (guards.size >= homeGuard) break;
      if (owned.some((t) => Math.hypot(u.x - t.cx, u.y - t.cy) < 1.5)) guards.add(u);
    }
    const strikers = available.filter((u) => !guards.has(u));
    if (strikers.length === 0) return;

    if (this.target && (this.target.owner === this.team || w.time - this.targetSince > 25)) this.target = null;
    if (!this.target) {
      let best: Tile | null = null;
      let bestScore = -Infinity;
      for (const t of w.tiles) {
        if (t.owner === this.team) continue;
        const enemyNear = enemies.filter((e) => Math.hypot(e.x - t.cx, e.y - t.cy) < 2.5).length;
        let score = t.owner === NO_TEAM ? 1.0 : this.profile.aggression;
        if (t.isCamp) score = this.profile.aggression * 1.3; // prendre un camp coupe la production adverse
        else if (t.suit === 'heart' || t.suit === 'club') score += 0.15;
        else if (t.suit === 'diamond') score -= 0.1;
        score -= 0.09 * Math.hypot(t.cx - centroid.x, t.cy - centroid.y);
        score -= 0.22 * enemyNear;
        if (t.capTeam === this.team) score += 0.6;
        if (t.contested) score += 0.2;
        score += w.rng.next() * 0.15;
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }
      this.target = best;
      this.targetSince = w.time;
    }
    const target = this.target;
    if (!target) return;

    const enemyAtTarget = enemies.filter((e) => Math.hypot(e.x - target.cx, e.y - target.cy) < 2.5).length;
    const needed = Math.max(this.profile.groupMin, Math.ceil(enemyAtTarget * 1.3) + 1);

    // Les élèves déjà en route vers la cible comptent dans le groupe.
    const onTheWay = mine.filter((u) => u.aiTag === TAG_ATTACK && u.order.kind !== 'none').length;
    const grouped = strikers.filter((u) => d2(u, centroid) < this.profile.rallyRadius ** 2 * 2.5);

    if (grouped.length + onTheWay >= needed || strikers.length >= needed * 2) {
      const squad = strikers.slice(0, Math.max(needed, Math.ceil(strikers.length * 0.8)));
      w.orderMove(squad, { x: target.cx, y: target.cy }, true);
      for (const u of squad) u.aiTag = TAG_ATTACK;
    } else {
      // Regroupement : on se rassemble entre le centre du groupe et la cible.
      const rally = {
        x: centroid.x + (target.cx - centroid.x) * 0.25,
        y: centroid.y + (target.cy - centroid.y) * 0.25,
      };
      const toRally = strikers.filter((u) => d2(u, rally) > this.profile.rallyRadius ** 2);
      if (toRally.length) {
        w.orderMove(toRally, rally, true);
        for (const u of toRally) u.aiTag = TAG_RALLY;
      }
    }
  }
}

function dist(u: Unit, t: Tile): number {
  return Math.hypot(u.x - t.cx, u.y - t.cy);
}

function d2(u: Unit, p: { x: number; y: number }): number {
  const dx = u.x - p.x;
  const dy = u.y - p.y;
  return dx * dx + dy * dy;
}

function center(units: Unit[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const u of units) {
    x += u.x;
    y += u.y;
  }
  return { x: x / units.length, y: y / units.length };
}
