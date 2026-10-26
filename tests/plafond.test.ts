import { describe, expect, it } from 'vitest';
import { generateMap, LEVELS, TOTAL_UNIT_BUDGET, UNIT_CAP, unitCapFor } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';
import { SpatialHash } from '../src/core/spatial';
import { PATHS_PER_STEP, World } from '../src/core/world';

describe('plafond d’élèves', () => {
  it('30 élèves par équipe, quel que soit le nombre d’équipes', () => {
    expect(UNIT_CAP).toBe(30);
    expect(TOTAL_UNIT_BUDGET).toBe(240);
    for (let teams = 2; teams <= 8; teams++) expect(unitCapFor(30, teams)).toBe(30);
  });

  it('toutes les cartes de campagne et d’escarmouche plafonnent à 30', () => {
    for (const l of LEVELS) expect(generateMap(l, 3).unitCap).toBe(30);
    for (let teams = 2; teams <= 8; teams++)
      for (let size = 0; size < 4; size++) expect(skirmishLevel({ teams, size, tiles: 20 }).unitCap).toBe(30);
  });

  it('8 équipes au plafond : 240 élèves, la production s’arrête à 30', () => {
    const map = { ...generateMap(LEVELS[5], 9), spawnInterval: 0.2 };
    const w = new World(map, 8, 9);
    for (let i = 0; i < 60 * 12; i++) w.update(1 / 60);
    for (let t = 0; t < 8; t++) expect(w.teamUnitCount(t)).toBe(30);
    expect(w.units.length).toBe(240);
  });
});

describe('performances à 240 élèves', () => {
  it('les recherches de chemin sont étalées sur plusieurs pas', () => {
    const map = generateMap(LEVELS[5], 4);
    const w = new World(map, 8, 4);
    for (let t = 0; t < 8; t++) {
      const camp = w.camps.find((c) => c.owner === t)!;
      while (w.teamUnitCount(t) < 30) w.spawnUnit(t, camp.cx, camp.cy, false);
    }
    const all = w.units.slice();
    const goal = { x: map.w / 2, y: map.h / 2 };
    for (let t = 0; t < 8; t++) w.orderMove(all.filter((u) => u.team === t), goal, false);
    // Au-delà du budget, les élèves partent tout droit en attendant leur chemin.
    expect(w.pendingPaths).toBe(240 - PATHS_PER_STEP);
    expect(all.every((u) => u.path.length > 0 && u.state === 'moving')).toBe(true);
    let steps = 0;
    while (w.pendingPaths > 0 && steps < 20) {
      w.update(1 / 60);
      steps++;
    }
    expect(w.pendingPaths).toBe(0);
    expect(steps).toBeLessThanOrEqual(Math.ceil(240 / PATHS_PER_STEP));
    // Personne n'a abandonné son ordre en attendant.
    expect(all.every((u) => u.order.kind === 'move')).toBe(true);
    for (let i = 0; i < 60 * 15; i++) w.update(1 / 60);
    const near = all.filter((u) => Math.hypot(u.x - goal.x, u.y - goal.y) < 4).length;
    expect(near).toBeGreaterThan(200);
  });

  it('le hash spatial réutilise ses cellules d’un pas à l’autre', () => {
    const h = new SpatialHash<{ x: number; y: number }>(1);
    const pts = [
      { x: 0.5, y: 0.5 },
      { x: 3.2, y: 3.9 },
    ];
    for (let k = 0; k < 3; k++) {
      h.clear();
      for (const p of pts) h.insert(p);
      const found: unknown[] = [];
      h.query(0.5, 0.5, 1, (p) => found.push(p));
      expect(found).toEqual([pts[0]]);
    }
    h.clear();
    const none: unknown[] = [];
    h.query(0.5, 0.5, 5, (p) => none.push(p));
    expect(none).toEqual([]);
  });
});
