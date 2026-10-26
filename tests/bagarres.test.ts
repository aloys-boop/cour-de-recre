import { describe, expect, it } from 'vitest';
import { BRAWL, brawlsOf, detectClusters, fighterStrength } from '../src/core/brawls';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 20,
  h: 20,
  teams: 3,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 18, y: 18, owner: 1 },
    { kind: 'camp', x: 0, y: 18, owner: 2 },
  ],
};

const tick = (w: World, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60);
};

describe('bagarres', () => {
  it('deux groupes ennemis au contact forment une bagarre ; la force suit PV × dégâts', () => {
    const w = new World(ARENA, 3, 1, [0, 1, 2]);
    for (let i = 0; i < 3; i++) w.spawnUnit(0, 9, 9 + i * 0.4, false);
    w.spawnUnit(1, 9.7, 9.4, false);
    w.update(1 / 60);
    expect(w.brawls.list).toHaveLength(1);
    const b = w.brawls.list[0];
    expect(new Set(b.teams)).toEqual(new Set([0, 1]));
    expect(b.size).toBe(4);
    // Trois contre un : l'équipe 0 a environ les trois quarts de la force (profils Noir et Vert).
    const s0 = b.shares[b.teams.indexOf(0)];
    const exp0 = (3 * fighterStrength(w, w.units[0])) / (3 * fighterStrength(w, w.units[0]) + fighterStrength(w, w.units[3]));
    expect(s0).toBeCloseTo(exp0, 2);
    expect(b.shares.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 6);
    expect(brawlsOf(w, 0)).toHaveLength(1);
    expect(brawlsOf(w, 2)).toHaveLength(0);
  });

  it('les améliorations et les bonus comptent dans la force', () => {
    const w = new World(ARENA, 3, 1, [0, 0, 0].map((_, i) => i));
    const a = w.spawnUnit(0, 5, 5, false);
    const base = fighterStrength(w, a);
    a.dmgMul = 1.3;
    expect(fighterStrength(w, a)).toBeCloseTo(base * 1.3, 6);
    a.hp /= 2;
    expect(fighterStrength(w, a)).toBeCloseTo(base * 0.65, 6);
  });

  it('pas de bagarre entre alliés ni à distance ; deux mêlées séparées = deux bagarres', () => {
    const w = new World(ARENA, 3, 1);
    w.setAllied(0, 2, true);
    w.spawnUnit(0, 3, 3, false);
    w.spawnUnit(2, 3.5, 3, false);
    w.spawnUnit(1, 6, 6, false);
    w.update(1 / 60);
    expect(detectClusters(w)).toHaveLength(0);
    w.spawnUnit(1, 3.6, 3.6, false);
    w.spawnUnit(0, 14, 14, false);
    w.spawnUnit(1, 14.6, 14, false);
    w.update(1 / 60);
    const c = detectClusters(w);
    expect(c).toHaveLength(2);
    // La bagarre à trois (0 et 2 alliés contre 1) les compte tous.
    const three = c.find((x) => x.strength.size === 3)!;
    expect([...three.strength.keys()].sort()).toEqual([0, 1, 2]);
  });

  it('recalcul quelques fois par seconde, même bagarre suivie, fin en fondu', () => {
    const w = new World(ARENA, 3, 1);
    const a = w.spawnUnit(0, 9, 9, false);
    const b = w.spawnUnit(1, 9.5, 9, false);
    w.update(1 / 60);
    const first = w.brawls.list[0];
    const next = w.brawls.nextAt;
    expect(next - w.time).toBeCloseTo(BRAWL.every, 2);
    w.update(1 / 60);
    expect(w.brawls.nextAt).toBe(next);
    tick(w, 1);
    expect(w.brawls.list).toHaveLength(1);
    expect(w.brawls.list[0]).toBe(first);
    // Séparés : la bagarre se termine puis disparaît après le fondu.
    a.x = 2;
    b.x = 17;
    a.engagedId = b.engagedId = -1;
    w.orderMove([a], { x: 2, y: 2 });
    w.orderMove([b], { x: 17, y: 17 });
    tick(w, 0.3);
    expect(first.endedAt).not.toBeNull();
    tick(w, BRAWL.fade + 0.3);
    expect(w.brawls.list).toHaveLength(0);
  });

  it('tendance : l’équipe qui gagne du terrain est signalée', () => {
    const w = new World(ARENA, 3, 1, [0, 0, 0].map((_, i) => i));
    const mine = [0, 1, 2].map((i) => w.spawnUnit(0, 9, 8.8 + i * 0.4, false));
    const foes = [0, 1].map((i) => w.spawnUnit(1, 9.6, 9 + i * 0.4, false));
    for (const u of [...mine, ...foes]) {
      u.hp = u.maxHp = 200;
      u.dmgMul = 1 / w.mods[u.team].dmg;
    }
    tick(w, 3.2);
    const b = w.brawls.list.find((x) => x.endedAt === null)!;
    expect(b.trendTeam).toBe(0);
    expect(b.trendDelta).toBeGreaterThanOrEqual(BRAWL.trendMin);
  });
});
