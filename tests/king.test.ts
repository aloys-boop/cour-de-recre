import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config';
import { TeamAi } from '../src/core/ai';
import { pickGoldenTile } from '../src/core/events';
import { KING, kingAiScore, kingAnnouncement, kingGarrison, reignLeader, throneCorner, withThrone } from '../src/core/king';
import { generateMap, LEVELS } from '../src/core/mapgen';
import { DEFAULT_RULES, GAME_MODES, normalizeRules } from '../src/core/rules';
import { skirmishLevel } from '../src/core/skirmish';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World, type WorldEvent } from '../src/core/world';

const SMALL: MapDef = {
  id: 'small',
  name: 'Petit',
  w: 10,
  h: 10,
  teams: 3,
  unitCap: 5,
  spawnInterval: 1000, // pas de renforts pendant les tests
  startUnits: 1,
  tiles: [
    { kind: 'camp', x: 0, y: 8, owner: 0 },
    { kind: 'camp', x: 8, y: 0, owner: 1 },
    { kind: 'camp', x: 0, y: 0, owner: 2 },
    { kind: 'bonus', x: 5, y: 5, suit: 'heart' }, // sur le trône : retirée
    { kind: 'bonus', x: 3, y: 6, suit: 'spade' }, // collée au trône : retirée
    { kind: 'bonus', x: 8, y: 8, suit: 'club' }, // loin : gardée
  ],
  obstacles: [
    { x: 4, y: 3 }, // collé au trône : retiré
    { x: 2, y: 5 }, // à distance : gardé
  ],
};

function kingWorld(map: MapDef = SMALL): World {
  const w = new World(withThrone(map), map.teams, 1);
  w.rules = { mode: 'roi' };
  return w;
}

function tick(w: World, seconds: number, events: WorldEvent[] = []): WorldEvent[] {
  const step = 1 / 60;
  for (let t = 0; t < seconds - 1e-9; t += step) {
    w.update(step);
    events.push(...w.drainEvents());
  }
  return events;
}

function throneOf(w: World) {
  return w.tiles.find((t) => t.kind === 'throne')!;
}

/** Place `n` élèves de `team` sur le trône. */
function onThrone(w: World, team: number, n: number) {
  const t = throneOf(w);
  for (let i = 0; i < n; i++) w.spawnUnit(team, t.cx - 0.3 + (i % 2) * 0.6, t.cy - 0.3 + Math.floor(i / 2) * 0.6, false);
}

describe('mode Roi de la cour : options', () => {
  it('le mode est proposé en escarmouche, le classique reste le défaut', () => {
    expect(GAME_MODES.map((m) => m.id)).toEqual(['classique', 'roi']);
    expect(GAME_MODES.find((m) => m.id === 'roi')!.description).toMatch(/2 minutes/);
    expect(DEFAULT_RULES.mode).toBe('classique');
    expect(normalizeRules(undefined).mode).toBe('classique');
  });

  it('mode classique inchangé : pas de trône, pas de règne, victoire classique', () => {
    for (const level of LEVELS) {
      const map = generateMap(level, 42);
      expect(map.tiles.some((t) => t.kind === 'throne')).toBe(false);
    }
    const w = new World(SMALL, 3, 1);
    expect(w.rules.mode).toBe('classique');
    expect(w.tiles.some((t) => t.kind === 'throne')).toBe(false);
    tick(w, 2);
    expect(w.king.reign).toEqual([]);
    expect(w.victors()).toEqual([]);
    // Même avec un trône sur la carte, rien ne s'accumule hors du mode Roi.
    const w2 = new World(withThrone(SMALL), 3, 1);
    throneOf(w2).owner = 0;
    tick(w2, 3);
    expect(w2.king.reignOf(0)).toBe(0);
  });
});

