import { describe, expect, it } from 'vitest';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const FIELD: MapDef = {
  id: 'tactique',
  name: 'Tactique',
  w: 12,
  h: 8,
  teams: 2,
  unitCap: 10,
  spawnInterval: 1,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 0, y: 6, owner: 0 },
    { kind: 'camp', x: 10, y: 6, owner: 1 },
  ],
};

function tick(world: World, seconds: number) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) world.update(step);
}

function campAt(world: World, x: number, y: number) {
  return world.tiles.find((t) => t.isCamp && t.x === x && t.y === y)!;
}

describe('point de ralliement', () => {
  it('les nouveaux élèves du camp reçoivent un ordre de repli vers le point', () => {
    const world = new World(FIELD, 2, 5);
    const res = world.setRally(0, { x: 5, y: 1.5 });
    expect(res?.cleared).toBe(false);
    expect(res?.camp).toBe(campAt(world, 0, 0)); // camp le plus proche
    tick(world, 1.05);
    const born = world.units.filter((u) => u.team === 0);
    expect(born.length).toBe(2); // un par camp
    const north = campAt(world, 0, 0);
    const fromNorth = born.find((u) => Math.hypot(u.x - north.cx, u.y - north.cy) < 1.2)!;
    const fromSouth = born.find((u) => u !== fromNorth)!;
    expect(fromNorth.order.kind).toBe('move');
    expect(fromNorth.order.engage).toBe(false);
    expect(fromNorth.order.target.x).toBeCloseTo(5, 5);
    expect(fromNorth.order.target.y).toBeCloseTo(1.5, 5);
    // Le second camp n'a pas de ralliement : son élève reste sur place.
    expect(fromSouth.order.kind).toBe('none');
    // L'élève finit par atteindre le drapeau (les suivants s'y regroupent aussi).
    tick(world, 3);
    expect(Math.hypot(fromNorth.x - 5, fromNorth.y - 1.5)).toBeLessThan(1.2);
    const north0 = world.units.filter((u) => u.team === 0 && Math.hypot(u.x - 5, u.y - 1.5) < 1.5);
    expect(north0.length).toBeGreaterThanOrEqual(2);
  });

  it('l’IA n’est pas concernée : ses élèves naissent sans ordre', () => {
    const world = new World(FIELD, 2, 9);
    world.setRally(0, { x: 5, y: 4 });
    tick(world, 1.05);
    const ai = world.units.filter((u) => u.team === 1);
    expect(ai.length).toBe(1);
    expect(ai[0].order.kind).toBe('none');
  });

  it('viser un de ses camps efface son ralliement', () => {
    const world = new World(FIELD, 2, 5);
    const camp = campAt(world, 0, 0);
    world.setRally(0, { x: 5, y: 1 });
    expect(world.rallyFor(camp)).not.toBeNull();
    const res = world.setRally(0, { x: camp.cx, y: camp.cy });
    expect(res).toEqual({ camp, cleared: true });
    expect(world.rallyFor(camp)).toBeNull();
  });

  it('un camp perdu oublie le ralliement de l’ancien propriétaire', () => {
    const world = new World(FIELD, 2, 5);
    const camp = campAt(world, 0, 0);
    world.setRally(0, { x: 5, y: 1 });
    camp.owner = 1;
    expect(world.rallyFor(camp)).toBeNull();
    expect(world.rallies.has(camp)).toBe(false);
  });

  it('une équipe sans camp ne peut pas poser de ralliement', () => {
    const world = new World(FIELD, 2, 5);
    for (const t of world.tiles) if (t.owner === 0) t.owner = 1;
    expect(world.setRally(0, { x: 5, y: 1 })).toBeNull();
  });
});

describe('ordres de déplacement : fuir ou charger', () => {
  const ARENA: MapDef = { ...FIELD, spawnInterval: 1000, tiles: [FIELD.tiles[0], FIELD.tiles[2]] };

  function crossing(engage: boolean): { punches: number; engaged: boolean } {
    const world = new World(ARENA, 2, 11);
    const a = world.spawnUnit(0, 2, 4, false);
    world.spawnUnit(1, 5, 4, false); // ennemi sur le chemin
    world.orderMove([a], { x: 9, y: 4 }, engage);
    let punches = 0;
    let engaged = false;
    for (let t = 0; t < 2; t += 1 / 60) {
      world.update(1 / 60);
      if (a.engagedId >= 0) engaged = true;
      for (const e of world.drainEvents()) if (e.kind === 'punch' && e.team === 0) punches++;
    }
    return { punches, engaged };
  }

  it('en fuite, l’élève traverse sans jamais frapper', () => {
    const r = crossing(false);
    expect(r.engaged).toBe(false);
    expect(r.punches).toBe(0);
  });

  it('en charge, l’élève se bat contre l’ennemi croisé', () => {
    const r = crossing(true);
    expect(r.engaged).toBe(true);
    expect(r.punches).toBeGreaterThan(0);
  });
});
