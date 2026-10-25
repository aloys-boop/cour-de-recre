import { describe, expect, it } from 'vitest';
import { endStats, formatDuration, GameStats } from '../src/core/stats';
import { loadProgress, saveProgress } from '../src/core/save';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'stats',
  name: 'Stats',
  w: 8,
  h: 8,
  teams: 2,
  unitCap: 10,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 6, y: 6, owner: 1 },
    { kind: 'bonus', x: 3, y: 3, suit: 'heart' },
  ],
};

function fakeStore() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('statistiques de partie', () => {
  it('compte les élèves produits, les KO infligés et subis, les cases prises', () => {
    const s = new GameStats(3);
    s.recordAll([
      { kind: 'spawn', x: 0, y: 0, team: 0 },
      { kind: 'spawn', x: 0, y: 0, team: 0 },
      { kind: 'spawn', x: 0, y: 0, team: 2 },
      { kind: 'punch', x: 0, y: 0, team: 1 },
      { kind: 'hit', x: 0, y: 0, team: 0 },
      { kind: 'ko', x: 0, y: 0, team: 0, by: 1 },
      { kind: 'ko', x: 0, y: 0, team: 2, by: 1 },
      { kind: 'ko', x: 0, y: 0, team: 1 }, // auteur inconnu : seul le KO subi compte
      { kind: 'captured', x: 0, y: 0, team: 1, camp: false },
      { kind: 'captured', x: 0, y: 0, team: 1, camp: true },
    ]);
    expect(s.teams.map((t) => t.produced)).toEqual([2, 0, 1]);
    expect(s.teams.map((t) => t.koDealt)).toEqual([0, 2, 0]);
    expect(s.teams.map((t) => t.koTaken)).toEqual([1, 1, 1]);
    expect(s.teams.map((t) => t.captured)).toEqual([0, 2, 0]);
  });

  it('ignore les équipes hors limites', () => {
    const s = new GameStats(2);
    s.record({ kind: 'spawn', x: 0, y: 0, team: 5 });
    s.record({ kind: 'captured', x: 0, y: 0, team: -1, camp: false });
    expect(s.teams.every((t) => t.produced === 0 && t.captured === 0)).toBe(true);
  });

  it('se remplit à partir des vrais événements du monde (combat, capture, apparition)', () => {
    const w = new World(ARENA, 2, 7);
    const stats = new GameStats();
    const a = w.spawnUnit(0, 4, 4);
    const b = w.spawnUnit(1, 4.3, 4);
    b.hp = 5; // KO au premier coup
    let kos = 0;
    for (let i = 0; i < 60 * 4; i++) {
      w.update(1 / 60);
      for (const ev of w.drainEvents()) {
        if (ev.kind === 'ko') kos++;
        stats.record(ev);
      }
    }
    expect(a.alive).toBe(true);
    expect(kos).toBe(1);
    expect(stats.teams[0].produced).toBe(1);
    expect(stats.teams[1].produced).toBe(1);
    expect(stats.teams[0].koDealt).toBe(1);
    expect(stats.teams[1].koTaken).toBe(1);
    expect(stats.teams[0].koTaken).toBe(0);
    // L'élève restant tient la case cœur : capture.
    w.orderMove([a], { x: 3.5, y: 3.5 });
    for (let i = 0; i < 60 * 8; i++) {
      w.update(1 / 60);
      stats.recordAll(w.drainEvents());
    }
    expect(stats.teams[0].captured).toBe(1);

    const end = endStats(stats, w, 0);
    expect(end.rows.length).toBe(2);
    expect(end.rows[0].isPlayer).toBe(true);
    expect(end.rows[1].isPlayer).toBe(false);
    expect(end.rows[0].koDealt).toBe(1);
    expect(end.duration).toBeCloseTo(w.time);
  });

  it('formate la durée en français', () => {
    expect(formatDuration(42.7)).toBe('42 s');
    expect(formatDuration(185)).toBe('3 min 05 s');
    expect(formatDuration(-3)).toBe('0 s');
  });
});

describe('réglage de la musique', () => {
  it('est actif par défaut et pour une ancienne sauvegarde sans le champ', () => {
    expect(loadProgress(fakeStore()).musicMuted).toBe(false);
    const old = fakeStore();
    old.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 3, wins: { a: 1 }, muted: true, lastTeam: 2, lastDifficulty: 'facile' }));
    const p = loadProgress(old);
    expect(p.musicMuted).toBe(false);
    expect(p.unlocked).toBe(3);
    expect(p.muted).toBe(true);
  });

  it('est sauvegardé et relu, indépendamment du son général', () => {
    const store = fakeStore();
    const p = loadProgress(store);
    saveProgress({ ...p, musicMuted: true }, store);
    const again = loadProgress(store);
    expect(again.musicMuted).toBe(true);
    expect(again.muted).toBe(false);
    saveProgress({ ...again, musicMuted: false, muted: true }, store);
    const third = loadProgress(store);
    expect(third.musicMuted).toBe(false);
    expect(third.muted).toBe(true);
  });

  it('une valeur invalide est traitée comme « musique active »', () => {
    const store = fakeStore();
    store.setItem('cour-de-recre.v2', JSON.stringify({ musicMuted: 0 }));
    expect(loadProgress(store).musicMuted).toBe(false);
  });
});
