import { describe, expect, it } from 'vitest';
import { assignConquest, assignDefence, defenceTarget, defenceZone, SQUAD, squadMembers, squadMode, zonePost } from '../src/core/squads';
import type { MapDef } from '../src/core/types';
import { NO_TEAM } from '../src/core/types';
import { World } from '../src/core/world';

// Cour simple : deux camps aux coins, trois cases bonus à distances croissantes du camp 0.
const MAP: MapDef = {
  id: 'd',
  name: 'D',
  w: 26,
  h: 26,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 24, y: 24, owner: 1 },
    { kind: 'bonus', x: 5, y: 4, suit: 'heart' },
    { kind: 'bonus', x: 10, y: 3, suit: 'spade' },
    { kind: 'bonus', x: 15, y: 8, suit: 'club' },
  ],
};

const tick = (w: World, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60);
};

function setup(n = 6) {
  const w = new World(MAP, 2, 7);
  w.productionScale[0] = 0;
  w.productionScale[1] = 0;
  const [camp, enemyCamp, heart, spade, club] = w.tiles;
  heart.owner = 0;
  spade.owner = 0;
  // L'escouade se tient sur la case cœur.
  const squad = Array.from({ length: n }, (_, i) => w.spawnUnit(0, heart.cx - 0.4 + (i % 3) * 0.4, heart.cy - 0.3 + Math.floor(i / 3) * 0.5, false));
  return { w, camp, enemyCamp, heart, spade, club, squad };
}

function planted(w: World, x: number, y: number, frozen = true) {
  const e = w.spawnUnit(1, x, y, false);
  if (frozen) e.frozenUntil = 999;
  return e;
}

const near = (u: { x: number; y: number }, t: { cx: number; cy: number }, r: number) => Math.hypot(u.x - t.cx, u.y - t.cy) <= r;

describe('« Défendre » : le secteur', () => {
  it('prend les cases à soi autour de l’escouade, la case où elle se tient d’abord', () => {
    const { w, camp, heart, spade, club } = setup();
    club.owner = 0; // trop loin
    const zone = defenceZone(w, 0, { x: heart.cx, y: heart.cy });
    expect(zone[0]).toBe(heart);
    expect(zone).toContain(camp);
    expect(zone).toContain(spade);
    expect(zone).not.toContain(club);
    expect(Math.hypot(club.cx - heart.cx, club.cy - heart.cy)).toBeGreaterThan(SQUAD.zoneReach);
  });

  it('jamais une case d’une autre équipe, sauf celle où l’escouade se tient', () => {
    const { w, heart, spade } = setup();
    spade.owner = 1;
    expect(defenceZone(w, 0, { x: heart.cx, y: heart.cy })).not.toContain(spade);
    // Debout sur la case pique (ennemie) : elle fait partie du secteur, à reprendre.
    expect(defenceZone(w, 0, { x: spade.cx, y: spade.cy })[0]).toBe(spade);
  });

  it('au plus quatre cases, et un poste au centre du secteur', () => {
    const { w, heart, spade, club, enemyCamp } = setup();
    club.owner = 0;
    enemyCamp.owner = 0;
    const zone = defenceZone(w, 0, { x: 12, y: 12 });
    expect(zone.length).toBeLessThanOrEqual(SQUAD.zoneMax);
    // Trois cases alignées : le poste est celle du milieu.
    expect(zonePost([w.tiles[0], heart, spade])).toBe(heart);
  });

  it('rien à défendre loin de ses cases : pas d’escouade', () => {
    const { w } = setup();
    const lone = w.spawnUnit(0, 20, 14, false);
    expect(assignDefence(w, [lone])).toBeNull();
    expect(lone.squad).toBe(0);
    expect(w.squads.size).toBe(0);
  });
});

