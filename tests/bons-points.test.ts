import { describe, expect, it } from 'vitest';
import { TEAM_PROFILES, TUNING } from '../src/config';
import { EconomyAi } from '../src/core/ai-economy';
import { awardMerit, MERITS, meritsOf, spendMerits } from '../src/core/merits';
import { ensureSupervisors, hitSupervisor } from '../src/core/supervisors';
import { Tile, updateCapture } from '../src/core/tile';
import type { MapDef } from '../src/core/types';
import { buyClassUnlock, buyDefense, buyGlobal, campDefenseMul, CLASS_UNLOCK, globalCost, teamUpgrades, totalTeamUpgrades, UPGRADES } from '../src/core/upgrades';
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
  it('globales : 3 niveaux par branche, coûts croissants, une fois pour toute l’équipe', () => {
    const w = new World(ARENA, 2, 5);
    awardMerit(w, 0, 1000, 0, 0, 'hold');
    const costs: number[] = [];
    for (let i = 0; i < 3; i++) {
      costs.push(globalCost(w, 0, 'prod')!);
      expect(buyGlobal(w, 0, 'prod')).toBe('ok');
    }
    expect(costs[1]).toBeGreaterThan(costs[0]);
    expect(costs[2]).toBeGreaterThan(costs[1]);
    expect(teamUpgrades(w, 0).prod).toBe(3);
    expect(buyGlobal(w, 0, 'prod')).toBe('max');
    expect(meritsOf(w, 0)).toBe(1000 - costs.reduce((a, b) => a + b, 0));
    // Une amélioration globale vaut plus cher qu'une amélioration d'un seul camp.
    expect(UPGRADES.hp.costs[0]).toBeGreaterThan(UPGRADES.def.costs[0]);
    expect(buyDefense(w, 0, w.tiles[1])).toBe('pas-ton-camp');
    expect(buyDefense(w, 0, w.tiles[2])).toBe('pas-ton-camp');
    const poor = new World(ARENA, 2, 5);
    expect(buyGlobal(poor, 0, 'hp')).toBe('pas-assez');
    expect(buyClassUnlock(poor, 0)).toBe('pas-assez');
    expect(teamUpgrades(poor, 0).hp).toBe(0);
    awardMerit(poor, 0, CLASS_UNLOCK.cost, 0, 0, 'hold');
    expect(buyClassUnlock(poor, 0)).toBe('ok');
    expect(buyClassUnlock(poor, 0)).toBe('deja');
  });

  it('Production : +15 % de vitesse de production par niveau, dans tous les camps', () => {
    const count = (level: number) => {
      const w = new World({ ...ARENA, spawnInterval: 2 }, 2, 5);
      w.teamUpgrades[0].prod = level;
      w.refreshMods();
      tick(w, 31);
      return w.teamUnitCount(0);
    };
    const base = count(0);
    const max = count(3);
    expect(UPGRADES.prod.perLevel).toBe(0.15);
    // Équipe Noire (3 points de production, ×1) : 31 s à 2 s par élève → 15 élèves ; ×1,45 au niveau 3 → 22.
    const noir = TEAM_PROFILES[0].prod;
    expect(base).toBe(Math.floor(31 / (2 / noir)));
    expect(max).toBe(Math.floor(31 / (2 / (noir * 1.45))));
  });

  it('Uniformes et Entraînement : PV et dégâts de tous les élèves de l’équipe, y compris ceux déjà sur le terrain', () => {
    const w = new World({ ...ARENA, spawnInterval: 1 }, 2, 5);
    const before = w.spawnUnit(0, 3, 3, false);
    const base = before.maxHp;
    awardMerit(w, 0, 1000, 0, 0, 'hold');
    buyGlobal(w, 0, 'hp');
    buyGlobal(w, 0, 'hp');
    for (let i = 0; i < 3; i++) buyGlobal(w, 0, 'dmg');
    expect(before.maxHp).toBe(Math.round(base * 1.2));
    tick(w, 1.1);
    const fresh = w.units.find((x) => x.team === 0 && x !== before)!;
    expect(fresh.maxHp).toBe(Math.round(TUNING.unitHp * w.mods[0].hp));
    expect(w.mods[0].dmg).toBeCloseTo(TEAM_PROFILES[0].dmg * 1.3, 5);
    // Les cases bonus s'ajoutent sans effacer les améliorations.
    w.tiles[2].owner = 0;
    w.refreshMods();
    expect(w.mods[0].hp).toBeCloseTo(TEAM_PROFILES[0].hp * 1.3 * 1.2, 5);
  });

  it('Entraînement : les élèves entraînés frappent plus fort', () => {
    const dealt = (level: number) => {
      const w = new World(ARENA, 2, 9);
      w.teamUpgrades[0].dmg = level;
      w.refreshMods();
      const a = w.spawnUnit(0, 3, 3, false, w.tiles[0]);
      const b = w.spawnUnit(1, 3.4, 3, false);
      b.hp = b.maxHp = 100000;
      a.hp = a.maxHp = 100000;
      tick(w, 20);
      return 100000 - b.hp;
    };
    expect(dealt(3) / dealt(0)).toBeGreaterThan(1.2);
  });

  it('Défense (par camp) : le camp se capture 30 % plus lentement par niveau et soigne plus vite', () => {
    const time = (level: number) => {
      const t = new Tile({ kind: 'camp', x: 0, y: 0, owner: 0 });
      t.defense = level;
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
      w.tiles[0].defense = level;
      const u = w.spawnUnit(0, 1, 1, false);
      u.hp = 10;
      tick(w, 2);
      return u.hp - 10;
    };
    expect(heal(3) / heal(0)).toBeCloseTo(campDefenseMul(w0(3)), 1);
    const w = new World(ARENA, 2, 5);
    awardMerit(w, 0, 100, 0, 0, 'hold');
    expect(buyDefense(w, 0, w.tiles[0])).toBe('ok');
    expect(w.tiles[0].defense).toBe(1);
  });

  it('un camp capturé perd sa Défense mais prend aussitôt les améliorations globales du preneur', () => {
    const w = new World({ ...ARENA, spawnInterval: 2 }, 2, 5);
    const camp = w.tiles[1];
    camp.defense = 2;
    w.teamUpgrades[1].hp = 3;
    w.teamUpgrades[0].prod = 3;
    w.refreshMods();
    camp.owner = 0;
    expect(camp.defense).toBe(0);
    // Le camp conquis produit aussitôt au rythme de l'équipe 0 (Production 3) : deux camps, deux fois plus d'élèves.
    tick(w, 2 / w.mods[0].prod + 0.05);
    expect(w.teamUnitCount(0)).toBe(2);
    expect(w.mods[0].prod).toBeCloseTo(TEAM_PROFILES[0].prod * 1.45, 5);
  });
});

