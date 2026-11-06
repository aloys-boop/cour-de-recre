// v5.6 : demandes d'Aloys du 05/11 (tap hors carte, ruptures annoncées 30 s, mode Équipes).
import { describe, expect, it } from 'vitest';
import { BETRAYAL, DIPLOMACY } from '../src/config';
import { TeamAi } from '../src/core/ai';
import { BREAK_REMINDER, Diplomacy, diploMessage } from '../src/core/diplomacy';
import { Grid } from '../src/core/grid';
import { generateMap } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';
import { teamGroups, teamSizeFits, teamsLabel } from '../src/core/teams';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'arene',
  name: 'Arène',
  w: 10,
  h: 10,
  teams: 3,
  unitCap: 10,
  spawnInterval: 1000,
  startUnits: 2,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 8, y: 8, owner: 1 },
    { kind: 'camp', x: 0, y: 8, owner: 2 },
  ],
};

function run(w: World, d: Diplomacy, seconds: number, ais: TeamAi[] = []): void {
  const step = 1 / 20;
  for (let t = 0; t < seconds; t += step) {
    for (const a of ais) a.update(step);
    w.update(step);
    d.update(step);
  }
}

describe('tap hors de la carte : point ramené au bord', () => {
  const g = new Grid(10, 8, [{ x: 0, y: 4 }]);
  it('hors de la cour : bord ou coin le plus proche', () => {
    expect(g.orderPoint({ x: 5, y: -3 })).toEqual({ x: 5, y: 0.3 });
    expect(g.orderPoint({ x: 14, y: 3 })).toEqual({ x: 9.7, y: 3 });
    expect(g.orderPoint({ x: -4, y: -4 })).toEqual({ x: 0.3, y: 0.3 });
    expect(g.orderPoint({ x: 30, y: 30 })).toEqual({ x: 9.7, y: 7.7 });
  });
  it('dans la cour, inchangé ; sur un obstacle (même au bord) : cellule libre voisine', () => {
    expect(g.orderPoint({ x: 3.2, y: 2.6 })).toEqual({ x: 3.2, y: 2.6 });
    const p = g.orderPoint({ x: -2, y: 4.5 });
    expect(g.walkable(p.x, p.y)).toBe(true);
    expect(Math.hypot(p.x - 0.5, p.y - 4.5)).toBeLessThanOrEqual(1.5);
  });
});

describe('ruptures : préavis de 30 s et trahison de fin de partie plus rare', () => {
  it('la rupture prend effet 30 s après l’annonce, avec un rappel à 10 s', () => {
    expect(DIPLOMACY.breakNotice).toBe(30);
    const w = new World(ARENA, 3, 1);
    const d = new Diplomacy(w, 'normal', [], 1);
    w.setAllied(0, 1, true);
    d['lastChange'][0][1] = d['lastChange'][1][0] = -1000;
    expect(d.requestBreak(1, 0)).toBe('ok');
    expect(d.breakingIn(0, 1)).toBeCloseTo(30, 5);
    const warn = d.drainEvents()[0];
    expect(diploMessage(warn, 0, w.teamColors)!.text).toMatch(/dans 30 s/);
    run(w, d, 19);
    expect(d.drainEvents()).toEqual([]);
    expect(w.isAllied(0, 1)).toBe(true);
    run(w, d, 2);
    const soon = d.drainEvents();
    expect(soon).toEqual([{ kind: 'soon', team: 1, other: 0 }]);
    expect(diploMessage(soon[0], 0, w.teamColors)!.text).toMatch(new RegExp(`${BREAK_REMINDER} s`));
    run(w, d, 9.5);
    expect(w.isAllied(0, 1)).toBe(false);
    expect(d.drainEvents().map((e) => e.kind)).toEqual(['broken']);
  });
  it('fin de partie : trahison bien moins probable en Facile et Normal', () => {
    expect(BETRAYAL.facile.endgameChance).toBeLessThanOrEqual(0.05);
    expect(BETRAYAL.normal.endgameChance).toBeLessThanOrEqual(0.1);
    expect(BETRAYAL.facile.endgameChance).toBeLessThan(BETRAYAL.normal.endgameChance);
    expect(BETRAYAL.normal.endgameChance).toBeLessThan(BETRAYAL.difficile.endgameChance);
    expect(BETRAYAL.difficile.endgameChance).toBeLessThan(BETRAYAL.expert.endgameChance);
  });
});

