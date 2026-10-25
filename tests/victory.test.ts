import { describe, expect, it } from 'vitest';
import { SUIT_BONUS, TEAM_PROFILES, TUNING } from '../src/config';
import { MAPS } from '../src/core/maps';
import { loadProgress, recordWin, saveProgress } from '../src/core/save';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const SMALL: MapDef = {
  id: 'small',
  name: 'Petit',
  w: 8,
  h: 8,
  teams: 3,
  unitCap: 5,
  spawnInterval: 2,
  startUnits: 2,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 6, y: 6, owner: 1 },
    { kind: 'camp', x: 0, y: 6, owner: 2 },
    { kind: 'bonus', x: 3, y: 3, suit: 'heart' },
    { kind: 'bonus', x: 4, y: 3, suit: 'spade' },
    { kind: 'bonus', x: 3, y: 4, suit: 'club' },
    { kind: 'bonus', x: 4, y: 4, suit: 'diamond' },
  ],
};

function tick(w: World, seconds: number) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) w.update(step);
}

describe('conditions de victoire', () => {
  it('pas de gagnant au départ', () => {
    const w = new World(SMALL, 3, 1);
    expect(w.winner()).toBe(NO_TEAM);
    const s = w.stats();
    expect(s.map((x) => x.units)).toEqual([2, 2, 2]);
    expect(s.map((x) => x.camps)).toEqual([1, 1, 1]);
    expect(s.map((x) => x.tiles)).toEqual([0, 0, 0]);
  });

  it('une équipe qui possède tous les camps gagne', () => {
    const w = new World(SMALL, 3, 1);
    for (const t of w.camps) t.owner = 1;
    expect(w.winner()).toBe(1);
  });

  it('la dernière équipe encore en vie gagne même sans tous les camps', () => {
    const w = new World(SMALL, 3, 1);
    for (const u of w.units) if (u.team !== 2) u.takeDamage(1000, u.x, u.y);
    for (const t of w.camps) if (t.owner !== 2) t.owner = NO_TEAM;
    expect(w.winner()).toBe(2);
  });

  it('une équipe sans élèves ni camp est éliminée, mais pas celle qui garde son camp', () => {
    const w = new World(SMALL, 3, 1);
    for (const u of w.units) if (u.team === 0) u.takeDamage(1000, u.x, u.y);
    w.camps[0].owner = 1;
    const s = w.stats();
    expect(s[0].alive).toBe(false);
    expect(s[1].alive).toBe(true);
    expect(w.winner()).toBe(NO_TEAM); // il reste deux équipes
  });

  it('seuls les camps font apparaître des élèves, jusqu’au plafond', () => {
    const w = new World(SMALL, 3, 1, [0, 0, 0]);
    tick(w, 30);
    for (let team = 0; team < 3; team++) expect(w.teamUnitCount(team)).toBeLessThanOrEqual(SMALL.unitCap);
    expect(w.units.length).toBeGreaterThan(6);
    // Une case bonus possédée ne produit rien.
    const w2 = new World({ ...SMALL, tiles: [{ kind: 'bonus', x: 3, y: 3, suit: 'club', owner: 0 }] }, 1, 1, [0]);
    tick(w2, 20);
    expect(w2.units.length).toBe(0);
  });

  it('un camp se capture plus lentement qu’une case bonus', () => {
    const w = new World({ ...SMALL, spawnInterval: 1000 }, 3, 1); // pas de renforts pendant le test
    const camp = w.camps[0];
    const bonusTile = w.tiles.find((t) => !t.isCamp)!;
    for (const u of w.units) u.takeDamage(1000, u.x, u.y);
    w.update(2); // retire les KO
    w.spawnUnit(1, camp.cx, camp.cy);
    w.spawnUnit(1, bonusTile.cx, bonusTile.cy);
    tick(w, TUNING.captureSeconds + 0.2);
    expect(bonusTile.owner).toBe(1);
    expect(camp.owner).toBe(0);
    tick(w, TUNING.captureSeconds * TUNING.campCaptureFactor);
    expect(camp.owner).toBe(1);
  });
});

