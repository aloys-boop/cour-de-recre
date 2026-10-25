// Logique pure de la visée au doigt : choix de l'élève touché, aimantation des ordres
// sur les cases (bonus et camps), répartition des élèves à l'intérieur d'une case et
// zoom de départ. Aucun accès au DOM ni à la caméra : testée par Vitest.

import type { Grid } from './grid';
import { TILE_H, TILE_W } from './math';
import { lineOfSight } from './pathfinding';
import type { Vec2 } from './types';
import type { Unit } from './unit';

/** Rayon minimal (px écran) dans lequel un tap attrape un élève, quel que soit le zoom. */
export const PICK_RADIUS_PX = 34;
/** Agrandissement du losange d'une case pour l'aimantation des ordres (35 %). */
export const MAGNET_GROW = 1.35;
/** Marge (cellules) gardée entre les élèves et le bord de la zone de capture. */
export const SPREAD_MARGIN = 0.1;
/** Pas du réseau de places dans une case : un peu plus que deux rayons d'élève, pour qu'ils ne se repoussent pas. */
export const SPREAD_STEP = 0.5;
/** Hauteur visible d'un élève à zoom 1 (px, du haut de la tête aux pieds). */
export const UNIT_PX_HEIGHT = 52;
/** Hauteur minimale souhaitée d'un élève à l'écran au départ (px). */
export const START_UNIT_PX = 46;
/** Longueur à l'écran d'une cellule le long d'un axe de la grille, à zoom 1 (px). */
const CELL_AXIS_PX = Math.hypot(40, 20);

// ---------------------------------------------------------------- sélection

/** Élève candidat, vu à l'écran : position des pieds (px) et profondeur de tri. */
export interface PickCandidate<U> {
  unit: U;
  team: number;
  /** Pieds à l'écran. */
  sx: number;
  sy: number;
  /** Profondeur (x + y en grille) : le plus « devant » l'emporte en cas d'égalité. */
  depth: number;
}

export interface PickResult<U> {
  unit: U;
  /** Vrai si le doigt est sur la silhouette même de l'élève (pas seulement à proximité). */
  direct: boolean;
}

/**
 * Élève visé par un tap à l'écran.
 *  - Sans sélection : l'élève du joueur le plus proche dans un rayon généreux
 *    (au moins PICK_RADIUS_PX), avant tout ennemi.
 *  - Avec sélection : un ennemi vraiment sous le doigt (sur sa silhouette) passe en
 *    premier (ordre d'attaque) ; sinon, même règle que sans sélection.
 *  - Faute d'élève du joueur à portée, l'ennemi le plus proche dans le même rayon.
 */
export function pickUnit<U>(
  cands: readonly PickCandidate<U>[],
  tx: number,
  ty: number,
  zoom: number,
  playerTeam: number,
  hasSelection: boolean,
  feetY = 56,
): PickResult<U> | null {
  const radius = Math.max(PICK_RADIUS_PX, 30 * zoom);
  type Best = { c: PickCandidate<U>; d: number; direct: boolean } | null;
  let own: Best = null;
  let enemy: Best = null;
  let enemyDirect: Best = null;
  for (const c of cands) {
    const direct = Math.abs(tx - c.sx) <= 18 * zoom && ty >= c.sy - (feetY + 4) * zoom && ty <= c.sy + 8 * zoom;
    const d = Math.hypot(tx - c.sx, ty - (c.sy - 26 * zoom));
    if (!direct && d > radius) continue;
    // Les silhouettes touchées passent avant les voisines ; à égalité, le plus proche puis le plus devant.
    const better = (b: Best) => !b || (direct && !b.direct) || (direct === b.direct && (d < b.d - 0.5 || (Math.abs(d - b.d) <= 0.5 && c.depth > b.c.depth)));
    if (c.team === playerTeam) {
      if (better(own)) own = { c, d, direct };
    } else {
      if (better(enemy)) enemy = { c, d, direct };
      if (direct && better(enemyDirect)) enemyDirect = { c, d, direct };
    }
  }
  const out = (b: NonNullable<Best>): PickResult<U> => ({ unit: b.c.unit, direct: b.direct });
  if (hasSelection && enemyDirect && !(own && own.direct && own.d < enemyDirect.d)) return out(enemyDirect);
  if (own) return out(own);
  if (enemy) return out(enemy);
  return null;
}

