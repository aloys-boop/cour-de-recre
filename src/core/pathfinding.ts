import type { Grid } from './grid';
import type { Vec2 } from './types';

/**
 * A* sur grille, 8 voisins, sans couper les coins d'obstacles.
 * Retourne la liste des centres de cellules (hors cellule de départ), ou [] si inaccessible.
 * Les cartes font au plus ~400 cellules : un tableau plat suffit largement.
 */
export function findPath(grid: Grid, from: Vec2, to: Vec2): Vec2[] {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const goal = grid.nearestFree(to.x, to.y);
  const gx = goal.x;
  const gy = goal.y;
  if (sx === gx && sy === gy) return [{ x: gx + 0.5, y: gy + 0.5 }];
  if (grid.isBlocked(sx, sy)) {
    const s = grid.nearestFree(sx, sy);
    return findPath(grid, { x: s.x + 0.5, y: s.y + 0.5 }, to);
  }

  const w = grid.w;
  const h = grid.h;
  const n = w * h;
  const gScore = new Float32Array(n).fill(Infinity);
  const fScore = new Float32Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open: number[] = [];

  const start = sy * w + sx;
  const target = gy * w + gx;
  gScore[start] = 0;
  fScore[start] = heuristic(sx, sy, gx, gy);
  open.push(start);

  while (open.length > 0) {
    // Sélection du meilleur nœud (liste petite : parcours linéaire suffisant).
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === target) return reconstruct(parent, cur, w);
    closed[cur] = 1;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (grid.isBlocked(nx, ny)) continue;
        // Diagonale : interdite si l'un des deux côtés est bloqué.
        if (dx !== 0 && dy !== 0 && (grid.isBlocked(cx + dx, cy) || grid.isBlocked(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const cost = dx !== 0 && dy !== 0 ? 1.41421 : 1;
        const tentative = gScore[cur] + cost;
        if (tentative < gScore[ni]) {
          parent[ni] = cur;
          gScore[ni] = tentative;
          fScore[ni] = tentative + heuristic(nx, ny, gx, gy);
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
  }
  return [];
}

function heuristic(x: number, y: number, gx: number, gy: number): number {
  const dx = Math.abs(x - gx);
  const dy = Math.abs(y - gy);
  return Math.max(dx, dy) + 0.41421 * Math.min(dx, dy);
}

function reconstruct(parent: Int32Array, cur: number, w: number): Vec2[] {
  const out: Vec2[] = [];
  let c = cur;
  while (c !== -1) {
    const x = c % w;
    const y = (c - x) / w;
    out.push({ x: x + 0.5, y: y + 0.5 });
    c = parent[c];
  }
  out.reverse();
  out.shift(); // on retire la cellule de départ
  return out;
}

/**
 * Simplifie un chemin en retirant les points intermédiaires alignés (lissage léger),
 * ce qui donne des déplacements plus naturels sur un sol ouvert.
 */
export function smoothPath(grid: Grid, from: Vec2, path: Vec2[]): Vec2[] {
  if (path.length <= 1) return path;
  const out: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !lineOfSight(grid, anchor, path[j])) j--;
    out.push(path[j]);
    anchor = path[j];
    i = j + 1;
  }
  return out;
}

export function lineOfSight(grid: Grid, a: Vec2, b: Vec2): boolean {
  const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 4) + 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (!grid.walkable(x, y)) return false;
  }
  return true;
}
