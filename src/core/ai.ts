import { assignConquest, squadMembers } from './squads';
import { AI_ATTENTION, AI_PROFILES, type AiAttention, type AiProfile } from '../config';
import { EconomyAi } from './ai-economy';
import { goldenAiBonus, goldenRetarget } from './events';
import { pointVisible, unitVisible } from './fog';
import { nearestSupervisor, supervisorsNear, type Supervisor } from './supervisors';
import { ghostAiBonus } from './ghosts';
import { assignGuards, guardCounts } from './garrison';
import { kingAiScore, kingDefenseExtra, kingGarrison, kingRetarget } from './king';
import type { Tile } from './tile';
import { NO_TEAM, type Difficulty } from './types';
import type { Unit } from './unit';
import type { World } from './world';

const TAG_FREE = 0;
const TAG_DEFEND = 1;
const TAG_ATTACK = 2;
const TAG_RALLY = 3;
/** Élève envoyé sur le second front (harcèlement, voir TeamAi.harassSize). */
const TAG_HARASS = 5;
/** Distance minimale (cellules) entre la cible principale et celle du harcèlement. */
export const HARASS_MIN_GAP = 5;
/** Rayon (cellules) sans ennemi visible exigé autour d'une case pour la harceler. */
export const HARASS_CLEAR = 3.5;

/** Secours de ses propres cases par l'IA (voir TeamAi.selfRescue). */
export type RescueMode = 'all' | 'camps' | 'none';
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
 * Son attention est limitée comme celle d'un humain (voir AI_ATTENTION) : un budget d'ordres
 * par minute, un nombre de cases secourues à la fois, et un délai avant de remarquer chaque attaque.
 */
export class TeamAi {
  readonly profile: AiProfile;
  /** Dépenses de bons points (améliorations de camp…). */
  readonly economy: EconomyAi;
  private timer: number;
  private target: Tile | null = null;
  private targetSince = 0;
  /** Attention (budget d'ordres, fronts, délai de réaction). */
  readonly attention: AiAttention;
  /** Ordres encore disponibles (se recharge à `ordersPerMin` par minute, jusqu'à `burst`). */
  private tokens: number;
  /** Nombre total d'ordres donnés depuis le début de la partie (mesures). */
  ordersGiven = 0;
  /** Instant où chaque case possédée a été vue menacée pour la première fois (délai propre à chaque case). */
  private threatSince = new Map<Tile, number>();
  /**
   * Garnisons (outils de mesure, « joueur témoin » stratège) : nombre de gardes laissés sur
   * chaque case bonus prise, un ordre par case. 0 (par défaut) : l'IA ne pose pas de garnison.
   */
  garrisonSize = 0;
  /** Part maximale de l'armée laissée en garnison (avec garrisonSize). */
  garrisonShare = 0.25;
  /**
   * Secours de ses propres cases (outils de mesure, « joueur témoin » humain, point 1.1 bis) :
   * 'all' (par défaut) secourt toute case menacée, 'camps' seulement ses camps (comme un joueur
   * qui ne réagit qu'à l'alerte « camp attaqué »), 'none' jamais.
   */
  selfRescue: RescueMode = 'all';
  /**
   * Harcèlement (« joueur témoin » humain) : taille du petit groupe envoyé sur un second front,
   * loin de la cible principale, pendant que le gros de l'armée attaque. 0 : pas de second front.
   */
  harassSize = 0;
  /**
   * Escouade en conquête (consigne « Conquérir », v5.11) : taille de l'escouade que l'IA laisse
   * prendre seule les cases libres ou faibles. Une à la fois, reformée quand elle a disparu,
   * seulement si l'armée libre suffit encore pour le groupe principal. 0 : pas d'escouade.
   */
  conquestSize = 0;
  private harassTarget: Tile | null = null;
  private harassSince = 0;

