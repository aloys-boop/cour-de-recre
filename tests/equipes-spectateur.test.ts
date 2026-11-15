// v5.16 : Mode Équipes, suite. Un joueur éliminé dont les coéquipiers tiennent encore reste
// spectateur jusqu'au bout et partage la victoire de son équipe.
import { describe, expect, it } from 'vitest';
import { Diplomacy } from '../src/core/diplomacy';
import { generateMap } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';
import { endCheck, spectateFocus, teammatesOf } from '../src/core/spectate';
import { teamGroups } from '../src/core/teams';
import { World } from '../src/core/world';

describe('fin de partie vue par le joueur', () => {
  const groups = [0, 1, 0, 1]; // 0 et 2 contre 1 et 3

  it('coéquipiers : seulement ceux du même groupe, aucun en partie libre', () => {
    expect(teammatesOf(groups, 0)).toEqual([2]);
    expect(teammatesOf(groups, 3)).toEqual([1]);
    expect(teammatesOf(null, 0)).toEqual([]);
  });

  it('en vie, sans vainqueur : la partie continue', () => {
    expect(endCheck([], [true, true, true, true], 0, groups)).toEqual({ kind: 'running' });
  });

  it('éliminé, un coéquipier debout : spectateur (et pas défaite)', () => {
    expect(endCheck([], [false, true, true, true], 0, groups)).toEqual({ kind: 'spectate' });
  });

  it('éliminé, plus aucun coéquipier : défaite', () => {
    expect(endCheck([], [false, true, false, true], 0, groups)).toEqual({ kind: 'over', result: 'defaite', shared: false });
  });

  it('éliminé, mon coéquipier gagne : victoire partagée', () => {
    expect(endCheck([2], [false, false, true, false], 0, groups)).toEqual({ kind: 'over', result: 'victoire', shared: true });
  });

  it('éliminé, les adversaires gagnent : défaite', () => {
    expect(endCheck([1, 3], [false, true, false, true], 0, groups)).toEqual({ kind: 'over', result: 'defaite', shared: false });
  });

  it('en vie et vainqueur avec mon coéquipier : victoire normale', () => {
    expect(endCheck([0, 2], [true, false, true, false], 0, groups)).toEqual({ kind: 'over', result: 'victoire', shared: false });
  });

  it('partie libre : éliminé, c’est perdu même si un allié de circonstance tient', () => {
    expect(endCheck([], [false, true, true, true], 0, null)).toEqual({ kind: 'over', result: 'defaite', shared: false });
    expect(endCheck([2], [false, false, true, false], 0, null)).toEqual({ kind: 'over', result: 'defaite', shared: false });
  });
});

/** Élève mis KO (à terre, ne compte plus). */
function ko(u: { hp: number; state: string }): void {
  u.hp = 0;
  u.state = 'ko';
}

describe('dans une vraie cour', () => {
  function teamWorld() {
    const map = generateMap(skirmishLevel({ teams: 4, size: 0, tiles: 6 }), 5);
    const groups = teamGroups(map, 2)!;
    const w = new World(map, 4, 5);
    new Diplomacy(w, 'normal', [1, 2, 3], 5, groups);
    const mate = groups.findIndex((g, t) => t > 0 && g === 0);
    const foe = groups.findIndex((g) => g !== 0);
    return { w, groups, mate, foe };
  }

  it('joueur KO (élèves à terre, camps perdus) : spectateur ; puis ses coéquipiers gagnent pour lui', () => {
    const { w, groups, mate, foe } = teamWorld();
    for (const u of w.units) if (u.team === 0) ko(u);
    for (const t of w.tiles) if (t.isCamp && t.owner === 0) t.owner = foe;
    const alive = () => w.stats().map((s) => s.alive);
    expect(endCheck(w.victors(), alive(), 0, groups).kind).toBe('spectate');
    // Les adversaires tombent : seul le coéquipier reste, il prend tous les camps.
    for (const u of w.units) if (groups[u.team] !== 0) ko(u);
    for (const t of w.tiles) if (t.isCamp) t.owner = mate;
    expect(w.victors()).toEqual([mate]);
    expect(endCheck(w.victors(), alive(), 0, groups)).toEqual({ kind: 'over', result: 'victoire', shared: true });
  });

  it('la caméra du spectateur vise le plus gros paquet du coéquipier, puis son camp', () => {
    const { w, groups, mate } = teamWorld();
    const mine = w.units.filter((u) => u.team === mate && u.alive);
    expect(mine.length).toBeGreaterThan(2);
    // Un paquet serré loin de tout, et un élève isolé.
    mine.forEach((u, i) => {
      u.x = i === 0 ? 1 : 6 + (i % 2) * 0.4;
      u.y = i === 0 ? 1 : 6 + (i % 3) * 0.3;
    });
    const f = spectateFocus(w, groups, 0)!;
    expect(f.team).toBe(mate);
    expect(f.at.x).toBeGreaterThan(5.8);
    expect(f.at.y).toBeGreaterThan(5.8);
    for (const u of mine) ko(u);
    const camp = w.tiles.find((c) => c.isCamp && c.owner === mate)!;
    expect(spectateFocus(w, groups, 0)!.at).toEqual({ x: camp.cx, y: camp.cy });
    expect(spectateFocus(w, null, 0)).toBeNull();
  });
});

describe('« Comment jouer » à jour (v5.16)', () => {
  it('explique le spectateur et la victoire partagée', async () => {
    const { HOW_TO } = await import('../src/ui/overlay');
    const text = HOW_TO.find(([k]) => k === 'Mode Équipes')?.[1] ?? '';
    expect(text).toMatch(/spectateur/);
    expect(text).toMatch(/Regarder/);
    expect(text).toMatch(/×2/);
    expect(text).toMatch(/victoire est aussi la tienne/);
  });
});
