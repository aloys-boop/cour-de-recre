import { describe, expect, it } from 'vitest';
import { campName, campNumber, campsOf, stepCamp } from '../src/core/camps';
import { setProduce } from '../src/core/classes';
import { awardMerit, meritsOf } from '../src/core/merits';
import { buyPion, PION, pionOf, pionRespawnLeft } from '../src/core/pion';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const MAP: MapDef = {
  id: 'm',
  name: 'M',
  w: 16,
  h: 16,
  teams: 3,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 14, y: 14, owner: 1 },
    { kind: 'camp', x: 0, y: 14, owner: 2 },
    { kind: 'camp', x: 7, y: 7, ghost: true },
  ],
};

const tick = (w: World, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60);
};

describe('camps : numéro, nom, navigation', () => {
  it('ordre stable, « Camp 2/3 », noms par équipe d’origine, navigation en boucle', () => {
    const w = new World(MAP, 3, 1, [0, 1, 2]);
    w.tiles[1].owner = 0;
    w.tiles[3].owner = 0;
    const mine = campsOf(w, 0);
    expect(mine).toEqual([w.tiles[0], w.tiles[1], w.tiles[3]]);
    expect(campNumber(w, 0, w.tiles[1])).toEqual({ index: 2, count: 3 });
    expect(campNumber(w, 0, w.tiles[2])).toBeNull();
    expect(campName(w, w.tiles[0], 0)).toBe('Camp de départ');
    expect(campName(w, w.tiles[1], 0)).toBe('Camp vert');
    expect(campName(w, w.tiles[3], 0)).toBe('Camp fantôme 1');
    expect(campName(w, w.tiles[0], 1)).toBe('Camp noir');
    expect(stepCamp(w, 0, w.tiles[3], 1)).toBe(w.tiles[0]);
    expect(stepCamp(w, 0, w.tiles[0], -1)).toBe(w.tiles[3]);
  });
});

describe('pion et type produit : par camp, y compris les camps capturés', () => {
  it('chaque camp a son propre pion, acheté séparément, qui revient 60 s après son KO', () => {
    const w = new World(MAP, 3, 1);
    w.tiles[1].owner = 0; // camp capturé
    awardMerit(w, 0, PION.cost * 2, 0, 0, 'hold');
    expect(buyPion(w, 0, w.tiles[0])).toBe('ok');
    expect(buyPion(w, 0, w.tiles[1])).toBe('ok');
    expect(meritsOf(w, 0)).toBe(0);
    const a = pionOf(w, w.tiles[0])!;
    const b = pionOf(w, w.tiles[1])!;
    expect(a).not.toBe(b);
    expect(a.home).toBe(w.tiles[0]);
    expect(b.home).toBe(w.tiles[1]);
    // Le pion du camp capturé garde son camp, pas le premier.
    tick(w, 3);
    expect(Math.hypot(b.x - w.tiles[1].cx, b.y - w.tiles[1].cy)).toBeLessThan(2);
    b.takeDamage(1000, 0, 0);
    tick(w, 1);
    expect(pionOf(w, w.tiles[0])).toBe(a);
    expect(pionRespawnLeft(w, w.tiles[1])).toBeGreaterThan(58);
    tick(w, 60);
    expect(pionOf(w, w.tiles[1])).not.toBeNull();
  });

  it('chaque camp choisit son type d’élève, y compris un camp capturé', () => {
    const w = new World({ ...MAP, spawnInterval: 1 }, 3, 1);
    w.teamUpgrades[0].classes = true;
    w.tiles[2].owner = 0;
    awardMerit(w, 0, 200, 0, 0, 'hold');
    expect(setProduce(w, 0, w.tiles[0], 'costaud')).toBe('ok');
    expect(setProduce(w, 0, w.tiles[2], 'sprinteur')).toBe('ok');
    tick(w, 1.05);
    const near = (t: (typeof w.tiles)[number]) => w.units.filter((u) => u.team === 0 && Math.hypot(u.x - t.cx, u.y - t.cy) < 2).map((u) => u.cls);
    expect(near(w.tiles[0])).toEqual(['costaud']);
    expect(near(w.tiles[2])).toEqual(['sprinteur']);
  });

  it('un camp capturé perd pion, type produit et ralliement', () => {
    const w = new World(MAP, 3, 1);
    w.teamUpgrades[1].classes = true;
    awardMerit(w, 1, PION.cost, 0, 0, 'hold');
    const camp = w.tiles[1];
    buyPion(w, 1, camp);
    setProduce(w, 1, camp, 'infirmier');
    w.setRally(1, { x: 10, y: 10 });
    camp.defense = 2;
    camp.owner = 0;
    tick(w, 0.5);
    expect(camp.pionBought).toBe(false);
    expect(pionOf(w, camp)).toBeNull();
    expect(camp.produce).toBe('eleve');
    expect(camp.defense).toBe(0);
    expect(w.rallyFor(camp)).toBeNull();
  });
});