describe('mode Roi de la cour : carte', () => {
  it('trône 2 × 2 au centre, rien dessus ni contre, et la carte reste jouable', () => {
    const map = withThrone(SMALL);
    const thrones = map.tiles.filter((t) => t.kind === 'throne');
    expect(thrones).toEqual([{ kind: 'throne', x: 4, y: 4 }]);
    expect(map.tiles.filter((t) => t.kind === 'bonus').map((t) => [t.x, t.y])).toEqual([[8, 8]]);
    expect(map.obstacles).toEqual([{ x: 2, y: 5 }]);
    expect(map.tiles.filter((t) => t.kind === 'camp')).toHaveLength(3);
    const w = kingWorld();
    const t = throneOf(w);
    expect([t.cx, t.cy, t.size, t.half, t.suit]).toEqual([5, 5, 2, TUNING.campHalf, null]);
    expect(t.isCamp).toBe(false);
    expect(w.grid.walkable(t.cx, t.cy)).toBe(true);
  });

  it('cartes générées (2 à 8 équipes, côtés pairs et impairs) : centre dégagé, reproductible, symétrique', () => {
    const configs = [
      { teams: 2, size: 0, tiles: 10 },
      { teams: 3, size: 0, tiles: 14 },
      { teams: 4, size: 1, tiles: 18 },
      { teams: 5, size: 2, tiles: 24 },
      { teams: 8, size: 3, tiles: 30 },
    ];
    for (const cfg of configs) {
      const level = skirmishLevel(cfg);
      for (const seed of [1, 7, 123, 4567, 99999]) {
        const map = withThrone(generateMap(level, seed));
        expect(withThrone(generateMap(level, seed))).toEqual(map); // reproductible
        expect(withThrone(map)).toBe(map); // idempotent
        const thrones = map.tiles.filter((t) => t.kind === 'throne');
        expect(thrones).toHaveLength(1);
        const c = throneCorner(map.w, map.h);
        expect(thrones[0]).toMatchObject(c);
        const cx = c.x + 1;
        const cy = c.y + 1;
        expect(cx).toBe(map.w / 2);
        // Ni case bonus, ni obstacle, ni camp sur le trône ou contre lui.
        const touches = (x: number, y: number, size: number) =>
          Math.max(Math.abs(x + size / 2 - cx), Math.abs(y + size / 2 - cy)) < 1 + size / 2 + KING.clearMargin;
        for (const t of map.tiles) if (t.kind !== 'throne') expect(touches(t.x, t.y, t.kind === 'camp' ? 2 : 1)).toBe(false);
        for (const o of map.obstacles ?? []) expect(touches(o.x, o.y, 1)).toBe(false);
        // Les retraits respectent la symétrie de la carte (nombre pair d'équipes).
        if (cfg.teams % 2 === 0) {
          const key = (x: number, y: number) => `${x},${y}`;
          const bonus = new Set(map.tiles.filter((t) => t.kind === 'bonus').map((t) => key(t.x, t.y)));
          for (const t of map.tiles) if (t.kind === 'bonus') expect(bonus.has(key(map.w - 1 - t.x, map.h - 1 - t.y))).toBe(true);
        }
      }
    }
  });

  it('la case dorée ne tombe jamais sur le trône', () => {
    const w = kingWorld({ ...SMALL, tiles: SMALL.tiles.filter((t) => t.kind === 'camp') });
    for (let i = 0; i < 20; i++) expect(pickGoldenTile(w)).toBeNull();
  });
});