/** Rayon (cellules) du voisinage sélectionné par un tap sur un groupe : ≈ 40 px à l'écran, 0,9 cellule au moins. */
export function neighbourRadius(zoom: number): number {
  return Math.max(0.9, 40 / (CELL_AXIS_PX * Math.max(0.05, zoom)));
}

// ---------------------------------------------------------------- aimantation

/** Ce qu'il faut d'une case pour l'aimantation (Tile convient). */
export interface AimTile {
  cx: number;
  cy: number;
  /** Côté en cellules. */
  size: number;
  /** Demi-côté de la zone de capture. */
  half: number;
}

/**
 * Case vers laquelle un ordre visant `p` (grille) est aimanté : celle dont le losange,
 * agrandi de `grow`, contient le point. Si plusieurs conviennent, la plus proche
 * relativement à sa taille. Null si aucune.
 */
export function magnetTile<T extends AimTile>(tiles: readonly T[], p: Vec2, grow = MAGNET_GROW): T | null {
  let best: T | null = null;
  let bk = Infinity;
  for (const t of tiles) {
    const reach = (t.size / 2) * grow;
    const k = Math.max(Math.abs(p.x - t.cx), Math.abs(p.y - t.cy)) / reach;
    if (k <= 1 && k < bk) {
      bk = k;
      best = t;
    }
  }
  return best;
}

/**
 * `n` points répartis à l'intérieur de la zone de capture d'une case : un réseau carré
 * centré sur la case, au pas de SPREAD_STEP (les élèves ne se bousculent pas et restent
 * en place), resserré si le groupe est trop nombreux pour tenir dans le carré de
 * demi-côté `half - margin`. Un seul élève va au centre ; les places les plus centrales
 * sont prises d'abord, en alternant les côtés. Un point non praticable (`walkable`)
 * est ramené au centre.
 */
export function spreadInTile(n: number, cx: number, cy: number, half: number, margin = SPREAD_MARGIN, walkable?: (x: number, y: number) => boolean): Vec2[] {
  if (n <= 0) return [];
  const inner = Math.max(0, half - margin);
  const k = Math.ceil(Math.sqrt(n));
  const step = k <= 1 ? 0 : Math.min(SPREAD_STEP, (2 * inner) / (k - 1));
  const pts: Array<{ x: number; y: number; d: number; a: number }> = [];
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < k; i++) {
      const x = (i - (k - 1) / 2) * step;
      const y = (j - (k - 1) / 2) * step;
      pts.push({ x, y, d: Math.round(Math.hypot(x, y) * 1000), a: Math.atan2(y, x) });
    }
  }
  pts.sort((p, q) => p.d - q.d || p.a - q.a);
  // Dans chaque anneau de même distance, on alterne les côtés opposés (0, n/2, 1, n/2 + 1…).
  const order: typeof pts = [];
  for (let s = 0; s < pts.length; ) {
    let e = s;
    while (e < pts.length && pts[e].d === pts[s].d) e++;
    const ring = pts.slice(s, e);
    const h = Math.ceil(ring.length / 2);
    for (let i = 0; i < h; i++) {
      order.push(ring[i]);
      if (i + h < ring.length) order.push(ring[i + h]);
    }
    s = e;
  }
  return order.slice(0, n).map((p) => {
    const x = cx + p.x;
    const y = cy + p.y;
    return !walkable || walkable(x, y) ? { x, y } : { x: cx, y: cy };
  });
}

/**
 * Attribue à chaque élève (positions `from`) un des points `slots`, sans doublon.
 * Les places les plus éloignées du groupe d'abord, chacune à l'élève libre le plus
 * proche : les premiers arrivés vont au fond de la case et les suivants n'ont pas à
 * traverser (ni bousculer) ceux déjà en place. Renvoie les points dans l'ordre de `from`.
 */
