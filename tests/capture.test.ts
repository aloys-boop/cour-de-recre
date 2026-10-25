import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config';
import { Tile, updateCapture } from '../src/core/tile';
import { NO_TEAM } from '../src/core/types';

function run(tile: Tile, presence: number[], seconds: number, step = 1 / 60) {
  let ev = null;
  for (let t = 0; t < seconds; t += step) {
    const e = updateCapture(tile, presence, step);
    if (e) ev = e;
  }
  return ev;
}

describe('capture des cases', () => {
  it('une équipe seule capture une case neutre après quelques secondes', () => {
    const tile = new Tile({ x: 0, y: 0, suit: 'spade' });
    const ev = run(tile, [1, 0], TUNING.captureSeconds + 0.1);
    expect(tile.owner).toBe(0);
    expect(ev).toEqual({ kind: 'captured', team: 0 });
    expect(tile.cap).toBe(0);
    expect(tile.capTeam).toBe(NO_TEAM);
  });

  it('plusieurs élèves capturent plus vite (plafonné à 2×)', () => {
    const solo = new Tile({ x: 0, y: 0, suit: 'heart' });
    const group = new Tile({ x: 0, y: 0, suit: 'heart' });
    run(solo, [1, 0], 1.0);
    run(group, [9, 0], 1.0);
    expect(group.cap).toBeGreaterThan(solo.cap);
    expect(group.cap).toBeLessThan(solo.cap * 2.05); // jamais plus de 2× plus vite
    run(solo, [1, 0], 0.55);
    run(group, [9, 0], 0.55);
    expect(group.owner).toBe(0); // 2× plus vite : 1,55 s suffisent
    expect(solo.owner).toBe(NO_TEAM);
  });

  it('une case occupée par deux équipes est contestée et ne bouge pas', () => {
    const tile = new Tile({ x: 0, y: 0, suit: 'club' });
    run(tile, [1, 0], 1);
    const before = tile.cap;
    run(tile, [1, 1], 2);
    expect(tile.contested).toBe(true);
    expect(tile.cap).toBe(before);
    expect(tile.owner).toBe(NO_TEAM);
  });

  it('le propriétaire présent seul efface la jauge adverse', () => {
    const tile = new Tile({ x: 0, y: 0, suit: 'diamond', owner: 1 });
    run(tile, [1, 0], 1.5);
    expect(tile.capTeam).toBe(0);
    expect(tile.cap).toBeGreaterThan(0);
    run(tile, [0, 1], 2);
    expect(tile.capTeam).toBe(NO_TEAM);
    expect(tile.cap).toBe(0);
    expect(tile.owner).toBe(1);
  });

  it('un attaquant doit d’abord vider la jauge d’une autre équipe', () => {
    const tile = new Tile({ x: 0, y: 0, suit: 'spade' });
    run(tile, [1, 0], 1.5); // équipe 0 à mi-chemin
    const halfway = tile.cap;
    run(tile, [0, 1], 1.0); // équipe 1 arrive : elle vide d'abord
    expect(tile.capTeam === 0 ? tile.cap < halfway : tile.capTeam === 1).toBe(true);
    run(tile, [0, 1], 4);
    expect(tile.owner).toBe(1);
  });

  it('une jauge abandonnée se vide lentement', () => {
    const tile = new Tile({ x: 0, y: 0, suit: 'spade' });
    run(tile, [1, 0], 1.5);
    const c = tile.cap;
    run(tile, [0, 0], 1);
    expect(tile.cap).toBeLessThan(c);
    run(tile, [0, 0], 30);
    expect(tile.cap).toBe(0);
    expect(tile.capTeam).toBe(NO_TEAM);
  });

  it('une case reprise change de propriétaire et relance sa minuterie', () => {
    const tile = new Tile({ x: 0, y: 0, suit: 'spade', owner: 0 });
    tile.spawnTimer = 4;
    run(tile, [0, 2], 5);
    expect(tile.owner).toBe(1);
    expect(tile.spawnTimer).toBe(0);
  });
});
