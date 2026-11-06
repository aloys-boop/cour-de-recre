// Mode « Équipes » (v5.6) : des équipes fixes dès le début de la partie (2 contre 2, 3 contre 3,
// 2 contre 2 contre 2…). Logique pure, sans DOM, testée par Vitest.
import type { MapDef } from './types';

/** Tailles d'équipe proposées au menu (0 : partie libre, alliances au fil du jeu). */
export const TEAM_SIZES: readonly number[] = [2, 3, 4];

/** La taille `size` partage-t-elle `teams` équipes en au moins deux groupes égaux ? */
export function teamSizeFits(teams: number, size: number): boolean {
  return size >= 2 && teams % size === 0 && teams / size >= 2;
}

/** « 2 contre 2 », « 2 contre 2 contre 2 »… (ou null si la taille ne convient pas). */
export function teamsLabel(teams: number, size: number): string | null {
  if (!teamSizeFits(teams, size)) return null;
  return Array.from({ length: teams / size }, () => String(size)).join(' contre ');
}

/**
 * Groupe de chaque équipe (0, 1, 2…, le groupe du joueur, équipe 0, est le 0), ou null si la
 * taille ne convient pas. Les coéquipiers ont des camps voisins : les camps de départ sont rangés
 * dans l'ordre du tour de la cour, puis découpés en tranches consécutives ; on garde le découpage
 * dont les camps d'un même groupe sont le plus près les uns des autres.
 */
export function teamGroups(map: Pick<MapDef, 'w' | 'h' | 'teams' | 'tiles'>, size: number): number[] | null {
  const n = map.teams;
  if (!teamSizeFits(n, size)) return null;
  const cx = map.w / 2;
  const cy = map.h / 2;
  const pos: Array<{ x: number; y: number }> = [];
  for (let t = 0; t < n; t++) {
    const camp = map.tiles.find((d) => d.kind === 'camp' && d.owner === t);
    pos.push(camp ? { x: camp.x + 1, y: camp.y + 1 } : { x: cx, y: cy });
  }
  const order = Array.from({ length: n }, (_, t) => t).sort((a, b) => Math.atan2(pos[a].y - cy, pos[a].x - cx) - Math.atan2(pos[b].y - cy, pos[b].x - cx));
  let best: number[] | null = null;
  let bestCost = Infinity;
  for (let off = 0; off < size; off++) {
    const g = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) g[order[(i + off) % n]] = Math.floor(i / size);
    let cost = 0;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (g[a] === g[b]) cost += Math.hypot(pos[a].x - pos[b].x, pos[a].y - pos[b].y);
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      best = g;
    }
  }
  // Renumérotation : le groupe du joueur d'abord, puis dans l'ordre des équipes.
  const ren = new Map<number, number>();
  return best!.map((g) => {
    if (!ren.has(g)) ren.set(g, ren.size);
    return ren.get(g)!;
  });
}
