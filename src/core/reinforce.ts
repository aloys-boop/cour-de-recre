// Renforts automatiques (saison 1, point 1.3) : option par camp. Chaque nouvel élève du camp
// part de lui-même secourir la case possédée la plus menacée (ou, si rien n'est menacé, va au
// drapeau de ralliement comme d'habitude). Logique pure, sans navigateur.

import { orderMoveExact, tileGoals } from './aim';
import { NO_TEAM } from './types';
import type { Tile } from './tile';
import type { Unit } from './unit';
import type { World } from './world';

export const REINFORCE = {
  /** Rayon (cases) autour d'une case où un ennemi compte comme une menace (comme les alertes). */
  radius: 2.6,
  /** Distance maximale (cases) entre le camp et la case secourue : on n'envoie pas un élève seul au bout de la cour. */
  reach: 16,
  /** Poids de la jauge de capture ennemie (0 à 1) dans la menace. */
  capWeight: 6,
  /** Bonus de menace d'un camp (perdre un camp coûte une usine). */
  campBonus: 3,
  /** Distance (cases) qui divise par deux l'intérêt d'une case menacée. */
  falloff: 7,
  /** Intervalle entre deux mises à jour des cibles affichées (s). */
  scanEvery: 0.5,
} as const;

/** Une case peut-elle recevoir des renforts ? Cases bonus, camps et trône. */
function defendable(t: Tile): boolean {
  return t.kind === 'bonus' || t.kind === 'camp' || t.kind === 'throne';
}

/**
 * Menace sur une case de `team` : nombre d'ennemis vivants (pions compris) dans le rayon,
 * plus la jauge de capture ennemie pondérée. 0 si la case est calme.
 */
export function threatLevel(world: World, tile: Tile, team: number): number {
  let n = 0;
  world.hash.query(tile.cx, tile.cy, REINFORCE.radius, (u) => {
    if (!u.alive || world.isFriend(u.team, team)) return;
    const dx = u.x - tile.cx;
    const dy = u.y - tile.cy;
    if (dx * dx + dy * dy <= REINFORCE.radius * REINFORCE.radius) n++;
  });
  if (tile.capTeam !== NO_TEAM && tile.cap > 0.02 && !world.isFriend(tile.capTeam, team)) n += tile.cap * REINFORCE.capWeight;
  return n;
}

/**
 * Case à secourir par les nouveaux élèves d'un camp : la case possédée par le propriétaire du camp
 * la plus menacée, pondérée par la distance (au plus `reach` cases). Le camp lui-même compte :
 * s'il est le plus menacé, ses nouveaux élèves restent le défendre. Null si rien n'est menacé.
 */
export function reinforceTarget(world: World, camp: Tile): Tile | null {
  const team = camp.owner;
  if (team === NO_TEAM) return null;
  let best: Tile | null = null;
  let bs = 0;
  for (const t of world.tiles) {
    if (t.owner !== team || !defendable(t)) continue;
    const d = Math.hypot(t.cx - camp.cx, t.cy - camp.cy);
    if (d > REINFORCE.reach) continue;
    const threat = threatLevel(world, t, team);
    if (threat <= 0) continue;
    const s = (threat + (t.isCamp ? REINFORCE.campBonus : 0)) / (1 + d / REINFORCE.falloff);
    if (s > bs) {
      bs = s;
      best = t;
    }
  }
  return best;
}

/**
 * Nouvel élève d'un camp en renforts automatiques : s'il y a une case menacée (autre que le camp),
 * il y court en se battant en chemin. Retourne vrai s'il a reçu un ordre (sinon : ralliement habituel ;
 * si le camp lui-même est menacé, il reste sur place pour le défendre).
 */
export function routeNewborn(world: World, camp: Tile, u: Unit): 'renfort' | 'camp' | null {
  if (!world.reinforceOn(camp) || u.pion) return null;
  const t = reinforceTarget(world, camp);
  world.reinforceTargets.set(camp, t);
  if (!t) return null;
  if (t === camp) return 'camp';
  orderMoveExact(world, [u], tileGoals([u], t, (x, y) => world.grid.walkable(x, y)), true);
  return 'renfort';
}

/** Met à jour, toutes les 0,5 s, la case visée par chaque camp en renforts automatiques (pointillé affiché). */
export function updateReinforcements(world: World, dt: number): void {
  if (world.reinforce.size === 0) return;
  world.reinforceScan += dt;
  if (world.reinforceScan < REINFORCE.scanEvery) return;
  world.reinforceScan = 0;
  for (const camp of [...world.reinforce.keys()]) {
    if (!world.reinforceOn(camp)) {
      world.reinforceTargets.delete(camp);
      continue;
    }
    world.reinforceTargets.set(camp, reinforceTarget(world, camp));
  }
}