describe('« Défendre » en jeu', () => {
  it('l’escouade se poste au centre de son secteur et y reste', () => {
    const { w, heart, squad } = setup();
    const sq = assignDefence(w, squad)!;
    expect(sq.mode).toBe('defend');
    expect(sq.post).toBe(heart);
    expect(squad.every((u) => squadMode(w, u) === 'defend')).toBe(true);
    tick(w, 8);
    expect(sq.target).toBeNull();
    expect(squad.every((u) => near(u, heart, heart.half + 0.8))).toBe(true);
  });

  it('court à la case attaquée, chasse les intrus, puis revient au poste', () => {
    const { w, heart, spade, squad } = setup();
    const sq = assignDefence(w, squad)!;
    tick(w, 1);
    const foes = [planted(w, spade.cx, spade.cy), planted(w, spade.cx + 0.4, spade.cy)];
    tick(w, 0.6);
    expect(sq.target).toBe(spade);
    expect(squad.some((u) => u.order.kind === 'move' || u.engagedId >= 0)).toBe(true);
    tick(w, 25);
    expect(foes.every((e) => !e.alive)).toBe(true);
    expect(spade.owner).toBe(0);
    expect(sq.target).toBeNull();
    tick(w, 8);
    const alive = squadMembers(w, sq.id);
    expect(alive.length).toBeGreaterThan(0);
    expect(alive.every((u) => near(u, heart, heart.half + 0.8))).toBe(true);
  });

  it('reprend une case du secteur tombée, sans qu’on le lui demande', () => {
    const { w, spade, squad } = setup();
    const sq = assignDefence(w, squad)!;
    spade.owner = 1;
    tick(w, 0.6);
    expect(sq.target).toBe(spade);
    tick(w, 25);
    expect(spade.owner).toBe(0);
    expect(sq.taken).toBeGreaterThanOrEqual(1);
  });

  it('ne se jette pas sur une case trop défendue pour sa taille', () => {
    const { w, spade, squad } = setup(3);
    const sq = assignDefence(w, squad)!;
    for (let i = 0; i < 9; i++) planted(w, spade.cx + 0.3 * (i % 3), spade.cy + 0.3 * Math.floor(i / 3));
    tick(w, 0.6);
    expect(sq.target).toBeNull();
    // Une escouade plus grosse irait.
    expect(defenceTarget(w, sq, { x: spade.cx, y: spade.cy }, 12)).toBe(spade);
  });

  it('lâche un ennemi qui quitte le secteur (laisse)', () => {
    const { w, squad } = setup(2);
    const sq = assignDefence(w, squad)!;
    tick(w, 2);
    const far = planted(w, 20, 20);
    squad[0].engagedId = far.id;
    tick(w, 0.6);
    expect(squad[0].engagedId).toBe(-1);
    expect(squad[0].squad).toBe(sq.id);
  });

  it('un autre ordre fait quitter l’escouade ; les pions n’y entrent pas', () => {
    const { w, squad } = setup();
    squad[5].pion = true;
    const sq = assignDefence(w, squad)!;
    expect(squad[5].squad).toBe(0);
    w.orderMove([squad[0]], { x: 1, y: 1 });
    expect(squadMode(w, squad[0])).toBeNull();
    expect(squadMembers(w, sq.id)).toHaveLength(4);
  });

  it('une conquête et une défense cohabitent dans la même équipe', () => {
    const { w, squad, club } = setup();
    club.owner = NO_TEAM;
    const d = assignDefence(w, squad.slice(0, 3))!;
    const c = assignConquest(w, squad.slice(3))!;
    expect(d.mode).toBe('defend');
    expect(c.mode).toBe('conquer');
    expect(c.zone).toHaveLength(0);
    tick(w, 1);
    expect(squad.slice(0, 3).every((u) => squadMode(w, u) === 'defend')).toBe(true);
    expect(squad.slice(3).every((u) => squadMode(w, u) === 'conquer')).toBe(true);
  });
});

describe('« Défendre » : défenseurs retranchés', () => {
  it('encaissent comme des gardes dans leur secteur, normalement ailleurs', async () => {
    const { defenderArmor } = await import('../src/core/squads');
    const { GARRISON } = await import('../src/core/garrison');
    const { w, heart, squad } = setup(2);
    assignDefence(w, squad);
    expect(defenderArmor(w, squad[0])).toBe(GARRISON.armor);
    squad[0].x = 22;
    squad[0].y = 14;
    expect(defenderArmor(w, squad[0])).toBe(1);
    // Une escouade en conquête n'est pas retranchée.
    const c = assignConquest(w, [squad[1]])!;
    expect(c.mode).toBe('conquer');
    expect(Math.hypot(squad[1].x - heart.cx, squad[1].y - heart.cy)).toBeLessThan(GARRISON.radius);
    expect(defenderArmor(w, squad[1])).toBe(1);
  });
});
