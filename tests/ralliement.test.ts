import { describe, expect, it } from 'vitest';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const MAP: MapDef = {
  id: 'm',
  name: 'M',
  w: 16,
  h: 16,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 14, y: 14, owner: 1 },
    { kind: 'camp', x: 0, y: 14, owner: 0 },
  ],
};

const tick = (w: World, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60);
};

describe('ralliement par camp', () => {
  it('chaque camp a son propre drapeau ; ses nouveaux élèves y vont', () => {
    const w = new World(MAP, 2, 1);
    const [a, , b] = w.tiles;
    expect(w.setCampRally(0, a, { x: 6, y: 3 })).toBe(true);
    expect(w.setCampRally(0, b, { x: 4, y: 12 })).toBe(true);
    expect(w.setCampRally(0, w.tiles[1], { x: 8, y: 8 })).toBe(false); // pas son camp
    expect(w.setCampRally(0, a, { x: -2, y: 3 })).toBe(false); // hors de la cour
    tick(w, 6);
    const near = (p: { x: number; y: number }) => w.units.filter((u) => u.team === 0 && Math.hypot(u.x - p.x, u.y - p.y) < 1.6).length;
    expect(near({ x: 6, y: 3 })).toBeGreaterThanOrEqual(3);
    expect(near({ x: 4, y: 12 })).toBeGreaterThanOrEqual(3);
  });

  it('supprimer le ralliement : les nouveaux élèves restent au camp', () => {
    const w = new World(MAP, 2, 1);
    const a = w.tiles[0];
    w.setCampRally(0, a, { x: 8, y: 2 });
    expect(w.clearCampRally(0, a)).toBe(true);
    expect(w.rallyFor(a)).toBeNull();
    tick(w, 4);
    const fromA = w.units.filter((u) => u.team === 0 && Math.hypot(u.x - a.cx, u.y - a.cy) < 2);
    expect(fromA.length).toBeGreaterThanOrEqual(3);
    expect(fromA.every((u) => u.order.kind === 'none')).toBe(true);
  });

  it('appui long : le camp le plus proche, comme avant ; sur un camp, efface son ralliement', () => {
    const w = new World(MAP, 2, 1);
    const [a, , b] = w.tiles;
    expect(w.setRally(0, { x: 3, y: 11 })!.camp).toBe(b);
    expect(w.setRally(0, { x: 4, y: 2 })!.camp).toBe(a);
    expect(w.rallyFor(a)).not.toBeNull();
    expect(w.rallyFor(b)).not.toBeNull();
    expect(w.setRally(0, { x: a.cx, y: a.cy })).toEqual({ camp: a, cleared: true });
    expect(w.rallyFor(a)).toBeNull();
    expect(w.rallyFor(b)).not.toBeNull();
  });

  it('un point sur un obstacle est ramené sur la cellule libre la plus proche', () => {
    const w = new World({ ...MAP, obstacles: [{ x: 7, y: 7 }] }, 2, 1);
    w.setCampRally(0, w.tiles[0], { x: 7.5, y: 7.5 });
    const r = w.rallyFor(w.tiles[0])!;
    expect(w.grid.walkable(r.x, r.y)).toBe(true);
  });
});