describe('mode Équipes', () => {
  it('tailles possibles et libellés', () => {
    expect(teamSizeFits(4, 2)).toBe(true);
    expect(teamSizeFits(4, 4)).toBe(false);
    expect(teamSizeFits(5, 2)).toBe(false);
    expect(teamsLabel(6, 2)).toBe('2 contre 2 contre 2');
    expect(teamsLabel(8, 4)).toBe('4 contre 4');
    expect(teamsLabel(3, 2)).toBeNull();
  });

  it('coéquipiers voisins : jamais le camp d’en face à 4 équipes, paires voisines à 8', () => {
    const m4 = generateMap(skirmishLevel({ teams: 4, size: 1, tiles: 12 }), 3);
    const g4 = teamGroups(m4, 2)!;
    expect(g4[0]).toBe(0);
    expect(g4[1]).not.toBe(0); // l'équipe 1 est en face (est)
    expect(g4.filter((g) => g === 0)).toHaveLength(2);
    const m8 = generateMap(skirmishLevel({ teams: 8, size: 2, tiles: 12 }), 3);
    const g8 = teamGroups(m8, 2)!;
    const camps = m8.tiles.filter((t) => t.kind === 'camp');
    for (let gi = 0; gi < 4; gi++) {
      const [a, b] = camps.filter((c) => g8[c.owner!] === gi);
      // Deux camps voisins sur le tour de la cour : au plus un demi-côté d'écart.
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(m8.w / 2 + 1);
    }
    expect(teamGroups(generateMap(skirmishLevel({ teams: 6, size: 1, tiles: 12 }), 3), 3)!.filter((g) => g === 0)).toHaveLength(3);
    expect(teamGroups(m4, 3)).toBeNull();
  });

  it('alliances verrouillées : alliés dès le départ, ni proposition ni rupture, même par les IA', () => {
    const map = generateMap(skirmishLevel({ teams: 4, size: 0, tiles: 6 }), 5);
    const groups = teamGroups(map, 2)!;
    const w = new World(map, 4, 5);
    const ais = [1, 2, 3].map((t) => new TeamAi(w, t, 'expert'));
    const d = new Diplomacy(w, 'expert', [1, 2, 3], 5, groups);
    const mate = groups.findIndex((g, t) => t > 0 && g === 0);
    const foe = groups.findIndex((g) => g !== 0);
    expect(w.isAllied(0, mate)).toBe(true);
    expect(w.isAllied(0, foe)).toBe(false);
    expect(d.view(0, mate).locked).toBe(true);
    expect(d.propose(0, foe)).toBe('equipes');
    expect(d.requestBreak(0, mate)).toBe('equipes');
    const before = JSON.stringify(w.allied);
    run(w, d, 150, ais);
    expect(JSON.stringify(w.allied)).toBe(before);
    expect(d.drainEvents()).toEqual([]);
  });

  it('victoire partagée : quand seuls les coéquipiers restent, ils gagnent ensemble', () => {
    const map = generateMap(skirmishLevel({ teams: 4, size: 0, tiles: 6 }), 5);
    const groups = teamGroups(map, 2)!;
    const w = new World(map, 4, 5);
    new Diplomacy(w, 'normal', [1, 2, 3], 5, groups);
    const mate = groups.findIndex((g, t) => t > 0 && g === 0);
    for (const u of w.units) if (groups[u.team] !== 0) u.hp = 0;
    for (const t of w.tiles) if (t.isCamp && groups[t.owner] !== 0) t.owner = 0;
    expect(w.victors()).toEqual([0, mate].sort((a, b) => a - b));
  });
});

describe('« Comment jouer » à jour (v5.6)', () => {
  it('explique le préavis de 30 s, le mode Équipes, l’abandon et le tap hors de la cour', async () => {
    const { HOW_TO } = await import('../src/ui/overlay');
    const get = (t: string) => HOW_TO.find(([k]) => k === t)?.[1] ?? '';
    expect(get('Alliances')).toMatch(/30 s/);
    expect(get('Mode Équipes')).toMatch(/2 contre 2/);
    expect(get('Abandonner')).toMatch(/statistiques/);
    expect(get('Déplacer et attaquer')).toMatch(/hors de la cour/);
  });
});
