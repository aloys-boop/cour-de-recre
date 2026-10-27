import { describe, expect, it } from 'vitest';
import { DIPLOMACY, TEAM_COLORS, TEAM_NAMES, TEAM_PROFILES } from '../src/config';
import { TeamAi } from '../src/core/ai';
import { Diplomacy, diploMessage } from '../src/core/diplomacy';
import { decodeMapCode, encodeMapCode, mapForCode, type MapSpec } from '../src/core/mapcode';
import { campCorners, generateMap, LEVELS, TOTAL_UNIT_BUDGET } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';
import { Tile, updateCapture } from '../src/core/tile';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'arene',
  name: 'Arène',
  w: 10,
  h: 10,
  teams: 3,
  unitCap: 10,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 8, y: 8, owner: 1 },
    { kind: 'camp', x: 0, y: 8, owner: 2 },
    { kind: 'bonus', x: 5, y: 5, suit: 'heart' },
  ],
};

function tick(world: World, seconds: number, extra?: (dt: number) => void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    extra?.(step);
    world.update(step);
  }
}

describe('alliances : combat et déplacements', () => {
  it('deux alliés au contact ne se frappent pas, et un ordre d’attaque sur un allié est ignoré', () => {
    const w = new World(ARENA, 3, 5);
    w.setAllied(0, 1, true);
    const a = w.spawnUnit(0, 4, 4);
    const b = w.spawnUnit(1, 4.3, 4);
    w.orderAttack([a], b.id);
    expect(a.order.kind).toBe('none');
    tick(w, 4);
    expect(a.hp).toBe(a.maxHp);
    expect(b.hp).toBe(b.maxHp);
    expect(w.drainEvents().some((e) => e.kind === 'punch' || e.kind === 'hit')).toBe(false);
  });

  it('une alliance conclue en plein combat arrête les coups', () => {
    const w = new World(ARENA, 3, 5);
    const a = w.spawnUnit(0, 4, 4);
    const b = w.spawnUnit(1, 4.3, 4);
    tick(w, 1);
    expect(a.hp + b.hp).toBeLessThan(a.maxHp + b.maxHp);
    w.setAllied(1, 0, true);
    expect(w.isAllied(0, 1)).toBe(true);
    const hp = [a.hp, b.hp];
    tick(w, 0.4); // un coup déjà armé peut encore partir… mais ne porte pas
    tick(w, 3);
    expect([a.hp, b.hp]).toEqual(hp);
    // Rupture : le combat reprend.
    w.setAllied(0, 1, false);
    tick(w, 2);
    expect(a.hp + b.hp).toBeLessThan(hp[0] + hp[1]);
  });

  it('des alliés se traversent sans se repousser (les ennemis, si)', () => {
    const w = new World(ARENA, 3, 5);
    w.setAllied(0, 1, true);
    const a = w.spawnUnit(0, 4, 4);
    const b = w.spawnUnit(1, 4.05, 4);
    w.update(1 / 60);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(0.05, 5);
    const w2 = new World(ARENA, 3, 5);
    const c = w2.spawnUnit(0, 4, 4);
    const d = w2.spawnUnit(2, 4.05, 4);
    w2.update(1 / 60);
    expect(Math.hypot(c.x - d.x, c.y - d.y)).toBeGreaterThan(0.05);
  });

  it('les élèves alliés n’engagent pas le combat d’eux-mêmes, mais un ennemi commun, si', () => {
    const w = new World(ARENA, 3, 5);
    w.setAllied(0, 1, true);
    const a = w.spawnUnit(0, 4, 4);
    w.spawnUnit(1, 5, 4);
    tick(w, 0.5);
    expect(a.engagedId).toBe(-1);
    const e = w.spawnUnit(2, 5, 5);
    tick(w, 0.6);
    expect(a.engagedId).toBe(e.id);
  });
});

