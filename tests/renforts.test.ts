import { describe, expect, it } from 'vitest';
import { REINFORCE, reinforceTarget, threatLevel } from '../src/core/reinforce';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

// Cour simple : deux camps aux coins, deux cases bonus, un camp qui produit vite.
const MAP: MapDef = {
  id: 'r',
  name: 'R',
  w: 24,
  h: 24,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 22, y: 22, owner: 1 },
    { kind: 'bonus', x: 6, y: 6, suit: 'heart' },
    { kind: 'bonus', x: 10, y: 3, suit: 'spade' },
    { kind: 'bonus', x: 20, y: 2, suit: 'club' },
  ],
};

const tick = (w: World, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60);
};

function setup() {
  const w = new World(MAP, 2, 7);
  const [camp, enemyCamp, heart, spade, club] = w.tiles;
  for (const t of [heart, spade, club]) t.owner = 0;
  w.productionScale[1] = 0; // l'adversaire ne produit pas : seul le camp du joueur fabrique des élèves
  return { w, camp, enemyCamp, heart, spade, club };
}

/** Ennemi planté près d'une case. */
function intruder(w: World, x: number, y: number) {
  const e = w.spawnUnit(1, x, y, false);
  e.frozenUntil = 999;
  return e;
}

describe('renforts automatiques : choix de la case', () => {
  it('rien de menacé : pas de cible', () => {
    const { w, camp } = setup();
    tick(w, 0.1);
    expect(reinforceTarget(w, camp)).toBeNull();
  });

  it('la case menacée est choisie, la plus menacée l’emporte à distance comparable', () => {
    const { w, camp, heart, spade } = setup();
    intruder(w, heart.cx + 1, heart.cy);
    for (let i = 0; i < 4; i++) intruder(w, spade.cx + 1, spade.cy + i * 0.3);
    tick(w, 0.1);
    expect(threatLevel(w, heart, 0)).toBeGreaterThan(0);
    expect(reinforceTarget(w, camp)).toBe(spade);
  });

  it('une case trop loin du camp n’est pas secourue', () => {
    const { w, camp, club } = setup();
    expect(Math.hypot(club.cx - camp.cx, club.cy - camp.cy)).toBeGreaterThan(REINFORCE.reach);
    intruder(w, club.cx, club.cy + 1);
    tick(w, 0.1);
    expect(reinforceTarget(w, camp)).toBeNull();
  });

  it('un allié près de la case n’est pas une menace', () => {
    const { w, camp, heart } = setup();
    w.setAllied(0, 1, true);
    intruder(w, heart.cx + 1, heart.cy);
    tick(w, 0.1);
    expect(reinforceTarget(w, camp)).toBeNull();
  });
});

describe('renforts automatiques : nouveaux élèves', () => {
  it('option coupée : les nouveaux élèves restent au camp', () => {
    const { w, camp, heart } = setup();
    intruder(w, heart.cx + 1, heart.cy);
    tick(w, 1.2);
    const mine = w.units.filter((u) => u.team === 0);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((u) => u.order.kind === 'none')).toBe(true);
    expect(w.reinforceOn(camp)).toBe(false);
  });

  it('option active : le nouvel élève court vers la case menacée en se battant, et le pointillé la vise', () => {
    const { w, camp, heart } = setup();
    expect(w.setReinforce(0, camp, true)).toBe(true);
    intruder(w, heart.cx + 1, heart.cy);
    tick(w, 1.2);
    const born = w.units.filter((u) => u.team === 0);
    expect(born.length).toBeGreaterThan(0);
    for (const u of born) {
      expect(u.order.kind).toBe('move');
      if (u.order.kind === 'move') {
        expect(u.order.engage).toBe(true);
        expect(heart.contains(u.order.target.x, u.order.target.y, heart.half + 0.5)).toBe(true);
      }
    }
    expect(w.reinforceTargetOf(camp)).toBe(heart);
  });

  it('rien de menacé : le ralliement habituel s’applique', () => {
    const { w, camp } = setup();
    w.setReinforce(0, camp, true);
    w.setCampRally(0, camp, { x: 8, y: 1 });
    tick(w, 1.2);
    const born = w.units.filter((u) => u.team === 0);
    expect(born.length).toBeGreaterThan(0);
    expect(born.every((u) => u.order.kind === 'move' && Math.hypot(u.order.target.x - 8, u.order.target.y - 1) < 1.5)).toBe(true);
    expect(w.reinforceTargetOf(camp)).toBeNull();
  });

  it('camp lui-même attaqué : ses nouveaux élèves restent le défendre', () => {
    const { w, camp, heart } = setup();
    w.setReinforce(0, camp, true);
    w.setCampRally(0, camp, { x: 8, y: 1 });
    intruder(w, heart.cx + 1, heart.cy);
    for (let i = 0; i < 3; i++) intruder(w, camp.cx + 1.5, camp.cy + 1.5 + i * 0.2);
    tick(w, 1.2);
    const born = w.units.filter((u) => u.team === 0);
    expect(born.length).toBeGreaterThan(0);
    // Ni au drapeau, ni vers le cœur : ils restent (et se battent sur place).
    expect(born.every((u) => u.order.kind !== 'move')).toBe(true);
    expect(w.reinforceTargetOf(camp)).toBeNull();
  });

  it('camp perdu : l’option tombe', () => {
    const { w, camp } = setup();
    w.setReinforce(0, camp, true);
    expect(w.setReinforce(1, camp, true)).toBe(false);
    camp.owner = 1;
    expect(w.reinforceOn(camp)).toBe(false);
    camp.owner = 0;
    expect(w.reinforceOn(camp)).toBe(false); // il faut la réactiver
  });
});
