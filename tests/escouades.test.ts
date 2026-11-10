import { describe, expect, it } from 'vitest';
import { assignGuards } from '../src/core/garrison';
import { assignConquest, conquestTarget, SQUAD, squadMembers, squadsOf } from '../src/core/squads';
import type { MapDef } from '../src/core/types';
import { NO_TEAM } from '../src/core/types';
import { World } from '../src/core/world';

// Cour simple : deux camps aux coins, trois cases bonus neutres à distances croissantes du camp 0.
const MAP: MapDef = {
  id: 'e',
  name: 'E',
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

function setup(fog = false) {
  const w = new World(MAP, 2, 7);
  if (fog) w.rules.fog = true;
  w.productionScale[0] = 0;
  w.productionScale[1] = 0;
  const [camp, enemyCamp, heart, spade, club] = w.tiles;
  const squad = Array.from({ length: 5 }, (_, i) => w.spawnUnit(0, 2.5 + (i % 3) * 0.4, 2.5 + Math.floor(i / 3) * 0.4, false));
  return { w, camp, enemyCamp, heart, spade, club, squad };
}

function planted(w: World, x: number, y: number) {
  const e = w.spawnUnit(1, x, y, false);
  e.frozenUntil = 999;
  return e;
}

describe('escouades : choix de la case à conquérir', () => {
  it('vise la case libre la plus proche, jamais une case à soi', () => {
    const { w, heart, spade } = setup();
    expect(conquestTarget(w, 0, { x: 3, y: 3 }, 5)).toBe(heart);
    heart.owner = 0;
    expect(conquestTarget(w, 0, { x: 3, y: 3 }, 5)).toBe(spade);
  });

  it('ignore les cases d’un allié', () => {
    const { w, heart, spade } = setup();
    w.setAllied(0, 1, true);
    heart.owner = 1;
    expect(conquestTarget(w, 0, { x: 3, y: 3 }, 5)).toBe(spade);
  });

  it('écarte une case trop défendue pour sa taille, la garde pour une escouade plus grosse', () => {
    const { w, heart, spade } = setup();
    for (let i = 0; i < 8; i++) planted(w, heart.cx + 0.3 * (i % 3), heart.cy + 0.3 * Math.floor(i / 3));
    tick(w, 0.05);
    expect(conquestTarget(w, 0, { x: 3, y: 3 }, 3)).toBe(spade);
    expect(conquestTarget(w, 0, { x: 3, y: 3 }, 8)).not.toBeNull();
  });

  it('préfère un camp libre à une case bonus à distance comparable', () => {
    const { w, enemyCamp, club } = setup();
    enemyCamp.owner = NO_TEAM; // camp libre (comme un camp fantôme)
    // Point du segment trèfle-camp situé 2 cases plus près du trèfle que du camp.
    const len = Math.hypot(enemyCamp.cx - club.cx, enemyCamp.cy - club.cy);
    const k = (len - 2) / 2 / len;
    const from = { x: club.cx + (enemyCamp.cx - club.cx) * k, y: club.cy + (enemyCamp.cy - club.cy) * k };
    const dc = Math.hypot(enemyCamp.cx - from.x, enemyCamp.cy - from.y);
    const db = Math.hypot(club.cx - from.x, club.cy - from.y);
    expect(dc).toBeGreaterThan(db);
    expect(dc - SQUAD.campBonus).toBeLessThan(db);
    expect(conquestTarget(w, 0, from, 5)).toBe(enemyCamp);
  });

  it('ne vise jamais une case ni un camp tenus par une autre équipe', () => {
    const { w, heart, spade, club, enemyCamp } = setup();
    heart.owner = 1;
    spade.owner = 1;
    club.owner = 1;
    expect(SQUAD.enemyTiles).toBe(false);
    expect(conquestTarget(w, 0, { x: 3, y: 3 }, 30)).toBeNull();
    expect(conquestTarget(w, 0, { x: enemyCamp.cx - 2, y: enemyCamp.cy - 2 }, 30)).toBeNull();
  });

  it('ne va pas plus loin que sa portée', () => {
    const { w, enemyCamp } = setup();
    for (const t of w.tiles) if (t.kind === 'bonus') t.owner = 0;
    enemyCamp.owner = NO_TEAM;
    // Seul le camp libre reste, à plus de 22 cases du coin.
    expect(Math.hypot(enemyCamp.cx - 1, enemyCamp.cy - 1)).toBeGreaterThan(SQUAD.reach);
    expect(conquestTarget(w, 0, { x: 1, y: 1 }, 5)).toBeNull();
    expect(conquestTarget(w, 0, { x: 12, y: 12 }, 5)).toBe(enemyCamp);
  });

  it('sous le brouillard, elle ne voit pas les défenseurs cachés (pas de triche)', () => {
    for (const fog of [false, true]) {
      const { w, heart, spade } = setup(fog);
      heart.owner = 0;
      for (let i = 0; i < 9; i++) planted(w, spade.cx + 0.3 * (i % 3), spade.cy + 0.3 * Math.floor(i / 3));
      tick(w, 0.2);
      const t = conquestTarget(w, 0, { x: 3, y: 3 }, 3);
      if (fog) expect(t).toBe(spade);
      else expect(t).not.toBe(spade);
    }
  });
});

describe('escouades : consigne « Conquérir » en jeu', () => {
  it('l’escouade prend les cases l’une après l’autre, toute seule', () => {
    const { w, heart, spade, squad } = setup();
    const sq = assignConquest(w, squad)!;
    expect(sq.target).toBe(heart);
    expect(squad.every((u) => u.squad === sq.id && u.order.kind === 'move')).toBe(true);
    tick(w, 25);
    expect(heart.owner).toBe(0);
    expect(spade.owner).toBe(0);
    expect(sq.taken).toBeGreaterThanOrEqual(2);
  });

  it('un nouvel ordre ou une garde fait quitter l’escouade', () => {
    const { w, heart, squad } = setup();
    const sq = assignConquest(w, squad)!;
    w.orderMove([squad[0]], { x: 1, y: 1 });
    expect(squad[0].squad).toBe(0);
    assignGuards(w, [squad[1]], heart);
    expect(squad[1].squad).toBe(0);
    expect(squadMembers(w, sq.id)).toHaveLength(3);
    tick(w, 1);
    // L’escouade ne les reprend pas.
    expect(squad[0].squad).toBe(0);
    expect(squad[1].squad).toBe(0);
  });

  it('une escouade vide disparaît', () => {
    const { w, squad } = setup();
    const sq = assignConquest(w, squad)!;
    for (const u of squad) w.orderMove([u], { x: 1, y: 1 });
    tick(w, 1);
    expect(w.squads.has(sq.id)).toBe(false);
    expect(squadsOf(w, 0)).toHaveLength(0);
  });

  it('renonce à une case qui devient trop défendue et passe à une autre', () => {
    const { w, heart, squad } = setup();
    const sq = assignConquest(w, squad)!;
    expect(sq.target).toBe(heart);
    for (let i = 0; i < 9; i++) planted(w, heart.cx + 0.3 * (i % 3), heart.cy + 0.3 * Math.floor(i / 3));
    tick(w, 0.6);
    expect(sq.target).not.toBe(heart);
    expect(sq.avoid.has(heart)).toBe(true);
  });

  it('les pions n’entrent pas dans une escouade', () => {
    const { w, squad } = setup();
    squad[0].pion = true;
    assignConquest(w, squad);
    expect(squad[0].squad).toBe(0);
  });

  it('fait une pause après chaque prise si on le règle, et repart ensuite', () => {
    const { w, heart, squad } = setup();
    const old = SQUAD.pause;
    (SQUAD as { pause: number }).pause = 5;
    try {
      const sq = assignConquest(w, squad)!;
      // Juste après la première prise : pause, pas de nouvelle cible.
      while (sq.taken === 0 && w.time < 20) tick(w, 0.5);
      expect(heart.owner).toBe(0);
      expect(sq.target).toBeNull();
      tick(w, 2);
      expect(sq.target).toBeNull();
      // Pause finie : elle repart.
      tick(w, 4);
      expect(sq.target).not.toBeNull();
    } finally {
      (SQUAD as { pause: number }).pause = old;
    }
  });
});
