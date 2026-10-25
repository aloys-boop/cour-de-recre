import { describe, expect, it } from 'vitest';
import { TeamAi } from '../src/core/ai';
import { addGhostCamps, ghostCamps, ghostCountFor, mapWithRules } from '../src/core/ghosts';
import { mapForCode, type MapCode } from '../src/core/mapcode';
import { RULE_TOGGLES } from '../src/core/rules';
import { COUR_SIZES, minTilesFor, skirmishLevel, SKIRMISH_TILES_MAX } from '../src/core/skirmish';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const code = (teams: number, size: number, tiles: number, seed: number): MapCode => ({ spec: { kind: 'escarmouche', teams, size, tiles }, seed });

function tick(w: World, seconds: number, each?: () => void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    each?.();
    w.update(step);
  }
}

/** Cellules occupées par une carte : chaque cellule ne doit l'être qu'une fois. */
function cellsOf(map: MapDef): string[] {
  const out: string[] = [];
  for (const t of map.tiles) {
    const s = t.kind === 'camp' ? 2 : 1;
    for (let dx = 0; dx < s; dx++) for (let dy = 0; dy < s; dy++) out.push(`${t.x + dx},${t.y + dy}`);
  }
  for (const o of map.obstacles ?? []) out.push(`${o.x},${o.y}`);
  return out;
}

describe('camps fantômes : génération', () => {
  it('l’option figure dans le menu d’escarmouche, désactivée par défaut', () => {
    expect(RULE_TOGGLES.some((t) => t.key === 'ghostCamps' && t.label === 'Camps fantômes')).toBe(true);
  });

  it('option inactive (ou campagne) : carte identique à avant', () => {
    for (const seed of [1, 42, 777]) {
      const c = code(4, 1, 18, seed);
      expect(mapWithRules(c, {})).toEqual(mapForCode(c));
      expect(mapWithRules(c, { ghostCamps: false })).toEqual(mapForCode(c));
      expect(mapWithRules(c)).toEqual(mapForCode(c));
      const camp: MapCode = { spec: { kind: 'campagne', level: 2 }, seed };
      expect(mapWithRules(camp, { ghostCamps: true })).toEqual(mapForCode(camp));
    }
  });

  it('option active : le bon nombre de camps fantômes, sans chevauchement, sur toutes les configurations', () => {
    for (let teams = 2; teams <= 8; teams++) {
      for (let size = 0; size < COUR_SIZES.length; size++) {
        for (const tiles of [minTilesFor(teams), SKIRMISH_TILES_MAX]) {
          for (const seed of [3, 1234, 99991]) {
            const c = code(teams, size, tiles, seed);
            const base = mapForCode(c);
            const map = mapWithRules(c, { ghostCamps: true });
            const ghosts = ghostCamps(map.tiles);
            const expected = ghostCountFor(skirmishLevel({ teams, size, tiles }).w);
            // Carte symétrique au centre occupé : une paire symétrique plutôt qu'un camp décentré.
            const fallback = teams % 2 === 0 && expected % 2 === 1 ? (expected === 1 ? 2 : expected - 1) : expected;
            expect([expected, fallback], `${teams} équipes, taille ${size}, ${tiles} cases, graine ${seed}`).toContain(ghosts.length);
            // La carte de base est intacte : seuls des camps fantômes sont ajoutés, à la fin.
            expect(map.tiles.slice(0, base.tiles.length)).toEqual(base.tiles);
            expect(map.obstacles).toEqual(base.obstacles);
            for (const g of ghosts) {
              expect(g.owner).toBeUndefined();
              expect(g.x).toBeGreaterThanOrEqual(1);
              expect(g.y).toBeGreaterThanOrEqual(1);
              expect(g.x + 1).toBeLessThanOrEqual(map.w - 2);
              expect(g.y + 1).toBeLessThanOrEqual(map.h - 2);
            }
            const cells = cellsOf(map);
            expect(new Set(cells).size).toBe(cells.length);
          }
        }
      }
    }
  });

  it('reproductible : même code et même option, même carte', () => {
    for (const seed of [5, 6000, 1048575]) {
      const c = code(6, 2, 24, seed);
      expect(mapWithRules(c, { ghostCamps: true })).toEqual(mapWithRules(c, { ghostCamps: true }));
    }
    const a = ghostCamps(mapWithRules(code(3, 3, 20, 10), { ghostCamps: true }).tiles);
    const b = ghostCamps(mapWithRules(code(3, 3, 20, 11), { ghostCamps: true }).tiles);
    expect(a.length).toBe(3);
    expect(b.length).toBe(3);
  });

  it('symétriques (rotation de 180°) quand la carte l’est', () => {
    for (const teams of [2, 4, 6, 8]) {
      for (const seed of [8, 80, 800]) {
        const map = mapWithRules(code(teams, 2, 20, seed), { ghostCamps: true });
        const ghosts = ghostCamps(map.tiles);
        const key = (x: number, y: number) => `${x},${y}`;
        const set = new Set(ghosts.map((g) => key(g.x, g.y)));
        for (const g of ghosts) {
          const m = { x: map.w - 2 - g.x, y: map.h - 2 - g.y };
          // Camp central d'une cour de côté impair : symétrique à une demi-cellule près.
          const self = Math.max(Math.abs(m.x - g.x), Math.abs(m.y - g.y)) <= 1;
          expect(self || set.has(key(m.x, m.y))).toBe(true);
        }
      }
    }
  });

  it('équitables : chaque équipe est à peu près à la même distance de son camp fantôme le plus proche', () => {
    for (const teams of [2, 3, 4, 5, 8]) {
      const map = mapWithRules(code(teams, 2, 22, 2024), { ghostCamps: true });
      const ghosts = ghostCamps(map.tiles);
      const homes = map.tiles.filter((t) => t.kind === 'camp' && !t.ghost);
      const d = homes.map((h) => Math.min(...ghosts.map((g) => Math.hypot(g.x - h.x, g.y - h.y))));
      expect(Math.max(...d) - Math.min(...d), `${teams} équipes`).toBeLessThan(map.w * 0.35);
    }
  });

  it('ne modifie pas la carte d’origine', () => {
    const base = mapForCode(code(4, 1, 18, 3));
    const copy = JSON.stringify(base);
    addGhostCamps(base);
    expect(JSON.stringify(base)).toBe(copy);
  });
});

