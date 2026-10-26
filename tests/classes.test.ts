import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config';
import { EconomyAi } from '../src/core/ai-economy';
import { CLASSES, classCount, setProduce, takeSpawnClass } from '../src/core/classes';
import { awardMerit, meritsOf } from '../src/core/merits';
import { Tile, updateCapture } from '../src/core/tile';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 14,
  h: 14,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 12, y: 12, owner: 1 },
    { kind: 'bonus', x: 6, y: 6, suit: 'heart' },
  ],
};

function tick(world: World, seconds: number, each?: () => void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    each?.();
    world.update(step);
  }
}

describe('classes d’élèves', () => {
  it('valeurs : coûts et caractéristiques', () => {
    expect(CLASSES.eleve.cost).toBe(0);
    expect(CLASSES.costaud).toMatchObject({ cost: 5, hp: 2 });
    expect(CLASSES.costaud.speed).toBeLessThan(1);
    expect(CLASSES.sprinteur).toMatchObject({ cost: 4, speed: 1.4, hp: 0.7 });
    expect(CLASSES.infirmier).toMatchObject({ cost: 6, heal: 4, max: 3 });
    expect(CLASSES.infirmier.dmg).toBeLessThan(0.5);
  });

  it('débloquées pour toute l’équipe : tous ses camps, y compris capturés, choisissent leur classe', () => {
    const w = new World(ARENA, 2, 1);
    const camp = w.tiles[0];
    expect(setProduce(w, 0, camp, 'costaud')).toBe('verrouille');
    expect(setProduce(w, 0, camp, 'eleve')).toBe('ok');
    w.teamUpgrades[0].classes = true;
    expect(setProduce(w, 0, camp, 'costaud')).toBe('ok');
    expect(camp.produce).toBe('costaud');
    expect(setProduce(w, 0, w.tiles[1], 'costaud')).toBe('pas-ton-camp');
    // Un camp pris à l'ennemi peut aussitôt produire sa propre classe.
    w.tiles[1].owner = 0;
    expect(setProduce(w, 0, w.tiles[1], 'sprinteur')).toBe('ok');
    expect(w.tiles[1].produce).toBe('sprinteur');
    expect(camp.produce).toBe('costaud');
  });

  it('chaque élève spécial coûte ses bons points ; sans bons points, un élève normal', () => {
    const w = new World({ ...ARENA, spawnInterval: 1 }, 2, 1);
    const camp = w.tiles[0];
    w.teamUpgrades[camp.owner].classes = true;
    camp.produce = 'costaud';
    awardMerit(w, 0, 7, 0, 0, 'hold');
    w.drainEvents();
    tick(w, 2);
    const mine = w.units.filter((u) => u.team === 0);
    expect(mine.map((u) => u.cls)).toEqual(['costaud', 'eleve']);
    expect(meritsOf(w, 0)).toBe(2);
  });

  it('Costaud : PV ×2 et plus lent ; Sprinteur : vitesse ×1,4 et PV ×0,7', () => {
    const w = new World(ARENA, 2, 1);
    const c = w.spawnUnit(0, 3, 3, false, undefined, 'costaud');
    const s = w.spawnUnit(0, 3, 5, false, undefined, 'sprinteur');
    const e = w.spawnUnit(0, 3, 7, false);
    expect(c.maxHp).toBe(Math.round(TUNING.unitHp * w.mods[0].hp * 2));
    expect(s.maxHp).toBe(Math.round(TUNING.unitHp * w.mods[0].hp * 0.7));
    for (const u of [c, s, e]) w.orderMove([u], { x: 12, y: u.y });
    tick(w, 2);
    expect(s.x - 3).toBeCloseTo((e.x - 3) * 1.4, 0);
    expect(c.x).toBeLessThan(e.x);
  });

  it('Sprinteur : seul, il capture deux fois plus vite', () => {
    const time = (weight: number) => {
      const t = new Tile({ kind: 'bonus', x: 0, y: 0, suit: 'heart' });
      let s = 0;
      while (t.owner !== 0 && s < 20) {
        updateCapture(t, [weight, 0], 0.05);
        s += 0.05;
      }
      return s;
    };
    expect(time(CLASSES.sprinteur.capture) / time(1)).toBeCloseTo(0.5, 1);
    // Dans le monde : un sprinteur seul sur la case la prend en 1,5 s.
    const w = new World(ARENA, 2, 1);
    w.spawnUnit(0, 6.5, 6.5, false, undefined, 'sprinteur');
    tick(w, 1.7);
    expect(w.tiles[2].owner).toBe(0);
  });

  it('Infirmier : soigne 4 PV/s les amis proches, pas les ennemis, frappe à peine', () => {
    const w = new World(ARENA, 2, 1);
    const n = w.spawnUnit(0, 6, 3, false, undefined, 'infirmier');
    const friend = w.spawnUnit(0, 6.8, 3, false);
    const far = w.spawnUnit(0, 6, 8, false);
    friend.hp = 20;
    far.hp = 20;
    tick(w, 2);
    expect(friend.hp).toBeCloseTo(28, 0);
    expect(far.hp).toBe(20);
    expect(n.dmgMul).toBeLessThan(0.5);
    // Un ennemi à côté de lui n'est pas soigné, et l'infirmier ne l'attaque pas de lui-même.
    const foe = w.spawnUnit(1, 6, 3.9, false);
    foe.hp = 20;
    tick(w, 0.5);
    expect(foe.hp).toBeLessThanOrEqual(20);
    expect(n.engagedId).not.toBe(foe.id);
  });

  it('Infirmier : 3 au plus par équipe', () => {
    const w = new World({ ...ARENA, spawnInterval: 0.5 }, 2, 1);
    const camp = w.tiles[0];
    w.teamUpgrades[camp.owner].classes = true;
    camp.produce = 'infirmier';
    awardMerit(w, 0, 100, 0, 0, 'hold');
    tick(w, 4);
    expect(classCount(w, 0, 'infirmier')).toBe(3);
    expect(w.teamUnitCount(0)).toBeGreaterThan(3);
    expect(meritsOf(w, 0)).toBe(100 - 3 * CLASSES.infirmier.cost);
    expect(takeSpawnClass(w, camp)).toBe('eleve');
  });

  it('un camp capturé repasse aux élèves normaux', () => {
    const w = new World(ARENA, 2, 1);
    const camp = w.tiles[1];
    w.teamUpgrades[1].classes = true;
    camp.produce = 'sprinteur';
    camp.owner = 0;
    expect(camp.produce).toBe('eleve');
  });

  it('l’IA mélange les classes : infirmiers dans une grosse armée, costauds, sprinteurs s’il reste des cases libres', () => {
    const w = new World(ARENA, 2, 1);
    const camp = w.tiles[1];
    w.teamUpgrades[camp.owner].classes = true;
    const eco = new EconomyAi(w, 1, 'normal');
    awardMerit(w, 1, 200, 0, 0, 'hold');
    // Petite armée, case libre : pas d'infirmier.
    for (let i = 0; i < 4; i++) w.spawnUnit(1, 10, 10 + i * 0.3, false);
    expect(eco.chooseClass(camp)).not.toBe('infirmier');
    // Grosse armée sans costaud : des costauds d'abord.
    for (let i = 0; i < 12; i++) w.spawnUnit(1, 9, 8 + i * 0.3, false);
    expect(eco.chooseClass(camp)).toBe('costaud');
    // Assez de costauds, plus de case libre : un infirmier.
    w.tiles[2].owner = 0;
    for (let i = 0; i < 8; i++) w.spawnUnit(1, 9.5, 8 + i * 0.3, false, undefined, 'costaud');
    expect(eco.chooseClass(camp)).toBe('infirmier');
    for (let i = 0; i < 3; i++) w.spawnUnit(1, 8, 8 + i * 0.3, false, undefined, 'infirmier');
    const next = eco.chooseClass(camp);
    expect(['costaud', 'sprinteur']).toContain(next);
    // Sans réserve de bons points : élèves normaux.
    const poor = new World(ARENA, 2, 1);
    poor.teamUpgrades[1].classes = true;
    expect(new EconomyAi(poor, 1, 'normal').chooseClass(poor.tiles[1])).toBe('eleve');
    // Classes verrouillées : élèves normaux.
    const locked = new World(ARENA, 2, 1);
    awardMerit(locked, 1, 200, 0, 0, 'hold');
    expect(new EconomyAi(locked, 1, 'difficile').chooseClass(locked.tiles[1])).toBe('eleve');
  });
});