export function assignSlots(from: readonly Vec2[], slots: readonly Vec2[]): Vec2[] {
  const n = Math.min(from.length, slots.length);
  const out: Vec2[] = new Array(from.length);
  if (n === 0) return out;
  let c = { x: 0, y: 0 };
  for (const f of from) c = { x: c.x + f.x / from.length, y: c.y + f.y / from.length };
  const far = (i: number) => Math.hypot(slots[i].x - c.x, slots[i].y - c.y);
  const order = slots.map((_, i) => i).sort((a, b) => far(b) - far(a));
  const free = new Set(from.map((_, i) => i));
  for (const si of order.slice(0, from.length)) {
    let bi = -1;
    let bd = Infinity;
    for (const ui of free) {
      const d = (from[ui].x - slots[si].x) ** 2 + (from[ui].y - slots[si].y) ** 2;
      if (d < bd) {
        bd = d;
        bi = ui;
      }
    }
    if (bi < 0) break;
    free.delete(bi);
    out[bi] = slots[si];
  }
  return out;
}

/** Destinations d'un groupe envoyé sur une case : une par élève, toutes dans la zone de capture. */
export function tileGoals(from: readonly Vec2[], tile: AimTile, walkable?: (x: number, y: number) => boolean): Vec2[] {
  return assignSlots(from, spreadInTile(from.length, tile.cx, tile.cy, tile.half, SPREAD_MARGIN, walkable));
}

/** Ce qu'il faut de la simulation pour envoyer un élève sur une place précise (World convient). */
export interface MoveWorld {
  readonly grid: Grid;
  orderMove(units: Unit[], target: Vec2, engage?: boolean): void;
}

/**
 * Envoie chaque élève sur sa place `goals[i]` (fuir ou charger selon `engage`). Le
 * chemin calculé s'arrête au centre d'une cellule : on le prolonge jusqu'à la place
 * exacte quand la vue est dégagée, sinon tous les élèves d'une case bonus
 * finiraient empilés sur la même cellule ou débordant sur les voisines.
 */
export function orderMoveExact(world: MoveWorld, units: readonly Unit[], goals: readonly Vec2[], engage = false): void {
  units.forEach((u, i) => {
    if (!goals[i]) return;
    world.orderMove([u], goals[i], engage);
    const n = u.path.length;
    if (n === 0 || u.order.kind !== 'move') return;
    const g = { x: u.order.target.x, y: u.order.target.y };
    if (!world.grid.walkable(g.x, g.y)) return;
    if (lineOfSight(world.grid, n > 1 ? u.path[n - 2] : u.pos, g)) u.path[n - 1] = g;
    else if (lineOfSight(world.grid, u.path[n - 1], g)) u.path.push(g);
    u.pathGoal = g;
  });
}

// ---------------------------------------------------------------- zoom de départ

/**
 * Zoom de départ : celui du cadrage habituel, resserré si besoin pour qu'un élève
 * fasse au moins START_UNIT_PX de haut, sans dépasser le zoom maximal.
 */
export function startZoom(framedZoom: number, maxZoom: number): number {
  return Math.min(maxZoom, Math.max(framedZoom, START_UNIT_PX / UNIT_PX_HEIGHT));
}

/**
 * Point à centrer au départ : entre la base du joueur et le centre de la cour (`share`
 * du chemin), mais assez près de la base pour qu'elle reste bien dans l'écran une fois
 * le zoom resserré (au plus 28 % de la largeur ou de la hauteur de la vue depuis le centre).
 */
export function startFocus(home: Vec2, center: Vec2, zoom: number, viewW: number, viewH: number, share = 0.45): Vec2 {
  const dx = center.x - home.x;
  const dy = center.y - home.y;
  const wx = Math.abs((dx - dy) * (TILE_W / 2));
  const wy = Math.abs((dx + dy) * (TILE_H / 2));
  let t = share;
  if (wx > 0) t = Math.min(t, (0.28 * viewW) / zoom / wx);
  if (wy > 0) t = Math.min(t, (0.28 * viewH) / zoom / wy);
  return { x: home.x + dx * t, y: home.y + dy * t };
}