describe('forces inégales et cases bonus', () => {
  it('les profils d’équipe donnent des points de vie et une production différents', () => {
    const vert = new World({ ...SMALL, unitCap: 30 }, 3, 1, [1, 0, 3]);
    const hpVert = vert.units.find((u) => u.team === 0)!.maxHp;
    const hpNoir = vert.units.find((u) => u.team === 1)!.maxHp;
    const hpViolet = vert.units.find((u) => u.team === 2)!.maxHp;
    expect(hpVert).toBeLessThan(hpNoir);
    expect(hpViolet).toBeGreaterThan(hpNoir);
    expect(hpVert).toBe(Math.round(TUNING.unitHp * TEAM_PROFILES[1].hp));
    // Production : le Vert produit plus vite que le Violet.
    tick(vert, 12);
    expect(vert.teamUnitCount(0)).toBeGreaterThan(vert.teamUnitCount(2));
  });

  it('un cœur augmente la vie, un pique les dégâts, un trèfle la production, un carreau la vitesse', () => {
    const w = new World(SMALL, 3, 1, [0, 0, 0]);
    const base = { ...w.mods[0] };
    const heart = w.tiles.find((t) => t.suit === 'heart')!;
    const spade = w.tiles.find((t) => t.suit === 'spade')!;
    const club = w.tiles.find((t) => t.suit === 'club')!;
    const diamond = w.tiles.find((t) => t.suit === 'diamond')!;
    // Capture simulée : on pose un élève seul sur chaque case et on laisse le temps passer.
    for (const u of w.units) u.takeDamage(1000, u.x, u.y);
    w.update(2);
    for (const t of [heart, spade, club, diamond]) w.spawnUnit(0, t.cx, t.cy);
    tick(w, TUNING.captureSeconds + 0.3);
    expect([heart.owner, spade.owner, club.owner, diamond.owner]).toEqual([0, 0, 0, 0]);
    expect(w.mods[0].hp).toBeCloseTo(base.hp * (1 + SUIT_BONUS.heart.perTile));
    expect(w.mods[0].dmg).toBeCloseTo(base.dmg * (1 + SUIT_BONUS.spade.perTile));
    expect(w.mods[0].prod).toBeCloseTo(base.prod * (1 + SUIT_BONUS.club.perTile));
    expect(w.mods[0].speed).toBeCloseTo(base.speed * (1 + SUIT_BONUS.diamond.perTile));
    // Les élèves existants ont vu leur vie maximale augmenter en proportion.
    for (const u of w.units) if (u.alive && u.team === 0) expect(u.maxHp).toBe(Math.round(TUNING.unitHp * w.mods[0].hp));
  });
});

describe('cartes', () => {
  it('au moins cinq cartes, de taille croissante, un camp par équipe, rien sur les obstacles', () => {
    expect(MAPS.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < MAPS.length; i++) expect(MAPS[i].w * MAPS[i].h).toBeGreaterThan(MAPS[i - 1].w * MAPS[i - 1].h);
    for (const m of MAPS) {
      const obs = new Set((m.obstacles ?? []).map((o) => `${o.x},${o.y}`));
      for (const t of m.tiles) {
        const size = t.kind === 'camp' ? 2 : 1;
        for (let dx = 0; dx < size; dx++)
          for (let dy = 0; dy < size; dy++) {
            expect(obs.has(`${t.x + dx},${t.y + dy}`)).toBe(false);
            expect(t.x + dx >= 0 && t.x + dx < m.w && t.y + dy >= 0 && t.y + dy < m.h).toBe(true);
          }
        if (t.kind === 'bonus') expect(t.suit).toBeDefined();
      }
      for (let team = 0; team < m.teams; team++) expect(m.tiles.filter((t) => t.kind === 'camp' && t.owner === team).length).toBe(1);
      expect(m.teams).toBeLessThanOrEqual(4);
      expect(m.tiles.some((t) => t.suit === 'heart')).toBe(true);
    }
  });
});

describe('progression', () => {
  it('une victoire débloque la carte suivante et se sauvegarde', () => {
    const store = new Map<string, string>();
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    let p = loadProgress(fake);
    expect(p.unlocked).toBe(1);
    p = recordWin(p, MAPS[0].id, 0, MAPS.length);
    expect(p.unlocked).toBe(2);
    expect(p.wins[MAPS[0].id]).toBe(1);
    saveProgress(p, fake);
    const again = loadProgress(fake);
    expect(again.unlocked).toBe(2);
    const last = recordWin(again, MAPS[MAPS.length - 1].id, MAPS.length - 1, MAPS.length);
    expect(last.unlocked).toBe(MAPS.length);
  });
});
