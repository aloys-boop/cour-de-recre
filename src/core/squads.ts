// Escouades à consigne (saison 1, point 1.5), première tranche : la consigne « Conquérir ».
// Une escouade en conquête choisit d'elle-même la case libre la plus proche, y court en
// se battant en chemin, la prend, puis passe à la suivante. Elle ne voit que ce que son équipe voit
// (brouillard) et renonce à une case trop bien défendue. Logique pure, sans navigateur.

import { orderMoveExact, tileGoals } from './aim';
import { centroid } from './controls';
import { tileView, unitVisible } from './fog';
import { NO_TEAM } from './types';
import type { Tile } from './tile';
import type { Unit } from './unit';
import type { World } from './world';

export const SQUAD = {
  /** Intervalle entre deux réflexions d'une escouade (s). */
  thinkEvery: 0.5,
  /** Rayon (cases) autour d'une case où l'on compte les défenseurs ennemis visibles. */
  radius: 2.6,
  /** Une case est trop défendue si ses défenseurs visibles dépassent `ratio` × l'escouade + `slack`. */
  ratio: 1.25,
  slack: 1,
  /** Surcoût (en cases de distance) par défenseur ennemi visible. */
  enemyCost: 2.5,
  /** Surcoût d'une case ennemie (il faut d'abord vider sa jauge) et d'une case jamais vue. */
  ownedCost: 2,
  unseenCost: 4,
  /** Remise pour un camp ou le trône (ils valent plus qu'une case bonus). */
  campBonus: 3,
  /** Distance maximale (cases) d'une cible : au-delà, l'escouade ne part pas à l'aventure. */
  reach: 22,
  /**
   * Les cases tenues par un ennemi sont-elles visées ? Non (v5.11) : mesuré, une escouade qui va
   * cueillir les cases ennemies laissées sans garde fait passer le témoin de 50 % à 67-73 % en
   * Normal. Prendre le terrain de l'adversaire reste une décision du joueur (pilier 1) ; l'escouade
   * ramasse les cases libres (bonus, trône, camps libres).
   */
  enemyTiles: false as boolean,
  /** Pause (s) de l'escouade après chaque prise, le temps de souffler, avant de viser la suivante. */
  pause: 0 as number,
  /** Une case abandonnée (trop défendue) n'est plus visée pendant ce temps (s). */
  avoidFor: 12,
} as const;

export interface Squad {
  readonly id: number;
  readonly team: number;
  /** Case visée, ou null (rien à prendre pour l'instant). */
  target: Tile | null;
  /** Chronomètre de réflexion. */
  clock: number;
  /** Cases abandonnées et instant (temps du monde) où elles redeviennent visables. */
  avoid: Map<Tile, number>;
  /** Instant (temps du monde) avant lequel l'escouade ne vise pas de nouvelle case (pause après une prise). */
  restUntil: number;
  /** Nombre de cases prises depuis la consigne. */
  taken: number;
}

/** Une case peut-elle être visée par une conquête ? Cases bonus, camps (fantômes compris) et trône. */
export function conquerable(t: Tile): boolean {
  return t.kind === 'bonus' || t.kind === 'camp' || t.kind === 'throne';
}

/** Membres vivants d'une escouade. */
export function squadMembers(world: World, id: number): Unit[] {
  const out: Unit[] = [];
  for (const u of world.units) if (u.squad === id && u.alive) out.push(u);
  return out;
}

/** Défenseurs ennemis de `team` visibles autour d'une case (pions compris). */
export function visibleDefenders(world: World, tile: Tile, team: number): number {
  let n = 0;
  const r2 = SQUAD.radius * SQUAD.radius;
  world.hash.query(tile.cx, tile.cy, SQUAD.radius, (u) => {
    if (!u.alive || world.isFriend(u.team, team)) return;
    const dx = u.x - tile.cx;
    const dy = u.y - tile.cy;
    if (dx * dx + dy * dy <= r2 && unitVisible(world, team, u)) n++;
  });
  return n;
}

/** La case est-elle acquise pour l'équipe (à elle ou à un allié, sans jauge ennemie qui monte) ? */
function secured(world: World, t: Tile, team: number): boolean {
  if (t.owner === NO_TEAM || !world.isFriend(t.owner, team)) return false;
  return t.capTeam === NO_TEAM || t.cap < 0.02 || world.isFriend(t.capTeam, team);
}

/** Trop défendue pour une escouade de `size` élèves ? */
function tooStrong(defenders: number, size: number): boolean {
  return defenders > size * SQUAD.ratio + SQUAD.slack;
}

/**
 * Prochaine case à conquérir pour une escouade de `size` élèves centrée en `from` : la moins
 * coûteuse parmi les cases qui ne sont ni à l'équipe ni à ses alliés (d'après ce que l'équipe en
 * sait), en écartant les cases trop défendues et celles abandonnées récemment. Null s'il n'y en a pas.
 */
