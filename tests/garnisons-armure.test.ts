import { afterEach, describe, expect, it } from 'vitest';
import { GARRISON, assignGuards, guardArmor } from '../src/core/garrison';
import type { MapDef } from '../src/core/types';
import { World, type WorldEvent } from '../src/core/world';

// v5.10 : gardes retranchés. Un garde dans le cercle défendu de sa case encaisse moins.
const MAP: MapDef = {
  id: 'ga',
  name: 'GA',
  w: 16,
  h: 16,
  teams: 2,
  unitCap: 30,
  spawnInterval: 999,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 14, y: 14, owner: 1 },
    { kind: 'bonus', x: 8, y: 8, suit: 'heart' },
  ],
};

const tick = (w: World, s: number, out?: WorldEvent[]) => {
  for (let t = 0; t < s; t += 1 / 60) {
    w.update(1 / 60);
    const evs = w.drainEvents();
    if (out) out.push(...evs);
  }
};

const ARMOR = GARRISON.armor;
afterEach(() => {
  GARRISON.armor = ARMOR;
});

describe('gardes retranchés (v5.10)', () => {
  it('réglage par défaut : un garde dans son cercle reçoit 25 % de coups en moins', () => {
    expect(ARMOR).toBe(0.75);
  });

  it('seuls les gardes dans le cercle défendu de leur case sont protégés', () => {
    const w = new World(MAP, 2, 3);
    const tile = w.tiles[2];
    const g = w.spawnUnit(0, tile.cx, tile.cy, false);
    const passer = w.spawnUnit(0, tile.cx + 0.5, tile.cy, false);
    assignGuards(w, [g], tile);
    expect(guardArmor(g)).toBe(GARRISON.armor);
    expect(guardArmor(passer)).toBe(1);
    // Hors du cercle (en route ou attiré loin), il redevient un élève comme les autres.
    g.x = tile.cx + GARRISON.radius + 0.5;
    expect(guardArmor(g)).toBe(1);
  });

  it('un garde retranché tient plus longtemps qu’un élève de passage, et ses coups reçus sont « parés »', () => {
    const duel = (guarded: boolean) => {
      const w = new World(MAP, 2, 11);
      const tile = w.tiles[2];
      const me = w.spawnUnit(0, tile.cx, tile.cy, false);
      if (guarded) assignGuards(w, [me], tile);
      me.dmgMul = 0; // il ne rend pas les coups : on mesure seulement ce qu'il encaisse
      const foe = w.spawnUnit(1, tile.cx + 0.4, tile.cy, false);
      const evs: WorldEvent[] = [];
      let t = 0;
      while (me.alive && t < 60) {
        tick(w, 0.25, evs);
        t += 0.25;
      }
      void foe;
      return { t, parried: evs.filter((e) => e.kind === 'hit' && e.parried).length };
    };
    const plain = duel(false);
    const guard = duel(true);
    expect(plain.parried).toBe(0);
    expect(guard.parried).toBeGreaterThan(0);
    expect(guard.t).toBeGreaterThan(plain.t * 1.15);
  });

  it('armure à 1 : aucun coup « paré », comportement d’avant', () => {
    GARRISON.armor = 1;
    const w = new World(MAP, 2, 11);
    const tile = w.tiles[2];
    const me = w.spawnUnit(0, tile.cx, tile.cy, false);
    assignGuards(w, [me], tile);
    w.spawnUnit(1, tile.cx + 0.4, tile.cy, false);
    const evs: WorldEvent[] = [];
    tick(w, 4, evs);
    expect(evs.some((e) => e.kind === 'hit')).toBe(true);
    expect(evs.some((e) => e.kind === 'hit' && e.parried)).toBe(false);
  });
});
