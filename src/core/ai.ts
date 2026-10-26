import { AI_PROFILES, type AiProfile } from '../config';
import { EconomyAi } from './ai-economy';
import { goldenAiBonus, goldenRetarget } from './events';
import { pointVisible, unitVisible } from './fog';
import { nearestSupervisor, supervisorsNear, type Supervisor } from './supervisors';
import { ghostAiBonus } from './ghosts';
import { kingAiScore, kingDefenseExtra, kingGarrison, kingRetarget } from './king';
import type { Tile } from './tile';
import { NO_TEAM, type Difficulty } from './types';
import type { Unit } from './unit';
import type { World } from './world';

const TAG_FREE = 0;
const TAG_DEFEND = 1;
const TAG_ATTACK = 2;
const TAG_RALLY = 3;
/** Option « Surveillants » : taille de groupe à partir de laquelle l'IA va mettre un surveillant KO. */
export const AI_SUPERVISOR_GROUP = 8;
/** Groupe suffisant pour dégager un surveillant qui garde la cible visée. */
export const AI_SUPERVISOR_BLOCK_GROUP = 6;

/** Élève prêté à un allié (appel à l'aide, voir diplomacy-extras.ts) : l'IA ne le commande plus. */
export const TAG_LOANED = 4;

/**
 * Contrôleur d'une équipe IA.
 *  - évalue les cases voisines et faibles ;
 *  - garde une part de ses élèves près de ses cases ;
 *  - regroupe les élèves libres avant de lancer une attaque ;
 *  - renvoie des défenseurs sur ses cases menacées ;
 *  - ne cible ni ne craint ses alliés, et peut aider à défendre une case alliée proche.
 */
export class TeamAi {
  readonly profile: AiProfile;
  /** Dépenses de bons points (améliorations de camp…). */
  readonly economy: EconomyAi;
  private timer: number;
  private target: Tile | null = null;
  private targetSince = 0;

  constructor(
    readonly world: World,
    readonly team: number,
    difficulty: Difficulty,
  ) {
    this.profile = AI_PROFILES[difficulty];
    this.economy = new EconomyAi(world, team, difficulty);
    // Décalage initial pour que les IA ne jouent pas toutes au même instant.
    this.timer = 0.5 + team * 0.4;
  }

  private fightSupervisor(strikers: Unit[], target: Tile): boolean {
    return planSupervisorFight(this, strikers, target);
  }

  update(dt: number): void {
    this.economy.update(dt);
    this.timer -= dt;
    if (this.timer > 0) return;
    const p = this.profile;
    this.timer = p.reaction * (0.8 + 0.4 * this.world.rng.next());
    this.think();
  }