export function conquestTarget(world: World, team: number, from: { x: number; y: number }, size: number, avoid?: ReadonlyMap<Tile, number>): Tile | null {
  let best: Tile | null = null;
  let bc = Infinity;
  for (const t of world.tiles) {
    if (!conquerable(t)) continue;
    const until = avoid?.get(t);
    if (until !== undefined && until > world.time) continue;
    const v = tileView(world, team, t);
    if (v.owner !== NO_TEAM && world.isFriend(v.owner, team)) continue;
    if (v.owner !== NO_TEAM && !SQUAD.enemyTiles) continue;
    const d = Math.hypot(t.cx - from.x, t.cy - from.y);
    if (d > SQUAD.reach) continue;
    const def = v.visible ? visibleDefenders(world, t, team) : 0;
    if (tooStrong(def, size)) continue;
    let cost = d + def * SQUAD.enemyCost;
    if (v.owner !== NO_TEAM) cost += SQUAD.ownedCost;
    if (!v.seen) cost += SQUAD.unseenCost;
    if (t.kind !== 'bonus') cost -= SQUAD.campBonus;
    if (cost < bc) {
      bc = cost;
      best = t;
    }
  }
  return best;
}

/**
 * Donne la consigne « Conquérir » à des élèves : ils forment une nouvelle escouade (et quittent
 * leur ancienne escouade ou leur garde). Les pions ne conquièrent pas. Retourne l'escouade, ou
 * null si aucun élève ne convient.
 */
export function assignConquest(world: World, units: readonly Unit[]): Squad | null {
  const members = units.filter((u) => u.alive && !u.pion);
  if (members.length === 0) return null;
  const team = members[0].team;
  const sq: Squad = { id: world.nextSquadId++, team, target: null, clock: 0, avoid: new Map(), taken: 0, restUntil: 0 };
  world.squads.set(sq.id, sq);
  for (const u of members) {
    u.guard = null;
    u.squad = sq.id;
  }
  thinkSquad(world, sq, members);
  return sq;
}

/** Retire des élèves de leur escouade (sans leur donner d'autre ordre). */
export function releaseSquad(units: readonly Unit[]): void {
  for (const u of units) u.squad = 0;
}

/** Escouades d'une équipe et leur nombre de membres vivants. */
export function squadsOf(world: World, team: number): { squad: Squad; size: number }[] {
  const out: { squad: Squad; size: number }[] = [];
  for (const sq of world.squads.values()) {
    if (sq.team !== team) continue;
    const size = squadMembers(world, sq.id).length;
    if (size) out.push({ squad: sq, size });
  }
  return out;
}

/** Réflexion des escouades, à chaque pas avant la mise à jour des élèves (chacune toutes les 0,5 s). */
export function updateSquads(world: World, dt: number): void {
  if (world.squads.size === 0) return;
  for (const sq of [...world.squads.values()]) {
    sq.clock += dt;
    if (sq.clock < SQUAD.thinkEvery) continue;
    sq.clock = 0;
    const members = squadMembers(world, sq.id);
    if (members.length === 0) {
      world.squads.delete(sq.id);
      continue;
    }
    thinkSquad(world, sq, members);
  }
}

function thinkSquad(world: World, sq: Squad, members: Unit[]): void {
  const fit = members.filter((u) => !u.pion);
  if (fit.length === 0) return;
  // Case prise : on passe à la suivante.
  if (sq.target && secured(world, sq.target, sq.team)) {
    sq.taken++;
    sq.target = null;
    sq.restUntil = world.time + SQUAD.pause;
  }
  // Case devenue trop bien défendue (ce que l'équipe en voit) : on renonce pour un moment.
  if (sq.target && tooStrong(visibleDefenders(world, sq.target, sq.team), fit.length)) {
    sq.avoid.set(sq.target, world.time + SQUAD.avoidFor);
    sq.target = null;
  }
  const c = centroid(fit.map((u) => u.pos))!;
  let fresh = false;
  if (!sq.target) {
    if (world.time < sq.restUntil) return;
    sq.target = conquestTarget(world, sq.team, c, fit.length, sq.avoid);
    fresh = !!sq.target;
  }
  const t = sq.target;
  if (!t) return;
  // Envoie ceux qui n'ont rien à faire (ou tous, pour une nouvelle cible) ; on se bat en chemin.
  const go = fresh ? fit.filter((u) => u.engagedId < 0 && u.supId === 0) : fit.filter((u) => idle(u) && !t.contains(u.x, u.y, t.half + 0.2));
  if (go.length === 0) return;
  orderMoveExact(world, go, tileGoals(go.map((u) => u.pos), t, (x, y) => world.grid.walkable(x, y)), true);
  for (const u of go) u.squad = sq.id; // un ordre libère l'escouade : on la remet
}

function idle(u: Unit): boolean {
  return u.order.kind === 'none' && u.engagedId < 0 && u.supId === 0;
}