  constructor(
    readonly world: World,
    readonly team: number,
    difficulty: Difficulty,
    /** Réglages remplacés (outils d'équilibrage, « joueur témoin »). */
    override?: Partial<AiProfile>,
    /** Attention remplacée (joueur témoin, mesures sans limite). */
    attention?: Partial<AiAttention>,
  ) {
    this.profile = override ? { ...AI_PROFILES[difficulty], ...override } : AI_PROFILES[difficulty];
    this.attention = attention ? { ...AI_ATTENTION[difficulty], ...attention } : AI_ATTENTION[difficulty];
    this.tokens = this.attention.burst;
    this.economy = new EconomyAi(world, team, difficulty);
    this.economy.targetOf = () => this.target;
    // Décalage initial pour que les IA ne jouent pas toutes au même instant.
    this.timer = 0.5 + team * 0.4;
  }

  private fightSupervisor(strikers: Unit[], target: Tile): boolean {
    return planSupervisorFight(this, strikers, target);
  }

  /** Ordres disponibles maintenant (arrondi inférieur). */
  get ordersAvailable(): number {
    return Math.floor(this.tokens);
  }

  /** Consomme un ordre du budget ; faux si l'IA n'a plus d'attention disponible. */
  private spend(): boolean {
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    this.ordersGiven++;
    return true;
  }

  update(dt: number): void {
    this.economy.update(dt);
    const a = this.attention;
    this.tokens = Math.min(a.burst, this.tokens + (dt * a.ordersPerMin) / 60);
    this.timer -= dt;
    if (this.timer > 0) return;
    const p = this.profile;
    this.timer = p.reaction * (0.8 + 0.4 * this.world.rng.next());
    this.think();
  }

  /**
   * Harcèlement : quand l'armée libre est assez nombreuse (de quoi former le groupe principal en
   * plus du petit groupe), `harassSize` élèves partent prendre une case faible, à au moins
   * HARASS_MIN_GAP cellules de la cible principale. Un seul groupe de harcèlement à la fois ;
   * les élèves envoyés sont retirés de `strikers`.
   */
  private harass(mine: Unit[], strikers: Unit[], main: Tile, centroid: { x: number; y: number }): void {
    const w = this.world;
    const busy = mine.filter((u) => u.aiTag === TAG_HARASS && u.order.kind !== 'none').length;
    if (busy > 0) return;
    if (this.harassTarget && (w.isFriend(this.harassTarget.owner, this.team) || w.time - this.harassSince > 25)) this.harassTarget = null;
    if (strikers.length < 2 * this.profile.groupMin + this.harassSize) return;
    if (!this.harassTarget) {
      let best: Tile | null = null;
      let bestScore = -Infinity;
      for (const t of w.tiles) {
        if (t === main || t.isCamp || w.isFriend(t.owner, this.team)) continue;
        if (Math.hypot(t.cx - main.cx, t.cy - main.cy) < HARASS_MIN_GAP) continue;
        // Seulement une case sans défenseur visible à 3,5 cellules : le harcèlement fuit la bagarre.
        let enemy = 0;
        w.hash.query(t.cx, t.cy, HARASS_CLEAR, (e) => {
          if (e.alive && !w.isFriend(e.team, this.team) && Math.hypot(e.x - t.cx, e.y - t.cy) < HARASS_CLEAR && unitVisible(w, this.team, e)) enemy++;
        });
        if (enemy > 0) continue;
        const score = (t.owner === NO_TEAM ? 0.6 : 1) - 0.06 * Math.hypot(t.cx - centroid.x, t.cy - centroid.y) + w.rng.next() * 0.1;
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }
      if (!best) return;
      this.harassTarget = best;
      this.harassSince = w.time;
    }
    const t = this.harassTarget;
    const squad = strikers
      .slice()
      .sort((a, b) => dist(a, t) - dist(b, t))
      .slice(0, this.harassSize);
    if (!this.spend()) return;
    w.orderMove(squad, { x: t.cx, y: t.cy }, true);
    for (const u of squad) {
      u.aiTag = TAG_HARASS;
      strikers.splice(strikers.indexOf(u), 1);
    }
  }

