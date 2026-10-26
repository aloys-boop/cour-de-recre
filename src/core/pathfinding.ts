import type { Grid } from './grid';
import type { Vec2 } from './types';

/**
 * A* sur grille, 8 voisins, sans couper les coins d'obstacles.
 * Retourne la liste des centres de cellules (hors cellule de départ), ou [] si inaccessible.
 * File de priorité en tas binaire et tableaux de travail réutilisés d'un appel à l'autre
 * (marqués par génération) : à 240 élèves, des dizaines de chemins peuvent être demandés
 * dans le même pas de simulation.
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
  const n = w * grid.h;
  const sc = scratch(n);
  const gen = ++sc.gen;
  const { gScore, parent, seen, closed, heap, heapF } = sc;
  let size = 0;

  const push = (node: number, f: number): void => {
    let i = size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= f) break;
      heap[i] = heap[p];
      heapF[i] = heapF[p];
      i = p;
    }
    heap[i] = node;
    heapF[i] = f;
  };
  const pop = (): number => {
    const top = heap[0];
    const lastN = heap[--size];
    const lastF = heapF[size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= size) break;
      if (c + 1 < size && heapF[c + 1] < heapF[c]) c++;
      if (heapF[c] >= lastF) break;
      heap[i] = heap[c];
      heapF[i] = heapF[c];
      i = c;
    }
    heap[i] = lastN;
    heapF[i] = lastF;
    return top;
  };

  const start = sy * w + sx;
  const target = gy * w + gx;
  seen[start] = gen;
  gScore[start] = 0;
  parent[start] = -1;
  push(start, heuristic(sx, sy, gx, gy));

  while (size > 0) {
    const cur = pop();
    if (closed[cur] === gen) continue; // entrée périmée (déjà améliorée)
    if (cur === target) return reconstruct(parent, cur, w);
    closed[cur] = gen;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const gc = gScore[cur];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (grid.isBlocked(nx, ny)) continue;
        // Diagonale : interdite si l'un des deux côtés est bloqué.
        if (dx !== 0 && dy !== 0 && (grid.isBlocked(cx + dx, cy) || grid.isBlocked(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni] === gen) continue;
        const tentative = gc + (dx !== 0 && dy !== 0 ? 1.41421 : 1);
        if (seen[ni] !== gen || tentative < gScore[ni]) {
          seen[ni] = gen;
          parent[ni] = cur;
          gScore[ni] = tentative;
          push(ni, tentative + heuristic(nx, ny, gx, gy));
        }
      }
    }
  }
  return [];
}

interface Scratch {
  gen: number;
  gScore: Float32Array;
  parent: Int32Array;
  seen: Uint32Array;
  closed: Uint32Array;
  heap: Int32Array;
  heapF: Float32Array;
}

let shared: Scratch | null = null;

/** Tableaux de travail de l'A*, agrandis au besoin (une cellule peut entrer plusieurs fois dans le tas). */
function scratch(n: number): Scratch {
  if (!shared || shared.gScore.length < n) {
    shared = {
      gen: 0,
      gScore: new Float32Array(n),
      parent: new Int32Array(n),
      seen: new Uint32Array(n),
      closed: new Uint32Array(n),
      heap: new Int32Array(n * 8 + 8),
      heapF: new Float32Array(n * 8 + 8),
    };
  }
  return shared;
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