/** Petite cour : deux équipes et un camp fantôme au milieu. */
const SMALL: MapDef = {
  id: 'fantome',
  name: 'Fantôme',
  w: 10,
  h: 10,
  teams: 2,
  unitCap: 8,
  spawnInterval: 2,
  startUnits: 3,
  tiles: [
    { kind: 'camp', x: 0, y: 8, owner: 0 },
    { kind: 'camp', x: 8, y: 0, owner: 1 },
    { kind: 'camp', x: 4, y: 4, ghost: true },
    { kind: 'bonus', x: 2, y: 2, suit: 'heart' },
  ],
};

describe('camps fantômes : en jeu', () => {
  it('neutre au départ, ne produit rien, puis se capture lentement et produit pour son nouveau propriétaire', () => {
    const w = new World({ ...SMALL, unitCap: 40 }, 2, 1);
    const ghost = w.tiles.find((t) => t.ghost)!;
    expect(ghost).toBeDefined();
    expect(ghost.isCamp).toBe(true);
    expect(ghost.owner).toBe(NO_TEAM);
    expect(w.teamCampCount(0)).toBe(1);
    w.units.filter((u) => u.team === 0).forEach((u) => (u.hp = u.maxHp * 10)); // pas de mort accidentelle
    // Personne dessus : aucun élève n'y naît.
    const before = w.units.length;
    tick(w, 1);
    expect(w.units.length).toBe(before);

    // Trois élèves de l'équipe 0 s'y installent : capture plus lente qu'une case bonus (camp).
    const mine = w.units.filter((u) => u.team === 0);
    mine.forEach((u, i) => {
      u.x = ghost.cx + 0.1 * (i - 1);
      u.y = ghost.cy + 0.05 * i;
    });
    tick(w, 3, () => {
      for (const u of mine) w.orderMove([u], { x: ghost.cx, y: ghost.cy });
    });
    expect(ghost.owner).toBe(NO_TEAM); // une case bonus serait déjà prise
    tick(w, 6, () => {
      for (const u of mine) if (Math.hypot(u.x - ghost.cx, u.y - ghost.cy) > 0.4) w.orderMove([u], { x: ghost.cx, y: ghost.cy });
    });
    expect(ghost.owner).toBe(0);
    expect(w.teamCampCount(0)).toBe(2);

    // Il produit des élèves pour l'équipe 0, à côté de lui (deuxième point de production).
    w.drainEvents();
    tick(w, 2.2);
    const born = w.drainEvents().filter((e) => e.kind === 'spawn' && Math.hypot(e.x - ghost.cx, e.y - ghost.cy) < 1);
    expect(born.length).toBeGreaterThan(0);
    expect(born.every((e) => e.team === 0)).toBe(true);
  });

  it('peut être repris par une autre équipe', () => {
    // Production très lente : le camp fantôme de l'équipe 0 ne lui donne pas de défenseurs pendant le test.
    const w = new World({ ...SMALL, spawnInterval: 1000 }, 2, 1);
    const ghost = w.tiles.find((t) => t.ghost)!;
    ghost.owner = 0;
    for (const u of w.units) if (u.team === 0) u.takeDamage(1000, u.x, u.y);
    const theirs = w.units.filter((u) => u.team === 1 && u.alive);
    for (const u of theirs) {
      u.x = ghost.cx;
      u.y = ghost.cy;
    }
    tick(w, 10, () => {
      for (const u of theirs) if (u.alive && Math.hypot(u.x - ghost.cx, u.y - ghost.cy) > 0.4) w.orderMove([u], { x: ghost.cx, y: ghost.cy });
    });
    expect(ghost.owner).toBe(1);
  });

  it('point de ralliement et bouton Camp fonctionnent avec un camp fantôme capturé', () => {
    const w = new World(SMALL, 2, 1);
    const ghost = w.tiles.find((t) => t.ghost)!;
    expect(w.setRally(0, { x: 6, y: 6 })?.camp).not.toBe(ghost); // neutre : pas à moi
    ghost.owner = 0;
    const res = w.setRally(0, { x: 6.5, y: 5.5 });
    expect(res?.camp).toBe(ghost);
    expect(w.rallyFor(ghost)).not.toBeNull();
  });
});

