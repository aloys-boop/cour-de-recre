import { describe, expect, it } from 'vitest';
import { Grid } from '../src/core/grid';
import { findPath, lineOfSight, smoothPath } from '../src/core/pathfinding';
import { SpatialHash } from '../src/core/spatial';
import { dirFromVector, gridToScreen, screenToGrid } from '../src/core/math';

describe('recherche de chemin', () => {
  it('trouve un chemin direct sur un sol vide', () => {
    const g = new Grid(10, 10);
    const path = findPath(g, { x: 0.5, y: 0.5 }, { x: 9.5, y: 9.5 });
    expect(path.length).toBe(9);
    expect(path[path.length - 1]).toEqual({ x: 9.5, y: 9.5 });
  });

  it('contourne un mur d’obstacles', () => {
    const wall = [];
    for (let y = 0; y < 9; y++) wall.push({ x: 5, y });
    const g = new Grid(10, 10, wall);
    const path = findPath(g, { x: 1.5, y: 1.5 }, { x: 8.5, y: 1.5 });
    expect(path.length).toBeGreaterThan(7);
    for (const p of path) expect(g.walkable(p.x, p.y)).toBe(true);
    // Le chemin passe par le bas du mur.
    expect(path.some((p) => p.y > 9)).toBe(true);
  });

  it('ne coupe pas les coins des obstacles', () => {
    const g = new Grid(4, 4, [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
    const path = findPath(g, { x: 0.5, y: 0.5 }, { x: 3.5, y: 3.5 });
    expect(path.length).toBe(0); // la case de départ est enfermée
  });

  it('vise la cellule libre la plus proche quand la cible est bloquée', () => {
    const g = new Grid(6, 6, [{ x: 3, y: 3 }]);
    const path = findPath(g, { x: 0.5, y: 0.5 }, { x: 3.5, y: 3.5 });
    expect(path.length).toBeGreaterThan(0);
    const end = path[path.length - 1];
    expect(g.walkable(end.x, end.y)).toBe(true);
    expect(Math.abs(end.x - 3.5) + Math.abs(end.y - 3.5)).toBeLessThanOrEqual(2);
  });

  it('le lissage réduit le nombre de points sans traverser d’obstacle', () => {
    const g = new Grid(10, 10, [{ x: 4, y: 4 }]);
    const from = { x: 0.5, y: 0.5 };
    const raw = findPath(g, from, { x: 9.5, y: 8.5 });
    const smooth = smoothPath(g, from, raw);
    expect(smooth.length).toBeLessThanOrEqual(raw.length);
    let prev = from;
    for (const p of smooth) {
      expect(lineOfSight(g, prev, p)).toBe(true);
      prev = p;
    }
    expect(smooth[smooth.length - 1]).toEqual(raw[raw.length - 1]);
  });
});

describe('outils géométriques', () => {
  it('projection iso aller-retour', () => {
    const s = gridToScreen(3, 7);
    const g = screenToGrid(s.x, s.y);
    expect(g.x).toBeCloseTo(3);
    expect(g.y).toBeCloseTo(7);
  });

  it('directions sur 8 secteurs', () => {
    expect(dirFromVector(1, 0)).toBe(0);
    expect(dirFromVector(1, 1)).toBe(1);
    expect(dirFromVector(0, 1)).toBe(2);
    expect(dirFromVector(-1, 0)).toBe(4);
    expect(dirFromVector(0, -1)).toBe(6);
    expect(dirFromVector(1, -1)).toBe(7);
  });

  it('le hash spatial retrouve les voisins proches et eux seuls', () => {
    const h = new SpatialHash<{ x: number; y: number; id: number }>(1);
    const items = [];
    for (let i = 0; i < 50; i++) items.push({ x: (i % 10) + 0.5, y: Math.floor(i / 10) + 0.5, id: i });
    for (const it of items) h.insert(it);
    const found: number[] = [];
    h.query(2.5, 2.5, 0.6, (it) => found.push(it.id));
    expect(found).toContain(22);
    expect(found.length).toBeLessThanOrEqual(9);
    expect(found).not.toContain(0);
  });
});
