import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config';
import { EconomyAi } from '../src/core/ai-economy';
import { awardMerit, MERITS, meritsOf, spendMerits } from '../src/core/merits';
import { ensureSupervisors, hitSupervisor } from '../src/core/supervisors';
import { Tile, updateCapture } from '../src/core/tile';
import type { MapDef } from '../src/core/types';
import { buyUpgrade, campDefenseMul, upgradeCost, UPGRADES } from '../src/core/upgrades';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 12,
  h: 12,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 10, y: 10, owner: 1 },
    { kind: 'bonus', x: 5, y: 5, suit: 'heart' },
    { kind: 'bonus', x: 8, y: 2, suit: 'club' },
  ],
};

function tick(world: World, seconds: number, each?: () => void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    each?.();
    world.update(step);
  }
}

const merits = (w: World) => w.drainEvents().filter((e) => e.kind === 'merit');

describe('bons points : gains', () => {
  it('+2 par élève ennemi mis KO, pour l’équipe qui porte le dernier coup', () => {
    const w = new World(ARENA, 2, 5);
    const a = w.spawnUnit(0, 3, 3, false);
    const b = w.spawnUnit(1, 3.4, 3, false);
    b.hp = 1;
    tick(w, 2);
    expect(b.alive).toBe(false);
    expect(a.alive).toBe(true);
    expect(meritsOf(w, 0)).toBe(MERITS.koUnit);
    expect(MERITS.koUnit).toBe(2);
    expect(meritsOf(w, 1)).toBe(0);
  });

  it('+10 par case bonus capturée, +25 par camp capturé', () => {
    const w = new World(ARENA, 2, 5);
    w.spawnUnit(0, 5.5, 5.5, false);
    tick(w, 4);
    expect(w.tiles[2].owner).toBe(0);
    const ev = merits(w);
    expect(ev.some((e) => e.kind === 'merit' && e.reason === 'capture' && e.amount === 10)).toBe(true);
    expect(meritsOf(w, 0)).toBe(10);
    // Camp ennemi : 2,5 fois plus lent à prendre.
    for (let i = 0; i < 4; i++) w.spawnUnit(0, 10.8 + 0.1 * i, 10.9, false);
    tick(w, 6);
    expect(w.tiles[1].owner).toBe(0);
    expect(meritsOf(w, 0)).toBeGreaterThanOrEqual(10 + 25);
  });

  it('+1 toutes les 10 s par case tenue', () => {
    const w = new World(ARENA, 2, 5);
    w.tiles[2].owner = 0;
    w.tiles[3].owner = 0;
    tick(w, 9.9);
    expect(meritsOf(w, 0)).toBe(0);
    tick(w, 0.2);
    // Un camp + deux cases.
    expect(meritsOf(w, 0)).toBe(3);
    expect(meritsOf(w, 1)).toBe(1);
    tick(w, 10);
    expect(meritsOf(w, 0)).toBe(6);
  });

  it('+40 pour le dernier coup sur un surveillant', () => {
    const w = new World(ARENA, 2, 5);
    w.rules = { mode: 'classique', supervisors: true };
    const [s] = ensureSupervisors(w);
    const u = w.spawnUnit(1, s.x + 0.5, s.y, false);
    s.hp = 5;
    hitSupervisor(w, s, 10, u);
    expect(meritsOf(w, 1)).toBe(40);
    expect(MERITS.supervisor).toBe(40);
  });

  it('dépenser : impossible au-delà du solde', () => {
    const w = new World(ARENA, 2, 5);
    awardMerit(w, 0, 12, 0, 0, 'hold');
    expect(spendMerits(w, 0, 20)).toBe(false);
    expect(meritsOf(w, 0)).toBe(12);
    expect(spendMerits(w, 0, 12)).toBe(true);
    expect(meritsOf(w, 0)).toBe(0);
    expect(w.merits.earned[0]).toBe(12);
    expect(w.merits.spent[0]).toBe(12);
  });
});