describe('IA : dépenses de bons points', () => {
  it('une IA Normal achète des améliorations globales quand elle en a les moyens', () => {
    const w = new World(ARENA, 2, 5);
    const eco = new EconomyAi(w, 1, 'normal');
    awardMerit(w, 1, 300, 0, 0, 'hold');
    tick(w, 20, () => eco.update(1 / 60));
    expect(totalTeamUpgrades(w, 1)).toBeGreaterThanOrEqual(3);
    expect(meritsOf(w, 1)).toBeLessThan(300);
    // Production d'abord (camp tranquille, loin du plafond).
    expect(teamUpgrades(w, 1).prod).toBeGreaterThanOrEqual(1);
    expect(w.tiles[1].defense).toBe(0);
  });

  it('une IA Difficile renforce la défense d’un camp attaqué', () => {
    const w = new World(ARENA, 2, 5);
    const camp = w.tiles[1];
    for (let i = 0; i < 8; i++) w.spawnUnit(0, 10.5 + (i % 3) * 0.4, 10.5 + Math.floor(i / 3) * 0.4, false);
    camp.capTeam = 0;
    camp.cap = 0.3;
    w.update(1 / 60);
    const eco = new EconomyAi(w, 1, 'difficile');
    eco.allowPion = false;
    eco.allowPowers = false;
    awardMerit(w, 1, 45, 0, 0, 'hold');
    eco.think();
    expect(camp.defense).toBe(1);
  });

  it('une IA Facile dépense lentement et ne dépasse pas le niveau 2', () => {
    const w = new World(ARENA, 2, 5);
    const eco = new EconomyAi(w, 1, 'facile');
    awardMerit(w, 1, 5000, 0, 0, 'hold');
    tick(w, 300, () => eco.update(1 / 60));
    const up = teamUpgrades(w, 1);
    expect(Math.max(up.prod, up.hp, up.dmg)).toBeLessThanOrEqual(2);
    expect(w.tiles[1].defense).toBe(0);
  });
});

function w0(level: number): Tile {
  const t = new Tile({ kind: 'camp', x: 0, y: 0, owner: 0 });
  t.defense = level;
  return t;
}
