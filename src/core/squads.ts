// Escouades à consigne (saison 1, point 1.5). Logique pure, sans navigateur.
//  - « Conquérir » (v5.11) : l'escouade choisit d'elle-même la case libre la plus proche, y court
//    en se battant en chemin, la prend, puis passe à la suivante.
//  - « Défendre » (v5.12) : garnison mobile. L'escouade reçoit un secteur (jusqu'à 4 cases à toi
//    autour d'elle), se poste sur la case la plus centrale, court à celle qui est attaquée ou
//    reprend celle qui est tombée, puis revient à son poste.
// Dans les deux cas, l'escouade ne voit que ce que son équipe voit (brouillard) et renonce à une
// case trop bien défendue pour sa taille.

import { orderMoveExact, tileGoals } from './aim';
import { pacifist } from './classes';
import { GARRISON } from './garrison';
import { centroid } from './controls';
import { dist2 } from './math';
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
  /** « Défendre » : distance maximale (cases) entre l'escouade et une case de son secteur. */
  zoneReach: 7,
  /** « Défendre » : nombre maximal de cases d'un secteur. */
  zoneMax: 4,
  /** « Défendre » : un ennemi engagé qui s'éloigne de plus de cette distance de toute case du secteur est lâché. */
  leash: 4.2,
  /**
   * « Défendre » : les élèves d'une escouade en défense sont retranchés (coups reçus × GARRISON.armor)
   * dans le cercle défendu de chaque case de leur secteur, comme des gardes. Réglable pour les mesures.
   */
  entrenched: true as boolean,
} as const;

/** Consigne d'une escouade. */
export type SquadMode = 'conquer' | 'defend';