describe('améliorations de camp', () => {
  it('3 niveaux par branche, coûts croissants, seulement sur ses camps', () => {
    const w = new World(ARENA, 2, 5);
    const camp = w.tiles[0];
    awardMerit(w, 0, 1000, 0, 0, 'hold');
    const costs: number[] = [];
    for (let i = 0; i < 3; i++) {
      costs.push(upgradeCost(camp, 'prod')!);
      expect(buyUpgrade(w, 0, camp, 'prod')).toBe('ok');
    }
    expect(costs[1]).toBeGreaterThan(costs[0]);
    expect(costs[2]).toBeGreaterThan(costs[1]);
    expect(camp.upgrades.prod).toBe(3);
    expect(buyUpgrade(w, 0, camp, 'prod')).toBe('max');
    expect(meritsOf(w, 0)).toBe(1000 - costs.reduce((a, b) => a + b, 0));
    expect(buyUpgrade(w, 0, w.tiles[1], 'hp')).toBe('pas-ton-camp');
    expect(buyUpgrade(w, 0, w.tiles[2], 'hp')).toBe('pas-ton-camp');
    const poor = new World(ARENA, 2, 5);
    expect(buyUpgrade(poor, 0, poor.tiles[0], 'hp')).toBe('pas-assez');
    expect(poor.tiles[0].upgrades.hp).toBe(0);
  });

  it('Production : +15 % de vitesse de production par niveau', () => {
    const count = (level: number) => {
      const w = new World({ ...ARENA, spawnInterval: 2 }, 2, 5);
      w.tiles[0].upgrades.prod = level;
      tick(w, 30);
      return w.teamUnitCount(0);
    };
    const base = count(0);
    const max = count(3);
    expect(UPGRADES.prod.perLevel).toBe(0.15);
    // Équipe Noire (production ×1,05) : 30 s à 2 s par élève → 15 élèves ; ×1,45 au niveau 3 → 22.
    expect(base).toBe(Math.floor(30 / (2 / 1.05)));
    expect(max).toBe(Math.floor(30 / (2 / (1.05 * 1.45))));
  });

  it('Uniformes et Entraînement : PV et dégâts des élèves sortis de ce camp', () => {
    const w = new World({ ...ARENA, spawnInterval: 1 }, 2, 5);
    w.tiles[0].upgrades.hp = 2;
    w.tiles[0].upgrades.dmg = 3;
    tick(w, 1.1);
    const u = w.units.find((x) => x.team === 0)!;
    expect(u.maxHp).toBe(Math.round(TUNING.unitHp * w.mods[0].hp * 1.2));
    expect(u.dmgMul).toBeCloseTo(1.3);
    // Le bonus suit l'élève quand les bonus de cases changent.
    w.tiles[2].owner = 0;
    w.refreshMods();
    expect(u.maxHp).toBe(Math.round(TUNING.unitHp * w.mods[0].hp * 1.2));
    // Un élève qui ne sort pas d'un camp amélioré n'a rien.
    const other = w.spawnUnit(0, 3, 3, false);
    expect(other.hpMul).toBe(1);
    expect(other.dmgMul).toBe(1);
  });

  it('Entraînement : un élève entraîné frappe plus fort', () => {
    const dealt = (level: number) => {
      const w = new World(ARENA, 2, 9);
      w.tiles[0].upgrades.dmg = level;
      const a = w.spawnUnit(0, 3, 3, false, w.tiles[0]);
      const b = w.spawnUnit(1, 3.4, 3, false);
      b.hp = b.maxHp = 100000;
      a.hp = a.maxHp = 100000;
      tick(w, 20);
      return 100000 - b.hp;
    };
    expect(dealt(3) / dealt(0)).toBeGreaterThan(1.2);
  });

  it('Défense : le camp se capture 30 % plus lentement par niveau et soigne plus vite', () => {
    const time = (level: number) => {
      const t = new Tile({ kind: 'camp', x: 0, y: 0, owner: 0 });
      t.upgrades.def = level;
      let s = 0;
      while (t.owner === 0 && s < 100) {
        updateCapture(t, [0, 1], 0.05);
        s += 0.05;
      }
      return s;
    };
    expect(time(1) / time(0)).toBeCloseTo(1.3, 1);
    expect(time(3) / time(0)).toBeCloseTo(1.9, 1);
    const heal = (level: number) => {
      const w = new World(ARENA, 2, 5);
      w.tiles[0].upgrades.def = level;
      const u = w.spawnUnit(0, 1, 1, false);
      u.hp = 10;
      tick(w, 2);
      return u.hp - 10;
    };
    expect(heal(3) / heal(0)).toBeCloseTo(campDefenseMul(w0(3)), 1);
  });

  it('un camp capturé perd ses améliorations', () => {
    const w = new World(ARENA, 2, 5);
    const camp = w.tiles[1];
    camp.upgrades = { prod: 2, hp: 1, dmg: 3, def: 0 };
    for (let i = 0; i < 4; i++) w.spawnUnit(0, 10.8 + 0.1 * i, 10.9, false);
    tick(w, 8);
    expect(camp.owner).toBe(0);
    expect(camp.upgrades).toEqual({ prod: 0, hp: 0, dmg: 0, def: 0 });
  });
});

describe('IA : dépenses de bons points', () => {
  it('une IA Normal améliore son camp quand elle en a les moyens', () => {
    const w = new World(ARENA, 2, 5);
    const eco = new EconomyAi(w, 1, 'normal');
    awardMerit(w, 1, 200, 0, 0, 'hold');
    tick(w, 20, () => eco.update(1 / 60));
    const camp = w.tiles[1];
    const levels = camp.upgrades.prod + camp.upgrades.hp + camp.upgrades.dmg + camp.upgrades.def;
    expect(levels).toBeGreaterThanOrEqual(3);
    expect(meritsOf(w, 1)).toBeLessThan(200);
    // Production d'abord (camp tranquille, loin du plafond).
    expect(camp.upgrades.prod).toBeGreaterThanOrEqual(1);
  });

  it('une IA Difficile renforce la défense d’un camp attaqué', () => {
    const w = new World(ARENA, 2, 5);
    const camp = w.tiles[1];
    for (let i = 0; i < 8; i++) w.spawnUnit(0, 10.5 + (i % 3) * 0.4, 10.5 + Math.floor(i / 3) * 0.4, false);
    camp.upgrades = { prod: 1, hp: 1, dmg: 1, def: 0 };
    camp.capTeam = 0;
    camp.cap = 0.3;
    w.update(1 / 60);
    const eco = new EconomyAi(w, 1, 'difficile');
    awardMerit(w, 1, 25, 0, 0, 'hold');
    eco.think();
    expect(camp.upgrades.def).toBe(1);
  });

  it('une IA Facile dépense lentement et ne dépasse pas le niveau 2', () => {
    const w = new World(ARENA, 2, 5);
    const eco = new EconomyAi(w, 1, 'facile');
    awardMerit(w, 1, 5000, 0, 0, 'hold');
    tick(w, 300, () => eco.update(1 / 60));
    const camp = w.tiles[1];
    expect(Math.max(camp.upgrades.prod, camp.upgrades.hp, camp.upgrades.dmg, camp.upgrades.def)).toBeLessThanOrEqual(2);
    expect(camp.upgrades.def).toBe(0);
  });
});

function w0(level: number): Tile {
  const t = new Tile({ kind: 'camp', x: 0, y: 0, owner: 0 });
  t.upgrades.def = level;
  return t;
}