  private think(): void {
    const w = this.world;
    const mine = w.units.filter((u) => u.team === this.team && u.alive && !u.pion && u.aiTag !== TAG_LOANED);
    if (mine.length === 0) return;
    for (const u of mine) if (u.order.kind === 'none' && u.aiTag !== TAG_RALLY) u.aiTag = TAG_FREE;

    const owned = w.tiles.filter((t) => t.owner === this.team);
    // Ennemis visibles autour d'un point : requête dans le hash spatial du monde (pas de parcours de tous les élèves).
    const enemiesNear = (x: number, y: number, r: number): number => {
      let n = 0;
      w.hash.query(x, y, r, (e) => {
        if (e.alive && !w.isFriend(e.team, this.team) && Math.hypot(e.x - x, e.y - y) < r && unitVisible(w, this.team, e)) n++;
      });
      return n;
    };

    // --- Défense des cases menacées ---------------------------------------
    for (const t of owned) {
      const threat = enemiesNear(t.cx, t.cy, 2.6);
      const capturing = t.capTeam !== NO_TEAM && !w.isFriend(t.capTeam, this.team);
      if (threat === 0 && !capturing) continue;
      const defendersNear = mine.filter((u) => Math.hypot(u.x - t.cx, u.y - t.cy) < 2.2).length;
      // Un camp menacé est défendu en priorité et plus largement.
      const need = Math.ceil(threat * (t.isCamp ? 1.6 : 1.2) + (capturing ? (t.isCamp ? 4 : 2) : 0) + kingDefenseExtra(w, t, threat, capturing)) - defendersNear;
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

    // --- Aide à un allié : une case alliée qu'un ennemi est en train de prendre ---
    for (const t of w.tiles) {
      if (t.owner === NO_TEAM || !w.isAllied(t.owner, this.team)) continue;
      if (t.capTeam === NO_TEAM || w.isFriend(t.capTeam, this.team) || t.cap < 0.15) continue;
      const near = mine.filter((u) => u.aiTag === TAG_FREE && dist(u, t) < 5).sort((a, b) => dist(a, t) - dist(b, t));
      const helpers = near.slice(0, Math.min(3, Math.floor(near.length / 2)));
      if (helpers.length) {
        w.orderMove(helpers, { x: t.cx, y: t.cy }, true);
        for (const u of helpers) u.aiTag = TAG_DEFEND;
      }
    }

    // --- Roi de la cour : garnison sur le trône tenu ---------------------------
    const garrison = kingGarrison(w, this.team, mine.length);
    if (garrison) {
      const t = garrison.tile;
      const onIt = mine.filter((u) => t.contains(u.x, u.y));
      for (const u of onIt.slice(0, garrison.size)) u.aiTag = TAG_DEFEND;
      const more = mine
        .filter((u) => u.aiTag !== TAG_DEFEND && u.state !== 'attacking' && !t.contains(u.x, u.y))
        .sort((a, b) => dist(a, t) - dist(b, t))
        .slice(0, Math.max(0, garrison.size - onIt.length));
      if (more.length) {
        w.orderMove(more, { x: t.cx, y: t.cy }, true);
        for (const u of more) u.aiTag = TAG_DEFEND;
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

    // Option « Surveillants » : une cible gardée par un surveillant n'est pas pour un petit groupe.
    const fewForSup = strikers.length < AI_SUPERVISOR_BLOCK_GROUP;
    if (this.target && fewForSup && w.time - this.targetSince > 3 && supervisorsNear(w, this.target.cx, this.target.cy, 2.5) > 0) this.target = null;
    if (this.target && (w.isFriend(this.target.owner, this.team) || w.time - this.targetSince > 25 || goldenRetarget(w, this.target, this.targetSince) || kingRetarget(w, this.team, this.target, this.targetSince))) this.target = null;
    if (!this.target) {
      let best: Tile | null = null;
      let bestScore = -Infinity;
      for (const t of w.tiles) {
        if (t.owner === this.team || (t.owner !== NO_TEAM && w.isFriend(t.owner, this.team))) continue;
        // Un allié est déjà en train de la prendre : on la lui laisse.
        if (t.capTeam !== NO_TEAM && t.cap > 0 && w.isAllied(t.capTeam, this.team)) continue;
        const enemyNear = enemiesNear(t.cx, t.cy, 2.5);
        let score = t.owner === NO_TEAM ? 1.0 : this.profile.aggression;
        if (t.isCamp) score = this.profile.aggression * 1.3; // prendre un camp coupe la production adverse
        else if (t.suit === 'heart' || t.suit === 'club') score += 0.15;
        else if (t.suit === 'diamond') score -= 0.1;
        score -= 0.09 * Math.hypot(t.cx - centroid.x, t.cy - centroid.y);
        score -= 0.22 * enemyNear;
        // Option « Surveillants » : un petit groupe évite les cases gardées, un gros groupe s'en moque.
        score -= (strikers.length >= AI_SUPERVISOR_GROUP ? 0.1 : 0.6) * supervisorsNear(w, t.cx, t.cy, 2.5);
        if (t.capTeam === this.team) score += 0.6;
        if (t.contested) score += 0.2;
        score += goldenAiBonus(w, t);
        score += ghostAiBonus(w, t, this.team);
        score += kingAiScore(w, t, enemyNear);
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

    if (this.fightSupervisor(strikers, target)) return;

    const enemyAtTarget = enemiesNear(target.cx, target.cy, 2.5);
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

export interface SupervisorPlanHost {
  world: World;
  team: number;
}

/**
 * Option « Surveillants » : l'IA attaque un surveillant visible quand elle a un groupe nettement
 * supérieur à proximité (AI_SUPERVISOR_GROUP élèves, moins s'il est déjà blessé), ou quand il garde
 * la case visée et que le groupe est assez gros pour le dégager. Retourne vrai si l'ordre est donné.
 */
export function planSupervisorFight(host: SupervisorPlanHost, strikers: readonly Unit[], target: Tile): boolean {
  const w = host.world;
  if (!w.rules.supervisors || strikers.length === 0) return false;
  const seen = (s: Supervisor) => pointVisible(w, host.team, s.x, s.y);
  const c = center(strikers as Unit[]);
  const blocking = nearestSupervisor(w, target.cx, target.cy, 2.8, seen);
  const s = blocking ?? nearestSupervisor(w, c.x, c.y, 6, seen);
  if (!s) return false;
  const close = strikers.filter((u) => d2(u, s) < 36);
  const hurt = Math.max(0.5, s.hp / s.maxHp);
  const need = Math.ceil((blocking ? AI_SUPERVISOR_BLOCK_GROUP : AI_SUPERVISOR_GROUP) * hurt);
  if (close.length < need) return false;
  const go = close.filter((u) => u.supId !== s.id);
  if (go.length) w.orderAttackSupervisor(go, s);
  for (const u of close) u.aiTag = TAG_ATTACK;
  return true;
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
