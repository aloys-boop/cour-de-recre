// Garnisons (saison 1, point 1.2) : l'ordre « Garder » confie une case à des élèves.
// Les gardes restent dans la zone, défendent un rayon autour de la case, ne se laissent pas
// attirer loin, et reprennent la case s'ils la perdent. Logique pure, sans navigateur.

import { orderMoveExact, tileGoals } from './aim';
import { pacifist } from './classes';
import { dist2 } from './math';
import type { Tile } from './tile';
import type { Unit } from './unit';
import type { World } from './world';

export const GARRISON = {
  /** Rayon défendu autour du centre de la case (cellules) : un ennemi qui y entre est engagé. */
  radius: 2.6,
  /** Laisse : un garde lâche un ennemi qui s'éloigne à plus de cette distance du centre de la case. */
  leash: 3.8,
  /** Intervalle entre deux recherches d'ennemis dans la zone (s), étalé selon l'élève. */
  scanEvery: 0.25,
  /** Marge (cellules) au-delà de la zone de capture avant qu'un garde inoccupé ne revienne sur la case. */
  slack: 0.25,
} as const;

/** Une case peut-elle être gardée ? Cases bonus, camps (fantômes compris) et trône. */
export function canGuard(tile: Tile): boolean {
  return tile.kind === 'bonus' || tile.kind === 'camp' || tile.kind === 'throne';
}

/**
 * Ordre « Garder » : les élèves vont se répartir dans la zone de capture de la case et y restent
 * de garde (en se battant en chemin, comme un ordre « Charger »). Les pions ne gardent pas.
 * Retourne le nombre de gardes assignés.
 */
export function assignGuards(world: World, units: readonly Unit[], tile: Tile): number {
  if (!canGuard(tile)) return 0;
  const guards = units.filter((u) => u.alive && !u.pion);
  if (guards.length === 0) return 0;
  sendHome(world, guards, tile);
  return guards.length;
}

/** Libère des élèves de leur garde (sans leur donner d'autre ordre). */
export function releaseGuards(units: readonly Unit[]): void {
  for (const u of units) u.guard = null;
}

/** Gardes vivants d'une case, pour une équipe donnée (ou toutes si `team` est omis). */
export function guardsOf(world: World, tile: Tile, team?: number): Unit[] {
  const out: Unit[] = [];
  for (const u of world.units) if (u.guard === tile && u.alive && (team === undefined || u.team === team)) out.push(u);
  return out;
}

/** Nombre de gardes vivants de chaque case gardée par l'équipe. */
export function guardCounts(world: World, team: number): Map<Tile, number> {
  const out = new Map<Tile, number>();
  for (const u of world.units) {
    if (!u.guard || !u.alive || u.team !== team) continue;
    out.set(u.guard, (out.get(u.guard) ?? 0) + 1);
  }
  return out;
}

/**
 * Comportement des gardes, à chaque pas avant la mise à jour des élèves :
 *  - un ennemi engagé qui s'éloigne au-delà de la laisse est lâché, le garde revient ;
 *  - un garde inoccupé engage l'ennemi le plus proche entré dans le rayon défendu ;
 *  - un garde inoccupé sorti de la zone de capture y retourne (et la reprend si elle a été perdue).
 */
export function updateGarrisons(world: World): void {
  const back = new Map<Tile, Unit[]>();
  for (const u of world.units) {
    const t = u.guard;
    if (!t) continue;
    if (!u.alive || u.pion) {
      u.guard = null;
      continue;
    }
    const leash2 = GARRISON.leash ** 2;
    // Laisse : un ennemi (ou un surveillant) trop loin de la case est abandonné.
    if (u.engagedId >= 0) {
      const e = world.unitById(u.engagedId);
      if (e && e.alive && dist2(e.x, e.y, t.cx, t.cy) > leash2) {
        u.engagedId = -1;
        u.pendingHit = 0;
        push(back, t, u);
      }
      continue;
    }
    if (u.supId > 0) continue;
    if (u.order.kind !== 'none') continue; // en route vers la case : il s'y battra en chemin
    // Rayon défendu : l'ennemi le plus proche du garde, parmi ceux entrés dans la zone.
    if (!pacifist(u) && world.time - u.guardScan >= GARRISON.scanEvery) {
      u.guardScan = world.time + u.phase * GARRISON.scanEvery * 0.5;
      const e = nearestIntruder(world, u, t);
      if (e) {
        u.engagedId = e.id;
        continue;
      }
    }
    if (!t.contains(u.x, u.y, t.half + GARRISON.slack)) push(back, t, u);
  }
  for (const [t, units] of back) sendHome(world, units, t);
}

/** Ennemi visible le plus proche du garde parmi ceux qui se trouvent dans le rayon défendu de la case. */
function nearestIntruder(world: World, u: Unit, t: Tile): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  const r2 = GARRISON.radius ** 2;
  world.hash.query(t.cx, t.cy, GARRISON.radius, (o) => {
    if (!o.alive || world.isFriend(o.team, u.team)) return;
    if (dist2(o.x, o.y, t.cx, t.cy) > r2) return;
    const d = dist2(o.x, o.y, u.x, u.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

function push(m: Map<Tile, Unit[]>, t: Tile, u: Unit): void {
  const a = m.get(t);
  if (a) a.push(u);
  else m.set(t, [u]);
}

/** Envoie des gardes sur leur case (répartis dans la zone de capture), sans perdre leur garde. */
function sendHome(world: World, units: Unit[], tile: Tile): void {
  const goals = tileGoals(
    units.map((u) => u.pos),
    tile,
    (x, y) => world.grid.walkable(x, y),
  );
  orderMoveExact(world, units, goals, true);
  for (const u of units) u.guard = tile;
}