describe('mode Roi de la cour : règne', () => {
  it('le règne ne s’accumule que si une équipe possède le trône', () => {
    const w = kingWorld();
    tick(w, 5);
    expect(w.king.reign.every((r) => !r)).toBe(true);
    onThrone(w, 0, 4);
    // Capture : 3 s × 2,5 (comme un camp), deux fois plus vite à 4 élèves.
    const seconds = (TUNING.captureSeconds * TUNING.campCaptureFactor) / 2;
    const evs = tick(w, seconds - 0.3);
    expect(throneOf(w).owner).toBe(NO_TEAM);
    expect(w.king.reignOf(0)).toBe(0);
    evs.push(...tick(w, 0.6));
    expect(throneOf(w).owner).toBe(0);
    expect(evs.some((e) => e.kind === 'kingTake' && e.team === 0)).toBe(true);
    tick(w, 10);
    expect(w.king.reignOf(0)).toBeGreaterThan(9.5);
    expect(w.king.reignOf(0)).toBeLessThan(11);
    expect(reignLeader(w)).toBe(0);
    // Les élèves partent : le trône reste à eux et le règne continue.
    for (const u of w.units) if (u.team === 0) u.x = u.y = 8.8;
    const before = w.king.reignOf(0);
    tick(w, 2);
    expect(w.king.reignOf(0)).toBeCloseTo(before + 2, 1);
  });

  it('un trône contesté fige le compteur', () => {
    const w = kingWorld();
    throneOf(w).owner = 0;
    onThrone(w, 0, 2);
    onThrone(w, 1, 2);
    tick(w, 0.5);
    const r = w.king.reignOf(0);
    tick(w, 1.5);
    expect(throneOf(w).contested).toBe(true);
    expect(w.king.reignOf(0)).toBe(r);
  });

  it('victoire à 120 s de règne, avec les alliés du roi', () => {
    const w = kingWorld();
    throneOf(w).owner = 0;
    const evs = tick(w, KING.winSeconds - 1);
    expect(w.victors()).toEqual([]);
    expect(evs.filter((e) => e.kind === 'kingSoon').map((e) => (e as { left: number }).left)).toEqual([60, 20]);
    w.setAllied(0, 2, true);
    evs.push(...tick(w, 1.2));
    expect(w.king.winner).toBe(0);
    expect(w.king.reignOf(0)).toBe(KING.winSeconds);
    expect(w.victors()).toEqual([0, 2]);
    expect(evs.some((e) => e.kind === 'kingWin' && e.team === 0)).toBe(true);
    // Sans alliance, le roi gagne seul.
    const w2 = kingWorld();
    throneOf(w2).owner = 1;
    tick(w2, KING.winSeconds + 0.1);
    expect(w2.winner()).toBe(1);
  });

  it('les règles classiques restent valables en mode Roi', () => {
    const w = kingWorld();
    for (const t of w.tiles) if (t.isCamp) t.owner = 0;
    for (const u of w.units) if (u.team !== 0) u.takeDamage(9999, u.x, u.y);
    tick(w, 3);
    expect(w.victors()).toEqual([0]);
    expect(w.king.winner).toBe(NO_TEAM);
  });

  it('reprise du trône : le nouveau roi accumule, l’ancien garde son temps', () => {
    const w = kingWorld();
    throneOf(w).owner = 0;
    tick(w, 30);
    const old = w.king.reignOf(0);
    expect(old).toBeGreaterThan(29);
    onThrone(w, 1, 4);
    const evs = tick(w, 4.5);
    expect(throneOf(w).owner).toBe(1);
    expect(evs.filter((e) => e.kind === 'kingTake').map((e) => e.team)).toEqual([1]);
    const r0 = w.king.reignOf(0);
    expect(r0).toBeLessThan(old + 5);
    tick(w, 10);
    expect(w.king.reignOf(0)).toBe(r0);
    expect(w.king.reignOf(1)).toBeGreaterThan(9.5);
  });
});

describe('mode Roi de la cour : annonces et IA', () => {
  it('annonces en français', () => {
    const colors = [0, 1, 2];
    expect(kingAnnouncement({ kind: 'kingTake', team: 1 }, 0, colors)).toBe('Les Verts prennent le trône !');
    expect(kingAnnouncement({ kind: 'kingTake', team: 0 }, 0, colors)).toBe('Tu prends le trône !');
    expect(kingAnnouncement({ kind: 'kingSoon', team: 2, left: 20 }, 0, colors)).toBe('Plus que 20 s pour les Jaunes !');
    expect(kingAnnouncement({ kind: 'kingSoon', team: 2, left: 60 }, 0, colors)).toBe('Plus qu’une minute pour les Jaunes !');
    expect(kingAnnouncement({ kind: 'kingSoon', team: 0, left: 20 }, 0, colors)).toBe('Plus que 20 s de règne pour toi !');
    expect(kingAnnouncement({ kind: 'golden', team: 0 }, 0, colors)).toBeNull();
  });

  it('le trône est une cible prioritaire, et l’IA qui le tient y garde une garnison', () => {
    const w = kingWorld();
    const t = throneOf(w);
    const bonus = w.tiles.find((x) => x.kind === 'bonus')!;
    expect(kingAiScore(w, bonus, 0)).toBe(0);
    expect(kingAiScore(w, t, 0)).toBeGreaterThan(1);
    t.owner = 1;
    w.king.reign[1] = 90;
    expect(kingAiScore(w, t, 0)).toBeGreaterThan(KING.aiScore + 0.8);
    expect(kingGarrison(w, 2, 10)).toBeNull();
    expect(kingGarrison(w, 1, 10)).toEqual({ tile: t, size: 3 });
    // Une IA seule avec quelques élèves près de son camp part vers le trône.
    const w2 = kingWorld();
    for (let i = 0; i < 5; i++) w2.spawnUnit(2, 1.2 + (i % 3) * 0.3, 1.2 + Math.floor(i / 3) * 0.3, false);
    const ai = new TeamAi(w2, 2, 'difficile');
    for (let i = 0; i < 60 * 4; i++) {
      ai.update(1 / 60);
      w2.update(1 / 60);
    }
    const th = throneOf(w2);
    const near = w2.units.filter((u) => u.team === 2 && Math.hypot(u.x - th.cx, u.y - th.cy) < 2.5).length;
    expect(near).toBeGreaterThanOrEqual(3);
  });
});
