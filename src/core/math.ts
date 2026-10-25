import type { Dir, Vec2 } from './types';

export const TILE_W = 64; // largeur d'une cellule iso à l'écran (zoom 1)
export const TILE_H = 32;

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Coordonnées grille → écran (origine au coin nord de la carte). */
export function gridToScreen(gx: number, gy: number): Vec2 {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

/** Écran (espace monde, zoom 1) → grille. */
export function screenToGrid(sx: number, sy: number): Vec2 {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/**
 * Direction (8) à partir d'un vecteur en coordonnées grille.
 * 0 = x+ (sud-est à l'écran), puis sens horaire : 1 = x+y+ (sud), 2 = y+ (sud-ouest),
 * 3 = x-y+ (ouest), 4 = x- (nord-ouest), 5 = x-y- (nord), 6 = y- (nord-est), 7 = x+y- (est).
 */
export function dirFromVector(dx: number, dy: number): Dir {
  if (dx === 0 && dy === 0) return 1;
  const ang = Math.atan2(dy, dx); // -PI..PI, 0 = x+
  let d = Math.round(ang / (Math.PI / 4));
  d = ((d % 8) + 8) % 8;
  return d as Dir;
}

export const DIR_VECTORS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];