  /** Forme l'escouade en conquête si l'IA n'en a pas (un ordre du budget d'attention). */
  private conquest(mine: Unit[]): void {
    const w = this.world;
    for (const sq of w.squads.values()) if (sq.team === this.team && squadMembers(w, sq.id).length > 0) return;
    const free = mine.filter((u) => u.aiTag === TAG_FREE && u.engagedId < 0);
    if (free.length < 2 * this.profile.groupMin + this.conquestSize) return;
    if (!this.spend()) return;
    const squad = free.slice(0, this.conquestSize);
    assignConquest(w, squad);
    for (const u of squad) mine.splice(mine.indexOf(u), 1);
  }

  /** Case visée par le groupe de harcèlement (mesures, tests). */
  get harassing(): Tile | null {
    return this.harassTarget;
  }

  private think(): void {
    const w = this.world;
    // Les élèves de garde (ordre « Garder », voir garrison.ts) vivent leur vie : l'IA ne les commande pas.
    const mine = w.units.filter((u) => u.team === this.team && u.alive && !u.pion && u.aiTag !== TAG_LOANED && !u.guard && !u.squad);
    if (mine.length === 0) return;
    for (const u of mine) if (u.order.kind === 'none' && u.aiTag !== TAG_RALLY) u.aiTag = TAG_FREE;
    if (this.conquestSize > 0) this.conquest(mine);

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
    // Chaque case a son propre délai de réaction : une attaque n'est « vue » qu'au bout de
    // `threatDelay` secondes. Seules les `fronts` plus urgentes sont secourues à chaque réflexion.
    const urgent: Array<{ t: Tile; need: number; prio: number }> = [];
    for (const t of owned) {
      if (this.selfRescue === 'none' || (this.selfRescue === 'camps' && !t.isCamp)) continue;
      const threat = enemiesNear(t.cx, t.cy, 2.6);
      const capturing = t.capTeam !== NO_TEAM && !w.isFriend(t.capTeam, this.team);
      if (threat === 0 && !capturing) {
        this.threatSince.delete(t);
        continue;
      }
      const since = this.threatSince.get(t);
      if (since === undefined) this.threatSince.set(t, w.time);
      if (w.time - (since ?? w.time) < this.attention.threatDelay) continue;
      const defendersNear = mine.filter((u) => Math.hypot(u.x - t.cx, u.y - t.cy) < 2.2).length;
      // Un camp menacé est défendu en priorité et plus largement.
      const need = Math.ceil(threat * (t.isCamp ? 1.6 : 1.2) + (capturing ? (t.isCamp ? 4 : 2) : 0) + kingDefenseExtra(w, t, threat, capturing)) - defendersNear;
      if (need <= 0) continue;
      urgent.push({ t, need, prio: (t.isCamp ? 100 : 0) + (capturing ? 10 + t.cap * 10 : 0) + need });
    }
    for (const t of [...this.threatSince.keys()]) if (t.owner !== this.team) this.threatSince.delete(t);
    urgent.sort((a, b) => b.prio - a.prio);
    let fronts = 0;
    for (const { t, need } of urgent) {
      if (fronts >= this.attention.fronts) break;
      const candidates = mine
        .filter((u) => u.aiTag !== TAG_DEFEND && u.state !== 'attacking')
        .sort((a, b) => dist(a, t) - dist(b, t))
        .slice(0, need);
      if (candidates.length === 0) continue;
      if (!this.spend()) break;
      fronts++;
      w.orderMove(candidates, { x: t.cx, y: t.cy }, true);
      for (const u of candidates) u.aiTag = TAG_DEFEND;
    }

    // --- Aide à un allié : une case alliée qu'un ennemi est en train de prendre ---
    for (const t of w.tiles) {
      if (t.owner === NO_TEAM || !w.isAllied(t.owner, this.team)) continue;
      if (t.capTeam === NO_TEAM || w.isFriend(t.capTeam, this.team) || t.cap < 0.15) continue;
      const near = mine.filter((u) => u.aiTag === TAG_FREE && dist(u, t) < 5).sort((a, b) => dist(a, t) - dist(b, t));
      const helpers = near.slice(0, Math.min(3, Math.floor(near.length / 2)));
      if (helpers.length && this.spend()) {
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
      if (more.length && this.spend()) {
        w.orderMove(more, { x: t.cx, y: t.cy }, true);
        for (const u of more) u.aiTag = TAG_DEFEND;
      }
    }

    // --- Garnisons (témoin stratège) : une case bonus prise sans garde en reçoit -------
    if (this.garrisonSize > 0 && this.tokens >= 1) {
      const counts = guardCounts(w, this.team);
      let guarded = 0;
      for (const n of counts.values()) guarded += n;
      const room = Math.floor(this.garrisonShare * (mine.length + guarded)) - guarded;
      for (const t of room > 0 ? owned : []) {
        if (t.kind !== 'bonus' || (counts.get(t) ?? 0) >= this.garrisonSize) continue;
        const near = mine
          .filter((u) => u.aiTag !== TAG_DEFEND && u.state !== 'attacking' && dist(u, t) < 3)
          .sort((a, b) => dist(a, t) - dist(b, t))
          .slice(0, Math.min(room, this.garrisonSize - (counts.get(t) ?? 0)));
        if (near.length === 0 || mine.length - near.length < this.profile.groupMin) continue;
        if (!this.spend()) break;
        assignGuards(w, near, t);
        for (const u of near) mine.splice(mine.indexOf(u), 1);
        break;
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

    // Plus d'attention disponible : les ordres offensifs attendront la prochaine réflexion.
    if (this.tokens < 1) return;
    // Second front : un petit groupe part harceler une case éloignée de la cible principale.
    if (this.harassSize > 0) this.harass(mine, strikers, target, centroid);
    if (this.tokens < 1) return;
    if (this.fightSupervisor(strikers, target)) {
      this.spend();
      return;
    }

    const enemyAtTarget = enemiesNear(target.cx, target.cy, 2.5);
    const needed = Math.max(this.profile.groupMin, Math.ceil(enemyAtTarget * 1.3) + 1);

    // Les élèves déjà en route vers la cible comptent dans le groupe.
    const onTheWay = mine.filter((u) => u.aiTag === TAG_ATTACK && u.order.kind !== 'none').length;
    const grouped = strikers.filter((u) => d2(u, centroid) < this.profile.rallyRadius ** 2 * 2.5);

    if (grouped.length + onTheWay >= needed || strikers.length >= needed * 2) {
      const squad = strikers.slice(0, Math.max(needed, Math.ceil(strikers.length * 0.8)));
      if (!this.spend()) return;
      w.orderMove(squad, { x: target.cx, y: target.cy }, true);
      for (const u of squad) u.aiTag = TAG_ATTACK;
    } else {
      // Regroupement : on se rassemble entre le centre du groupe et la cible.
      const rally = {
        x: centroid.x + (target.cx - centroid.x) * 0.25,
        y: centroid.y + (target.cy - centroid.y) * 0.25,
      };
      // Un élève déjà en route vers le regroupement n'a pas besoin d'un nouvel ordre.
      const toRally = strikers.filter((u) => d2(u, rally) > this.profile.rallyRadius ** 2 && !(u.aiTag === TAG_RALLY && u.order.kind === 'move'));
      if (toRally.length && this.spend()) {
        w.orderMove(toRally, rally, true);
        for (const u of toRally) u.aiTag = TAG_RALLY;
      }
    }
  }
}

/** Attention d'une difficulté en une phrase (menu) : ordres par minute, cases secourues, délai. */
export function describeAttention(d: Difficulty): string {
  const a = AI_ATTENTION[d];
  const fronts = a.fronts === 1 ? 'une case secourue à la fois' : `${a.fronts} cases secourues à la fois`;
  const delay = String(a.threatDelay).replace('.', ',');
  return `IA : environ ${a.ordersPerMin} ordres par minute, ${fronts}, ${delay} s pour remarquer une attaque.`;
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