describe('alliances : cases', () => {
  const allied01 = (a: number, b: number) => a === b || (a + b === 1 && a !== b);

  it('des alliés sur une même case ne la contestent pas : la plus nombreuse capture', () => {
    const t = new Tile({ kind: 'bonus', x: 0, y: 0, suit: 'club' });
    let ev = null;
    for (let i = 0; i < 400 && !ev; i++) ev = updateCapture(t, [1, 3, 0], 1 / 60, allied01);
    expect(t.contested).toBe(false);
    expect(ev).toEqual({ kind: 'captured', team: 1 });
    // Sans alliance, la même présence est contestée.
    const u = new Tile({ kind: 'bonus', x: 0, y: 0, suit: 'club' });
    updateCapture(u, [1, 3, 0], 1 / 60);
    expect(u.contested).toBe(true);
    // Un non-allié présent : contestée.
    const v = new Tile({ kind: 'bonus', x: 0, y: 0, suit: 'club' });
    updateCapture(v, [1, 3, 1], 1 / 60, allied01);
    expect(v.contested).toBe(true);
  });

  it('celle qui capturait déjà garde la main, même moins nombreuse', () => {
    const t = new Tile({ kind: 'bonus', x: 0, y: 0, suit: 'club' });
    updateCapture(t, [1, 0, 0], 0.5, allied01);
    expect(t.capTeam).toBe(0);
    let ev = null;
    for (let i = 0; i < 400 && !ev; i++) ev = updateCapture(t, [1, 4, 0], 1 / 60, allied01);
    expect(ev).toEqual({ kind: 'captured', team: 0 });
  });

  it('un allié ne prend jamais la case d’un allié, et efface la jauge d’un ennemi', () => {
    const t = new Tile({ kind: 'bonus', x: 0, y: 0, suit: 'club', owner: 0 });
    t.capTeam = 2;
    t.cap = 0.5;
    for (let i = 0; i < 60 * 20; i++) expect(updateCapture(t, [0, 5, 0], 1 / 60, allied01)).toBeNull();
    expect(t.owner).toBe(0);
    expect(t.capTeam).toBe(NO_TEAM);
    expect(t.cap).toBe(0);
  });

  it('dans le monde : un allié posté sur le camp d’un allié ne le prend pas', () => {
    const w = new World(ARENA, 3, 5);
    w.setAllied(0, 1, true);
    for (let i = 0; i < 4; i++) w.spawnUnit(1, 1 + (i % 2) * 0.3, 1 + (i >> 1) * 0.3);
    tick(w, 15);
    const camp0 = w.tiles.find((t) => t.isCamp && t.x === 0 && t.y === 0)!;
    expect(camp0.owner).toBe(0);
    expect(camp0.contested).toBe(false);
  });
});

describe('alliances : victoire', () => {
  it('toutes les équipes encore en vie alliées : l’alliance gagne ensemble', () => {
    const w = new World(ARENA, 3, 5);
    w.spawnUnit(0, 3, 3);
    w.spawnUnit(1, 6, 6);
    w.spawnUnit(2, 2, 7);
    w.setAllied(0, 1, true);
    expect(w.victors()).toEqual([]);
    // L'équipe 2 est éliminée (plus d'élèves ni de camp).
    for (const u of w.units) if (u.team === 2) u.takeDamage(1000, 0, 0);
    w.tiles.find((t) => t.isCamp && t.owner === 2)!.owner = 0;
    tick(w, 2);
    expect(w.victors()).toEqual([0, 1]);
    expect(w.winner()).toBe(NO_TEAM); // pas de gagnant seul
    // Sans l'alliance, il reste deux ennemis : la partie continue.
    w.setAllied(0, 1, false);
    expect(w.victors()).toEqual([]);
  });

  it('une alliance qui tient tous les camps gagne', () => {
    const w = new World(ARENA, 3, 5);
    w.spawnUnit(2, 2, 7);
    w.setAllied(0, 1, true);
    w.tiles.find((t) => t.isCamp && t.owner === 2)!.owner = 1;
    expect(w.victors()).toEqual([0, 1]);
  });
});

