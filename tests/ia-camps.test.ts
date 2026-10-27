import { describe, expect, it } from 'vitest';
import { EconomyAi, RALLY_REACH } from '../src/core/ai-economy';
import { awardMerit } from '../src/core/merits';
import { PION } from '../src/core/pion';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const MAP: MapDef = {
  id: 'm',
  name: 'M',
  w: 20,
  h: 20,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 18, y: 18, owner: 1 },
    { kind: 'camp', x: 18, y: 0, owner: 1 },
    { kind: 'bonus', x: 15, y: 10, suit: 'heart' },
    { kind: 'bonus', x: 4, y: 4, suit: 'club' },
  ],
};

describe('IA : camps, types, ralliements', () => {
  it('des types d’élèves différents selon les camps', () => {
    const w = new World(MAP, 2, 1);
    w.teamUpgrades[1].classes = true;
    awardMerit(w, 1, 300, 0, 0, 'hold');
    for (let i = 0; i < 16; i++) w.spawnUnit(1, 16 + (i % 4) * 0.4, 16 + Math.floor(i / 4) * 0.4, false);
    w.update(1 / 60);
    const eco = new EconomyAi(w, 1, 'difficile');
    eco.allowPowers = false;
    eco.allowPion = false;
    eco.think();
    const [, a, b] = w.tiles;
    expect(a.produce).not.toBe('eleve');
    expect(b.produce).not.toBe('eleve');
    expect(a.produce).not.toBe(b.produce);
  });

  it('ralliement vers une case menacée, sinon vers sa cible d’attaque, jamais trop loin du camp', () => {
    const w = new World(MAP, 2, 1);
    const tile = w.tiles[3];
    tile.owner = 1;
    const eco = new EconomyAi(w, 1, 'difficile');
    eco.allowPowers = false;
    eco.allowUpgrades = false;
    // Une case de l'IA attaquée près de son camp sud : les nouveaux élèves y vont.
    for (let i = 0; i < 3; i++) w.spawnUnit(0, 15 + i * 0.3, 10.5, false);
    w.update(1 / 60);
    eco.think();
    const south = w.tiles[1];
    const r = w.rallyFor(south)!;
    expect(Math.hypot(r.x - tile.cx, r.y - tile.cy)).toBeLessThan(0.5);
    // Sans menace : vers la cible d'attaque, à RALLY_REACH cases au plus.
    for (const u of w.units) u.takeDamage(1000, 0, 0);
    for (let i = 0; i < 120; i++) w.update(1 / 60);
    eco.targetOf = () => w.tiles[0];
    eco.think();
    for (const camp of [w.tiles[1], w.tiles[2]]) {
      const p = w.rallyFor(camp)!;
      expect(p).not.toBeNull();
      const d = Math.hypot(p.x - camp.cx, p.y - camp.cy);
      expect(d).toBeLessThanOrEqual(RALLY_REACH + 0.01);
      // Dans la direction de la cible.
      expect(Math.hypot(p.x - w.tiles[0].cx, p.y - w.tiles[0].cy)).toBeLessThan(Math.hypot(camp.cx - w.tiles[0].cx, camp.cy - w.tiles[0].cy));
    }
  });

  it('en Facile, pas de ralliement ; pion et Défense pour un camp menacé (Difficile)', () => {
    const easy = new World(MAP, 2, 1);
    const e = new EconomyAi(easy, 1, 'facile');
    e.targetOf = () => easy.tiles[0];
    e.think();
    expect(easy.rallyFor(easy.tiles[1])).toBeNull();
    const w = new World(MAP, 2, 1);
    for (let i = 0; i < 8; i++) w.spawnUnit(0, 18.5 + (i % 3) * 0.3, 16.5 + Math.floor(i / 3) * 0.3, false);
    w.update(1 / 60);
    const hard = new EconomyAi(w, 1, 'expert');
    hard.allowPowers = false;
    awardMerit(w, 1, PION.cost + 60, 0, 0, 'hold');
    hard.think();
    expect(w.tiles[1].pionBought).toBe(true);
    hard.think();
    expect(w.tiles[1].defense).toBeGreaterThanOrEqual(1);
    expect(w.tiles[2].pionBought).toBe(false);
  });
});