describe('camps fantômes : victoire', () => {
  it('une équipe qui ne possède plus qu’un camp fantôme reste en vie et ne s’épuise pas', () => {
    const w = new World(SMALL, 2, 1);
    const [home0] = w.camps.filter((t) => t.owner === 0);
    const ghost = w.tiles.find((t) => t.ghost)!;
    home0.owner = 1;
    ghost.owner = 0;
    for (const u of w.units) if (u.team === 0) u.takeDamage(1000, u.x, u.y);
    tick(w, 0.1);
    expect(w.stats()[0].alive).toBe(true);
    expect(w.stats()[0].camps).toBe(1);
    expect(w.rhythm.starving[0]).toBe(false);
    expect(w.winner()).toBe(NO_TEAM);
  });

  it('tenir tous les camps inclut les camps fantômes', () => {
    const w = new World(SMALL, 2, 1);
    const ghost = w.tiles.find((t) => t.ghost)!;
    for (const c of w.camps) if (!c.ghost) c.owner = 1;
    // Le camp fantôme est encore neutre : pas de victoire « tous les camps » (l'équipe 0 a encore des élèves).
    expect(w.winner()).toBe(NO_TEAM);
    ghost.owner = 0;
    expect(w.winner()).toBe(NO_TEAM);
    ghost.owner = 1;
    expect(w.winner()).toBe(1);
  });

  it('sans élèves ni camp (même fantôme), une équipe est éliminée', () => {
    const w = new World(SMALL, 2, 1);
    const ghost = w.tiles.find((t) => t.ghost)!;
    ghost.owner = 1;
    w.camps.filter((t) => t.owner === 0).forEach((t) => (t.owner = 1));
    for (const u of w.units) if (u.team === 0) u.takeDamage(1000, u.x, u.y);
    expect(w.stats()[0].alive).toBe(false);
    expect(w.winner()).toBe(1);
  });

  it('les IA vont prendre un camp fantôme neutre', () => {
    const map = mapWithRules(code(2, 0, 10, 77), { ghostCamps: true });
    const w = new World(map, 2, 3);
    const ais = [new TeamAi(w, 0, 'normal'), new TeamAi(w, 1, 'normal')];
    const ghost = w.tiles.find((t) => t.ghost)!;
    let taken = false;
    tick(w, 90, () => {
      for (const a of ais) a.update(1 / 60);
      if (ghost.owner !== NO_TEAM) taken = true;
    });
    expect(taken).toBe(true);
  });
});