describe('diplomatie', () => {
  function setup(teams = 3) {
    const w = new World(ARENA, teams, 5);
    for (let t = 0; t < teams; t++) for (let i = 0; i < 4; i++) w.spawnUnit(t, 2 + t * 2 + i * 0.2, 5);
    const d = new Diplomacy(w, 'difficile', [1, 2].slice(0, teams - 1), 3);
    return { w, d };
  }

  it('l’IA répond tout de suite, et la réponse est annoncée en français', () => {
    const { w, d } = setup();
    expect(d.propose(0, 1)).toBe('accepte');
    expect(w.isAllied(0, 1)).toBe(true);
    const ev = d.drainEvents();
    expect(ev).toEqual([{ kind: 'reply', from: 0, to: 1, accepted: true }]);
    expect(diploMessage(ev[0], 0, [0, 1, 2])!.text).toBe('Les Verts acceptent l’alliance.');
    expect(diploMessage({ kind: 'reply', from: 0, to: 2, accepted: false }, 0, [0, 1, 2])!.text).toBe('Les Jaunes refusent.');
  });

  it('refuse une alliance qui finirait la partie (il ne resterait que des alliés)', () => {
    const { w, d } = setup(2);
    expect(d.propose(0, 1)).toBe('refuse');
    expect(w.isAllied(0, 1)).toBe(false);
  });

  it('refuse un proposeur bien plus fort, sauf menace commune', () => {
    const { w, d } = setup();
    for (let i = 0; i < 8; i++) w.spawnUnit(0, 2, 6);
    expect(d.propose(0, 1)).toBe('refuse');
    // L'équipe 2 devient écrasante : menace commune, l'équipe 1 accepte.
    for (let i = 0; i < 40; i++) w.spawnUnit(2, 6, 2);
    expect(d.propose(0, 1)).toBe('accepte');
  });

  it('une rupture est annoncée 5 s à l’avance puis prend effet ; délai de 30 s par paire', () => {
    const { w, d } = setup();
    expect(d.propose(0, 1)).toBe('accepte');
    d.drainEvents();
    expect(d.requestBreak(1, 0)).toBe('trop-tot'); // l'alliance vient d'être conclue
    tick(w, DIPLOMACY.pairCooldown + 0.1, (dt) => d.update(dt));
    expect(d.requestBreak(1, 0)).toBe('ok');
    const warn = d.drainEvents().find((e) => e.kind === 'warn')!;
    expect(warn).toMatchObject({ kind: 'warn', team: 1, other: 0 });
    expect(diploMessage(warn, 0, [0, 1, 2])!.text).toBe('Les Verts vont rompre l’alliance dans 5 s !');
    expect(d.view(0, 1).breakingIn).toBeCloseTo(DIPLOMACY.breakNotice, 3);
    tick(w, DIPLOMACY.breakNotice - 0.2, (dt) => d.update(dt));
    expect(w.isAllied(0, 1)).toBe(true);
    tick(w, 0.4, (dt) => d.update(dt));
    expect(w.isAllied(0, 1)).toBe(false);
    const broken = d.drainEvents().find((e) => e.kind === 'broken')!;
    expect(broken).toEqual({ kind: 'broken', team: 1, other: 0 });
    expect(diploMessage(broken, 0, [0, 1, 2])!.text).toBe('Les Verts ont rompu l’alliance !');
    // Nouvelle proposition trop tôt après le changement.
    expect(d.propose(0, 1)).toBe('trop-tot');
  });

  it('une IA trahie par le joueur refuse ensuite ses propositions', () => {
    const { w, d } = setup();
    expect(d.propose(0, 1)).toBe('accepte');
    tick(w, DIPLOMACY.pairCooldown + 0.1, (dt) => d.update(dt));
    expect(d.requestBreak(0, 1)).toBe('ok');
    tick(w, DIPLOMACY.breakNotice + DIPLOMACY.pairCooldown + 0.5, (dt) => d.update(dt));
    expect(w.isAllied(0, 1)).toBe(false);
    expect(d.propose(0, 1)).toBe('refuse');
  });

  it('une IA rompt quand l’ennemi commun est presque éliminé (plus souvent en Expert, l’ancien Difficile)', () => {
    const counts: Record<string, number> = {};
    for (const diff of ['facile', 'expert'] as const) {
      counts[diff] = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const w = new World(ARENA, 3, seed);
        for (let i = 0; i < 6; i++) w.spawnUnit(1, 6, 6), w.spawnUnit(2, 2, 7);
        // L'équipe 0, ennemie commune, n'a plus de camp et un seul élève.
        w.spawnUnit(0, 3, 3);
        w.tiles.find((t) => t.isCamp && t.owner === 0)!.owner = 1;
        const d = new Diplomacy(w, diff, [1, 2], seed);
        w.setAllied(1, 2, true);
        tick(w, 30, (dt) => d.update(dt)); // une seule réflexion diplomatique par IA
        if (d.drainEvents().some((e) => e.kind === 'warn')) counts[diff]++;
      }
    }
    expect(counts.expert).toBeGreaterThan(counts.facile);
    expect(counts.expert).toBeGreaterThan(5);
  });
});

