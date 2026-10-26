// Camps d'une équipe : ordre stable, numéro (« Camp 2/4 ») et nom de chaque camp.
import { TEAM_NAMES } from '../config';
import type { Tile } from './tile';
import { NO_TEAM } from './types';
import type { World } from './world';

/** Camps tenus par une équipe, dans un ordre stable (ordre des cases de la carte). */
export function campsOf(world: World, team: number): Tile[] {
  return world.tiles.filter((t) => t.isCamp && t.owner === team);
}

/** Numéro d'un camp parmi ceux de l'équipe (1 à n) et nombre de camps, ou null. */
export function campNumber(world: World, team: number, camp: Tile): { index: number; count: number } | null {
  const list = campsOf(world, team);
  const i = list.indexOf(camp);
  return i < 0 ? null : { index: i + 1, count: list.length };
}

/** Camp suivant (dir = 1) ou précédent (dir = -1) parmi ceux de l'équipe, en boucle. */
export function stepCamp(world: World, team: number, camp: Tile, dir: 1 | -1): Tile | null {
  const list = campsOf(world, team);
  if (list.length === 0) return null;
  const i = list.indexOf(camp);
  if (i < 0) return list[0];
  return list[(i + dir + list.length) % list.length];
}

/**
 * Nom d'un camp vu par une équipe : « Camp de départ » pour le sien, « Camp vert » pour celui
 * d'où sont partis les Verts, « Camp fantôme 2 » pour un camp sans propriétaire au départ.
 */
export function campName(world: World, camp: Tile, viewer: number): string {
  if (camp.ghost || camp.origin === NO_TEAM) {
    const ghosts = world.tiles.filter((t) => t.isCamp && (t.ghost || t.origin === NO_TEAM));
    return `Camp fantôme ${ghosts.indexOf(camp) + 1}`;
  }
  if (camp.origin === viewer) return 'Camp de départ';
  const color = world.teamColors[camp.origin] ?? camp.origin;
  return `Camp ${(TEAM_NAMES[color] ?? '?').toLowerCase()}`;
}
