import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/core/maps';
import { loadProgress, recordWin, saveProgress } from '../src/core/save';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const SMALL: MapDef = {
  id: 'small',
  name: 'Petit',
  w: 6,
  h: 6,
  teams: 3,
  unitCap: 5,
  spawnInterval: 2,
  startUnits: 2,
  tiles: [
    { x: 0, y: 0, suit: 'spade', owner: 0 },
    { x: 5, y: 5, suit: 'heart', owner: 1 },
    { x: 0, y: 5, suit: 'club', owner: 2 },
    { x: 3, y: 3, suit: 'diamond' },
  ],
};

describe('conditions de victoire', () => {
  it('pas de gagnant au départ', () => {
    const w = new World(SMALL, 3, 1);
    expect(w.winner()).toBe(NO_TEAM);
    const s = w.stats();
    expect(s.map((x) => x.units)).toEqual([2, 2, 2]);
    expect(s.map((x) => x.tiles)).toEqual([1, 1, 1]);
  });

  it('une équipe qui possède toutes les cases gagne', () => {
    const w = new World(SMALL, 3, 1);
    for (const t of w.tiles) t.owner = 1;
    expect(w.winner()).toBe(1);
  });

  it('la dernière équipe encore en vie gagne même sans toutes les cases', () => {
    const w = new World(SMALL, 3, 1);
    for (const u of w.units) if (u.team !== 2) u.takeDamage(1000, u.x, u.y);
    for (const t of w.tiles) if (t.owner !== 2) t.owner = NO_TEAM;
    expect(w.winner()).toBe(2);
  });

  it('une équipe sans élèves ni cases est éliminée, mais pas celle qui garde une case', () => {
    const w = new World(SMALL, 3, 1);
    for (const u of w.units) if (u.team === 0) u.takeDamage(1000, u.x, u.y);
    w.tiles[0].owner = 1;
    const s = w.stats();
    expect(s[0].alive).toBe(false);
    expect(s[1].alive).toBe(true);
    expect(w.winner()).toBe(NO_TEAM); // il reste deux équipes
  });

  it('les cases possédées font apparaître des élèves jusqu’au plafond', () => {
    const w = new World(SMALL, 3, 1);
    const step = 1 / 60;
    for (let t = 0; t < 30; t += step) w.update(step);
    for (let team = 0; team < 3; team++) expect(w.teamUnitCount(team)).toBeLessThanOrEqual(SMALL.unitCap);
    expect(w.units.length).toBeGreaterThan(6);
  });
});

describe('cartes', () => {
  it('au moins cinq cartes, de taille croissante, sans case sur un obstacle', () => {
    expect(MAPS.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < MAPS.length; i++) expect(MAPS[i].w * MAPS[i].h).toBeGreaterThan(MAPS[i - 1].w * MAPS[i - 1].h);
    for (const m of MAPS) {
      const obs = new Set((m.obstacles ?? []).map((o) => `${o.x},${o.y}`));
      for (const t of m.tiles) {
        expect(obs.has(`${t.x},${t.y}`)).toBe(false);
        expect(t.x >= 0 && t.x < m.w && t.y >= 0 && t.y < m.h).toBe(true);
      }
      // Chaque équipe a une case de départ.
      for (let team = 0; team < m.teams; team++) expect(m.tiles.some((t) => t.owner === team)).toBe(true);
      expect(m.teams).toBeLessThanOrEqual(4);
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
    // Gagner la dernière carte ne dépasse pas le nombre de cartes.
    const last = recordWin(again, MAPS[MAPS.length - 1].id, MAPS.length - 1, MAPS.length);
    expect(last.unlocked).toBe(MAPS.length);
  });
});