describe('8 équipes', () => {
  it('8 couleurs, noms et profils', () => {
    expect(TEAM_NAMES).toHaveLength(8);
    expect(TEAM_COLORS).toHaveLength(8);
    expect(TEAM_PROFILES).toHaveLength(8);
    expect(new Set(TEAM_COLORS.map((c) => c.main)).size).toBe(8);
    expect(TEAM_NAMES.slice(4)).toEqual(['Rouge', 'Bleu', 'Orange', 'Rose']);
  });

  it('génère 5 à 8 camps valides, aux coins puis aux milieux des bords, sur plusieurs graines', () => {
    for (let teams = 5; teams <= 8; teams++)
      for (let size = 0; size < 4; size++)
        for (const seed of [1, 2, 99, 4242, 65535]) {
          const level = skirmishLevel({ teams, size, tiles: 20 + size * 3 });
          const map = generateMap(level, seed);
          const camps = map.tiles.filter((t) => t.kind === 'camp');
          const bonus = map.tiles.filter((t) => t.kind === 'bonus');
          expect(camps).toHaveLength(teams);
          expect(camps.map((c) => c.owner)).toEqual(Array.from({ length: teams }, (_, i) => i));
          expect(camps.map((c) => [c.x, c.y])).toEqual(campCorners(map.w, map.h, teams));
          expect(bonus.length).toBe(level.tiles);
          expect(bonus.length).toBeGreaterThanOrEqual(20);
          expect(map.unitCap * teams).toBeLessThanOrEqual(TOTAL_UNIT_BUDGET);
          const cells = new Set<string>();
          for (const t of map.tiles) {
            const n = t.kind === 'camp' ? 2 : 1;
            for (let dx = 0; dx < n; dx++)
              for (let dy = 0; dy < n; dy++) {
                const x = t.x + dx;
                const y = t.y + dy;
                expect(x >= 0 && y >= 0 && x < map.w && y < map.h).toBe(true);
                expect(cells.has(`${x},${y}`)).toBe(false);
                cells.add(`${x},${y}`);
              }
          }
          for (const o of map.obstacles ?? []) expect(cells.has(`${o.x},${o.y}`)).toBe(false);
          // Positions équitables : nombre pair d'équipes → camps symétriques par rotation de 180°.
          if (teams % 2 === 0) {
            const key = new Set(camps.map((c) => `${c.x},${c.y}`));
            for (const c of camps) expect(key.has(`${map.w - 2 - c.x},${map.h - 2 - c.y}`)).toBe(true);
          }
        }
  });

  it('plus d’équipes, plus grande cour', () => {
    for (let size = 0; size < 4; size++) {
      const w = [4, 5, 6, 7, 8].map((teams) => skirmishLevel({ teams, size, tiles: 20 }).w);
      for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThan(w[i - 1]);
    }
  });

  it('6e niveau « Le tournoi » à 8 équipes', () => {
    expect(LEVELS).toHaveLength(6);
    expect(LEVELS[5]).toMatchObject({ id: 'tournoi', name: 'Le tournoi', teams: 8 });
    const map = generateMap(LEVELS[5], 7);
    expect(map.tiles.filter((t) => t.kind === 'camp')).toHaveLength(8);
    expect(map.unitCap).toBe(30);
    expect(map.unitCap * 8).toBeLessThanOrEqual(TOTAL_UNIT_BUDGET);
  });

  it('code de carte : aller-retour de 2 à 8 équipes, toujours 6 caractères', () => {
    const specs: MapSpec[] = LEVELS.map((_, level) => ({ kind: 'campagne', level }));
    for (let teams = 2; teams <= 8; teams++)
      for (let size = 0; size < 4; size++)
        for (const tiles of teams >= 5 ? [20, 25, 30] : [10, 20, 30]) specs.push({ kind: 'escarmouche', teams, size, tiles });
    const seen = new Set<string>();
    for (const spec of specs)
      for (const seed of [0, 31337, (1 << 20) - 1]) {
        const code = encodeMapCode({ spec, seed });
        expect(code).toHaveLength(6);
        expect(decodeMapCode(code)).toEqual({ spec, seed });
        seen.add(code);
      }
    expect(seen.size).toBe(specs.length * 3);
    const map = mapForCode({ spec: { kind: 'escarmouche', teams: 7, size: 2, tiles: 24 }, seed: 9 });
    expect(map.teams).toBe(7);
  });

  it('les codes de l’ancienne version se décodent à l’identique', () => {
    const old: Array<[string, MapSpec, number]> = [
      ['222222', { kind: 'campagne', level: 0 }, 0],
      ['V6MFPC', { kind: 'campagne', level: 4 }, 777],
      ['BSP47Z', { kind: 'escarmouche', teams: 2, size: 0, tiles: 10 }, 1048575],
      ['CPH2UQ', { kind: 'escarmouche', teams: 4, size: 3, tiles: 30 }, 777],
      ['AQ7WZ7', { kind: 'escarmouche', teams: 3, size: 1, tiles: 17 }, 0],
    ];
    for (const [code, spec, seed] of old) {
      expect(decodeMapCode(code)).toEqual({ spec, seed });
      expect(encodeMapCode({ spec, seed })).toBe(code);
    }
  });

  it('une partie à 8 IA (avec diplomatie) se termine', () => {
    const map = generateMap(skirmishLevel({ teams: 8, size: 0, tiles: 20 }), 11);
    const w = new World(map, 8, 11);
    const ais = Array.from({ length: 8 }, (_, t) => new TeamAi(w, t, 'expert'));
    const d = new Diplomacy(w, 'expert', ais.map((a) => a.team), 11);
    const step = 1 / 60;
    let maxUnits = 0;
    let t = 0;
    while (t < 1500 && w.victors().length === 0) {
      for (const a of ais) a.update(step);
      w.update(step);
      d.update(step);
      d.recordAll(w.drainEvents());
      d.drainEvents();
      maxUnits = Math.max(maxUnits, w.units.length);
      t += step;
    }
    expect(w.victors().length).toBeGreaterThan(0);
    expect(maxUnits).toBeLessThanOrEqual(TOTAL_UNIT_BUDGET + 8);
  }, 120_000);
});