export interface Squad {
  readonly id: number;
  readonly team: number;
  /** Consigne : conquérir (par défaut) ou défendre un secteur. */
  readonly mode: SquadMode;
  /** « Défendre » : cases du secteur (vide en conquête). */
  readonly zone: readonly Tile[];
  /** « Défendre » : case où l'escouade se tient quand tout est calme (null en conquête). */
  readonly post: Tile | null;
  /** Case visée (à prendre, ou à secourir en défense), ou null (rien à faire pour l'instant). */
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
  const sq: Squad = { id: world.nextSquadId++, team, mode: 'conquer', zone: [], post: null, target: null, clock: 0, avoid: new Map(), taken: 0, restUntil: 0 };
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
  if (sq.mode === 'defend') {
    thinkDefence(world, sq, fit);
    return;
  }
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

// ---------------------------------------------------------------- « Défendre » (v5.12)

/**
 * Secteur à défendre pour une escouade centrée en `from` : les cases (bonus, camps, trône) que
 * l'équipe tient d'après ce qu'elle en sait, à `SQUAD.zoneReach` cases au plus, les plus proches
 * d'abord, `SQUAD.zoneMax` au plus. La case où se tient l'escouade en fait toujours partie, même si
 * elle n'est pas (encore) à l'équipe : l'escouade la prendra puis la tiendra. Vide s'il n'y a rien.
 */
export function defenceZone(world: World, team: number, from: { x: number; y: number }): Tile[] {
  const here = world.tiles.find((t) => conquerable(t) && t.contains(from.x, from.y, t.half + 0.45)) ?? null;
  const near: { t: Tile; d: number }[] = [];
  for (const t of world.tiles) {
    if (!conquerable(t) || t === here) continue;
    if (tileView(world, team, t).owner !== team) continue;
    const d = Math.hypot(t.cx - from.x, t.cy - from.y);
    if (d <= SQUAD.zoneReach) near.push({ t, d });
  }
  near.sort((a, b) => a.d - b.d);
  const out = near.map((n) => n.t);
  if (here) out.unshift(here);
  return out.slice(0, SQUAD.zoneMax);
}

/** Case la plus centrale d'un secteur : celle dont la case la plus éloignée est la plus proche. */
export function zonePost(zone: readonly Tile[]): Tile | null {
  let best: Tile | null = null;
  let bd = Infinity;
  for (const a of zone) {
    let far = 0;
    for (const b of zone) far = Math.max(far, Math.hypot(a.cx - b.cx, a.cy - b.cy));
    if (far < bd - 1e-6) {
      bd = far;
      best = a;
    }
  }
  return best;
}

/**
 * Donne la consigne « Défendre » à des élèves : ils forment une escouade chargée du secteur qui
 * les entoure (voir `defenceZone`), ou qui entoure le point `at` s'il est donné (outils de mesure).
 * Les pions ne défendent pas. Null si aucun élève ne convient ou s'il n'y a aucune case à défendre.
 */
export function assignDefence(world: World, units: readonly Unit[], at?: { x: number; y: number }): Squad | null {
  const members = units.filter((u) => u.alive && !u.pion);
  if (members.length === 0) return null;
  const team = members[0].team;
  const c = at ?? centroid(members.map((u) => u.pos))!;
  const zone = defenceZone(world, team, c);
  if (zone.length === 0) return null;
  const sq: Squad = { id: world.nextSquadId++, team, mode: 'defend', zone, post: zonePost(zone), target: null, clock: 0, avoid: new Map(), taken: 0, restUntil: 0 };
  world.squads.set(sq.id, sq);
  for (const u of members) {
    u.guard = null;
    u.squad = sq.id;
  }
  thinkSquad(world, sq, members);
  return sq;
}

/** Mode de l'escouade d'un élève, ou null s'il n'en a pas. */
export function squadMode(world: World, u: Unit): SquadMode | null {
  return u.squad > 0 ? (world.squads.get(u.squad)?.mode ?? null) : null;
}

/**
 * Case du secteur à secourir : celle qui est tombée, qu'un ennemi est en train de prendre, ou où
 * se tiennent des ennemis visibles. La plus urgente (ennemis, case perdue), à distance égale la plus
 * proche. Une case trop défendue pour l'escouade est laissée : elle ne se jette pas dans un piège.
 */
export function defenceTarget(world: World, sq: Squad, from: { x: number; y: number }, size: number): Tile | null {
  let best: Tile | null = null;
  let bs = -Infinity;
  for (const t of sq.zone) {
    const def = visibleDefenders(world, t, sq.team);
    const lost = !secured(world, t, sq.team);
    if (def === 0 && !lost) continue;
    if (tooStrong(def, size)) continue;
    let score = def * 2 + (lost ? 3 : 0) - Math.hypot(t.cx - from.x, t.cy - from.y) * 0.15;
    if (t === sq.target) score += 1.5; // on ne change pas de case à chaque réflexion
    if (score > bs) {
      bs = score;
      best = t;
    }
  }
  return best;
}

function thinkDefence(world: World, sq: Squad, fit: Unit[]): void {
  const c = centroid(fit.map((u) => u.pos))!;
  const prev = sq.target;
  sq.target = defenceTarget(world, sq, c, fit.length);
  if (prev && sq.target !== prev && secured(world, prev, sq.team)) sq.taken++;
  const home = sq.target ?? sq.post;
  if (!home) return;
  const leash2 = SQUAD.leash * SQUAD.leash;
  const go: Unit[] = [];
  for (const u of fit) {
    // Laisse : un ennemi qui a quitté le secteur n'est pas poursuivi.
    if (u.engagedId >= 0) {
      const e = world.unitById(u.engagedId);
      if (e && e.alive && !sq.zone.some((t) => dist2(e.x, e.y, t.cx, t.cy) <= leash2)) {
        u.engagedId = -1;
        u.pendingHit = 0;
        go.push(u);
      }
      continue;
    }
    if (u.supId > 0) continue;
    if (u.order.kind !== 'none') {
      // En route : on ne réoriente que ceux qui vont ailleurs que vers la case du moment.
      const g = u.order.target;
      if (home.contains(g.x, g.y, home.half + 0.3)) continue;
      go.push(u);
      continue;
    }
    // Sur place : engage l'intrus le plus proche entré autour de la case du moment.
    if (!pacifist(u)) {
      const e = nearestFoe(world, u, home);
      if (e) {
        u.engagedId = e.id;
        continue;
      }
    }
    if (!home.contains(u.x, u.y, home.half + 0.3)) go.push(u);
  }
  if (go.length === 0) return;
  orderMoveExact(world, go, tileGoals(go.map((u) => u.pos), home, (x, y) => world.grid.walkable(x, y)), true);
  for (const u of go) u.squad = sq.id; // un ordre libère l'escouade : on la remet
}

/** Ennemi visible le plus proche de l'élève parmi ceux qui se tiennent autour de la case. */
function nearestFoe(world: World, u: Unit, t: Tile): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  const r2 = SQUAD.radius * SQUAD.radius;
  world.hash.query(t.cx, t.cy, SQUAD.radius, (o) => {
    if (!o.alive || world.isFriend(o.team, u.team)) return;
    if (dist2(o.x, o.y, t.cx, t.cy) > r2 || !unitVisible(world, u.team, o)) return;
    const d = dist2(o.x, o.y, u.x, u.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

/**
 * Multiplicateur des coups reçus par un élève d'une escouade en défense : celui des gardes
 * retranchés (GARRISON.armor) dans le cercle défendu d'une case de son secteur, 1 ailleurs.
 */
export function defenderArmor(world: World, u: Unit): number {
  if (u.squad === 0 || !SQUAD.entrenched || GARRISON.armor === 1) return 1;
  const sq = world.squads.get(u.squad);
  if (!sq || sq.mode !== 'defend') return 1;
  const r2 = GARRISON.radius * GARRISON.radius;
  for (const t of sq.zone) if (dist2(u.x, u.y, t.cx, t.cy) <= r2) return GARRISON.armor;
  return 1;
}
