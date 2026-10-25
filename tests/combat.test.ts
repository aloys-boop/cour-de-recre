import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config';
import { Unit, punchDamage, resetUnitIds } from '../src/core/unit';
import { World } from '../src/core/world';
import type { MapDef } from '../src/core/types';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 8,
  h: 8,
  teams: 2,
  unitCap: 10,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 6, y: 6, owner: 1 },
  ],
};

function tick(world: World, seconds: number) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) world.update(step);
}

describe('combat', () => {
  it('les dégâts restent dans l’intervalle de réglage', () => {
    for (const r of [0, 0.5, 0.999]) {
      const d = punchDamage(() => r);
      expect(d).toBeGreaterThanOrEqual(TUNING.punchDamageMin);
      expect(d).toBeLessThanOrEqual(TUNING.punchDamageMax);
    }
  });

  it('un élève à zéro point de vie passe KO, subit un recul et perd ses ordres', () => {
    resetUnitIds();
    const u = new Unit(0, 2, 2);
    u.order = { kind: 'move', target: { x: 5, y: 5 } };
    expect(u.takeDamage(10, 1, 2)).toBe(false);
    expect(u.hp).toBe(TUNING.unitHp - 10);
    expect(u.kx).toBeGreaterThan(0); // poussé à l'opposé du coup
    expect(u.takeDamage(1000, 1, 2)).toBe(true);
    expect(u.state).toBe('ko');
    expect(u.alive).toBe(false);
    expect(u.order.kind).toBe('none');
    expect(u.takeDamage(10, 1, 2)).toBe(false); // déjà KO
  });

  it('deux élèves ennemis au contact se frappent jusqu’au KO, puis le vaincu disparaît', () => {
    const world = new World(ARENA, 2, 42);
    const a = world.spawnUnit(0, 3, 3);
    const b = world.spawnUnit(1, 3.4, 3);
    tick(world, 1.2);
    expect(a.hp + b.hp).toBeLessThan(2 * TUNING.unitHp);
    const punches = world.drainEvents().filter((e) => e.kind === 'punch').length;
    expect(punches).toBeGreaterThan(0);
    tick(world, 25);
    // L'un des deux a gagné : l'autre a été retiré du monde après sa chute.
    const alive = world.units.filter((u) => u.alive);
    expect(alive.length).toBe(1);
    expect(world.units.length).toBe(1);
  });

  it('un élève inoccupé engage un ennemi à portée d’aggro', () => {
    const world = new World(ARENA, 2, 7);
    const a = world.spawnUnit(0, 2, 2);
    const b = world.spawnUnit(1, 2 + TUNING.aggroRange - 0.3, 2);
    tick(world, 2);
    expect(a.engagedId === b.id || b.engagedId === a.id).toBe(true);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1);
  });

  it('un ordre d’attaque mène l’élève jusqu’à sa cible', () => {
    const world = new World(ARENA, 2, 3);
    const a = world.spawnUnit(0, 1, 1);
    const b = world.spawnUnit(1, 6, 6);
    world.orderAttack([a], b.id);
    expect(a.order.kind).toBe('attack');
    tick(world, 4);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.8);
    expect(b.hp).toBeLessThan(TUNING.unitHp);
  });

  it('un ordre de déplacement amène le groupe à destination', () => {
    const world = new World(ARENA, 2, 5);
    const units = [world.spawnUnit(0, 1, 1), world.spawnUnit(0, 1.3, 1), world.spawnUnit(0, 1, 1.3)];
    world.orderMove(units, { x: 6, y: 6 });
    tick(world, 6);
    for (const u of units) {
      expect(Math.hypot(u.x - 6, u.y - 6)).toBeLessThan(1.2);
      expect(u.order.kind).toBe('none');
    }
  });
});

describe('repli et régénération', () => {
  it('un ordre de déplacement est un repli : l\u2019élève cesse de se battre et ne riposte pas en route', () => {
    const world = new World(ARENA, 2, 9);
    const a = world.spawnUnit(0, 3, 3);
    const b = world.spawnUnit(1, 3.4, 3);
    tick(world, 1);
    expect(a.engagedId).toBe(b.id);
    world.orderMove([a], { x: 1, y: 6 });
    expect(a.engagedId).toBe(-1);
    expect(a.order.engage).toBeFalsy();
    const hpB = b.hp;
    let frames = 0;
    while (a.order.kind === 'move' && frames < 600) {
      world.update(1 / 60);
      frames++;
      expect(b.hp).toBe(hpB); // poursuivi, il court sans frapper
      expect(a.engagedId).toBe(-1);
    }
    expect(frames).toBeGreaterThan(30);
    expect(Math.hypot(a.x - 1, a.y - 6)).toBeLessThan(1);
    // Arrivé à destination, il redevient libre et se défend contre son poursuivant.
    tick(world, 2);
    expect(b.hp).toBeLessThan(hpB);
  });

  it('en attaque-déplacement (IA), l\u2019élève se bat contre ce qu\u2019il croise', () => {
    const world = new World(ARENA, 2, 9);
    const a = world.spawnUnit(0, 2, 2);
    const b = world.spawnUnit(1, 3.5, 3.5);
    world.orderMove([a], { x: 5, y: 5 }, true);
    tick(world, 2.5);
    expect(b.hp).toBeLessThan(TUNING.unitHp);
  });

  it('un élève se régénère sur son camp ou sur un cœur possédé, pas ailleurs', () => {
    const map = { ...ARENA, tiles: [...ARENA.tiles, { kind: 'bonus' as const, x: 3, y: 0, suit: 'heart' as const, owner: 0 as const }] };
    const world = new World(map, 2, 1);
    const [camp0, camp1] = world.camps;
    const onCamp = world.spawnUnit(0, camp0.cx, camp0.cy);
    const onHeart = world.spawnUnit(0, 3.5, 0.5);
    const away = world.spawnUnit(0, 5, 2);
    const onEnemyCamp = world.spawnUnit(0, camp1.cx, camp1.cy);
    for (const u of [onCamp, onHeart, away, onEnemyCamp]) u.hp = 10;
    tick(world, 1);
    expect(onCamp.hp).toBeGreaterThan(10);
    expect(onHeart.hp).toBeGreaterThan(10);
    expect(away.hp).toBe(10);
    expect(onEnemyCamp.hp).toBe(10);
    tick(world, 20);
    expect(onCamp.hp).toBe(onCamp.maxHp);
    expect(onHeart.hp).toBe(onHeart.maxHp);
  });
});
