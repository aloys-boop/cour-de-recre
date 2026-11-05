import { describe, expect, it } from 'vitest';
import { TeamAi } from '../src/core/ai';
import { GARRISON, assignGuards, guardCounts, guardsOf } from '../src/core/garrison';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

// Cour simple : deux camps aux coins, une case bonus au milieu, production à l'arrêt.
const MAP: MapDef = {
  id: 'g',
  name: 'G',
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

const tick = (w: World, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60);
};

function setup() {
  const w = new World(MAP, 2, 3);
  const tile = w.tiles[2];
  const guards = [0, 1, 2].map((i) => w.spawnUnit(0, 5 + i * 0.3, 5, false));
  return { w, tile, guards };
}

describe('garnisons : ordre « Garder »', () => {
  it('les gardes vont sur la case, la prennent et y restent', () => {
    const { w, tile, guards } = setup();
    expect(assignGuards(w, guards, tile)).toBe(3);
    expect(guards.every((u) => u.guard === tile)).toBe(true);
    tick(w, 12);
    expect(tile.owner).toBe(0);
    expect(guards.every((u) => tile.contains(u.x, u.y, tile.half + GARRISON.slack))).toBe(true);
    expect(guardCounts(w, 0).get(tile)).toBe(3);
    expect(guardsOf(w, tile, 0)).toHaveLength(3);
  });

  it('un garde engage un ennemi entré dans le rayon défendu, même hors de sa portée habituelle', () => {
    const { w, tile, guards } = setup();
    assignGuards(w, guards, tile);
    tick(w, 8);
    // Ennemi à 2,4 cases du centre : hors de la portée d'engagement d'un élève inoccupé posé de l'autre côté.
    const e = w.spawnUnit(1, tile.cx + 2.4, tile.cy, false);
    e.frozenUntil = 999; // il reste planté là
    tick(w, 0.6);
    expect(guards.some((u) => u.engagedId === e.id)).toBe(true);
  });

  it('les gardes ne se laissent pas attirer loin : au-delà de la laisse, ils reviennent', () => {
    const { w, tile, guards } = setup();
    assignGuards(w, guards, tile);
    tick(w, 8);
    const e = w.spawnUnit(1, tile.cx + 2, tile.cy, false);
    e.maxHp = e.hp = 100000;
    tick(w, 0.5);
    // L'ennemi s'enfuit loin de la case.
    w.orderMove([e], { x: 15, y: 2 });
    tick(w, 8);
    expect(guards.every((u) => u.engagedId !== e.id)).toBe(true);
    for (const u of guards) expect(Math.hypot(u.x - tile.cx, u.y - tile.cy)).toBeLessThan(GARRISON.leash);
    tick(w, 4);
    expect(guards.every((u) => tile.contains(u.x, u.y, tile.half + GARRISON.slack))).toBe(true);
  });

  it('une case perdue est reprise par ses gardes', () => {
    const { w, tile, guards } = setup();
    assignGuards(w, guards, tile);
    tick(w, 10);
    expect(tile.owner).toBe(0);
    // Les gardes sont repoussés hors de la case, l'ennemi la prend puis part.
    w.orderMove(guards, { x: 3, y: 3 });
    for (const u of guards) u.guard = tile; // ordre forcé pour le test : ils restent de garde
    tile.owner = 1;
    tick(w, 12);
    expect(tile.owner).toBe(0);
  });

  it('un nouvel ordre du joueur libère le garde', () => {
    const { w, tile, guards } = setup();
    assignGuards(w, guards, tile);
    w.orderMove([guards[0]], { x: 2, y: 12 });
    expect(guards[0].guard).toBeNull();
    expect(guards[1].guard).toBe(tile);
    const e = w.spawnUnit(1, 12, 12, false);
    w.orderAttack([guards[1]], e.id);
    expect(guards[1].guard).toBeNull();
    expect(guardCounts(w, 0).get(tile)).toBe(1);
  });

  it('un garde KO disparaît du compte ; les pions ne gardent pas', () => {
    const { w, tile, guards } = setup();
    const pion = w.spawnUnit(0, 4, 4, false);
    pion.pion = true;
    expect(assignGuards(w, [...guards, pion], tile)).toBe(3);
    expect(pion.guard).toBeNull();
    guards[0].takeDamage(99999, 0, 0);
    expect(guardCounts(w, 0).get(tile)).toBe(2);
  });

  it('un camp et le trône se gardent aussi', () => {
    const { w, guards } = setup();
    const camp = w.tiles[0];
    expect(assignGuards(w, guards, camp)).toBe(3);
    tick(w, 8);
    expect(guards.every((u) => camp.contains(u.x, u.y, camp.half + GARRISON.slack))).toBe(true);
  });

  it("l'IA ne commande pas les élèves de garde", () => {
    const { w, tile, guards } = setup();
    for (let i = 0; i < 6; i++) w.spawnUnit(0, 2 + i * 0.2, 2, false);
    w.spawnUnit(1, 14, 13, false);
    assignGuards(w, guards, tile);
    const ai = new TeamAi(w, 0, 'expert');
    for (let t = 0; t < 20; t += 1 / 60) {
      ai.update(1 / 60);
      w.update(1 / 60);
    }
    expect(guards.filter((u) => u.alive).every((u) => u.guard === tile)).toBe(true);
  });

  it('témoin stratège : avec garrisonSize, une IA laisse des gardes sur ses cases bonus', () => {
    const w = new World(MAP, 2, 5);
    for (let i = 0; i < 10; i++) w.spawnUnit(0, 8 + (i % 3) * 0.2, 8 + Math.floor(i / 3) * 0.2, false);
    const tile = w.tiles[2];
    tile.owner = 0;
    const ai = new TeamAi(w, 0, 'normal');
    ai.garrisonSize = 2;
    for (let t = 0; t < 6; t += 1 / 60) {
      ai.update(1 / 60);
      w.update(1 / 60);
    }
    expect(guardCounts(w, 0).get(tile)).toBe(2);
  });
});

describe('garnisons : textes', () => {
  it('« Comment jouer » explique le geste « Garder »', async () => {
    const { HOW_TO } = await import('../src/ui/overlay');
    const r = HOW_TO.find(([t]) => t === 'Garnisons');
    expect(r).toBeDefined();
    expect(r![1]).toContain('« Garder »');
    expect(r![1]).toContain('reprennent');
  });

  it('le tutoriel a une étape « Garder » juste après la prise d’une seconde case', async () => {
    const { TUTORIAL_STEPS } = await import('../src/core/tutorial');
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(ids.indexOf('guard')).toBe(ids.indexOf('merits') + 1);
  });
});
