import { describe, expect, it } from 'vitest';
import { FAST_WIN_SECONDS, medalsFor, mergeMedals, sanitizeMedals } from '../src/core/challenges';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  SEED_COUNT,
  decodeMapCode,
  describeSpec,
  encodeMapCode,
  mapForCode,
  randomSeed,
  type MapSpec,
} from '../src/core/mapcode';
import { generateMap, LEVELS } from '../src/core/mapgen';
import { Rng } from '../src/core/rng';
import { loadProgress, recordWin, saveProgress } from '../src/core/save';
import { COUR_SIZES, skirmishLevel, type SkirmishSettings } from '../src/core/skirmish';
import { World } from '../src/core/world';
import { STORAGE_KEY } from '../src/config';

function memoryStore(init: Record<string, string> = {}) {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function allSpecs(): MapSpec[] {
  const out: MapSpec[] = LEVELS.map((_, level) => ({ kind: 'campagne', level }));
  for (let teams = 2; teams <= 4; teams++)
    for (let size = 0; size < COUR_SIZES.length; size++)
      for (let tiles = 10; tiles <= 30; tiles++) out.push({ kind: 'escarmouche', teams, size, tiles });
  return out;
}

describe('code de carte', () => {
  it('encode et décode tous les types de partie, aller-retour', () => {
    const rng = new Rng(42);
    const seen = new Set<string>();
    for (const spec of allSpecs()) {
      for (const seed of [0, 1, SEED_COUNT - 1, randomSeed(() => rng.next())]) {
        const code = encodeMapCode({ spec, seed });
        expect(code).toHaveLength(CODE_LENGTH);
        for (const c of code) expect(CODE_ALPHABET).toContain(c);
        expect(decodeMapCode(code)).toEqual({ spec, seed });
        seen.add(code);
      }
    }
    // Pas de collision : chaque (type, graine) a son propre code.
    expect(seen.size).toBe(allSpecs().length * 4);
  });

  it("n'utilise aucun caractère ambigu", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    for (const c of '01IO') expect(CODE_ALPHABET).not.toContain(c);
  });

  it('tolère minuscules, espaces et tirets à la saisie', () => {
    const code = encodeMapCode({ spec: { kind: 'campagne', level: 2 }, seed: 123456 });
    const messy = ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `;
    expect(decodeMapCode(messy)).toEqual({ spec: { kind: 'campagne', level: 2 }, seed: 123456 });
  });

  it('refuse les codes mal formés', () => {
    expect(decodeMapCode('')).toBeNull();
    expect(decodeMapCode('ABC')).toBeNull();
    expect(decodeMapCode('ABCDEFG')).toBeNull();
    expect(decodeMapCode('ABC0EF')).toBeNull();
    expect(decodeMapCode('ABCIEF')).toBeNull();
    // Une bonne partie des codes tirés au hasard est rejetée (en-tête invalide).
    const rng = new Rng(7);
    let rejected = 0;
    for (let i = 0; i < 2000; i++) {
      let s = '';
      for (let k = 0; k < 6; k++) s += CODE_ALPHABET[rng.int(0, 31)];
      if (!decodeMapCode(s)) rejected++;
    }
    expect(rejected).toBeGreaterThan(1000);
  });

  it('les graines aléatoires restent dans la plage du code', () => {
    expect(randomSeed(() => 0)).toBe(0);
    expect(randomSeed(() => 0.999999999)).toBe(SEED_COUNT - 1);
    for (let i = 0; i < 100; i++) {
      const s = randomSeed();
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(SEED_COUNT);
    }
  });

  it('le même code redonne exactement la même carte', () => {
    for (const spec of [{ kind: 'campagne', level: 4 }, { kind: 'escarmouche', teams: 3, size: 2, tiles: 23 }] as MapSpec[]) {
      const code = encodeMapCode({ spec, seed: 98765 });
      const a = mapForCode(decodeMapCode(code)!);
      const b = mapForCode(decodeMapCode(code)!);
      expect(a).toEqual(b);
      expect(mapForCode({ spec, seed: 98766 })).not.toEqual(a);
    }
    // Les niveaux de campagne restent générés comme avant.
    expect(mapForCode({ spec: { kind: 'campagne', level: 1 }, seed: 5 })).toEqual(generateMap(LEVELS[1], 5));
  });

  it('décrit la partie encodée en français', () => {
    expect(describeSpec({ kind: 'campagne', level: 2 })).toBe('Niveau 3 : Le gymnase');
    expect(describeSpec({ kind: 'escarmouche', teams: 4, size: 1, tiles: 18 })).toBe('Escarmouche : 4 équipes, cour moyenne, 18 cases');
  });
});

describe('escarmouche', () => {
  const settings: SkirmishSettings[] = [];
  for (let teams = 2; teams <= 4; teams++)
    for (let size = 0; size < 4; size++) for (const tiles of [10, 17, 24, 30]) settings.push({ teams, size, tiles });

  it('génère une carte valide pour chaque réglage', () => {
    for (const s of settings) {
      const level = skirmishLevel(s);
      for (const seed of [1, 777, 424242]) {
        const map = generateMap(level, seed);
        const camps = map.tiles.filter((t) => t.kind === 'camp');
        const bonus = map.tiles.filter((t) => t.kind === 'bonus');
        expect(camps).toHaveLength(s.teams);
        expect(new Set(camps.map((c) => c.owner)).size).toBe(s.teams);
        expect(bonus).toHaveLength(s.tiles);
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
      }
    }
  });

  it('les tailles de cour restent ordonnées et ne rapetissent jamais', () => {
    for (let teams = 2; teams <= 4; teams++)
      for (let tiles = 10; tiles <= 30; tiles++) {
        const w = [0, 1, 2, 3].map((size) => skirmishLevel({ teams, size, tiles }).w);
        for (let i = 1; i < 4; i++) expect(w[i]).toBeGreaterThan(w[i - 1]);
        expect(w[0]).toBeGreaterThanOrEqual(COUR_SIZES[0].w);
      }
  });

  it('borne les réglages hors limites', () => {
    const l = skirmishLevel({ teams: 9, size: -3, tiles: 99 });
    expect(l.teams).toBe(4);
    expect(l.tiles).toBe(30);
  });

  it('une partie d’escarmouche se simule sans erreur', () => {
    const map = generateMap(skirmishLevel({ teams: 3, size: 3, tiles: 26 }), 31337);
    const world = new World(map, map.teams, 1);
    for (let i = 0; i < 60 * 5; i++) world.update(1 / 60);
    expect(world.stats().every((s) => s.alive)).toBe(true);
  });
});

describe('médailles', () => {
  it('attribue les trois médailles selon la partie', () => {
    expect(medalsFor({ win: false, homeCampLost: false, seconds: 30 })).toEqual({});
    expect(medalsFor({ win: true, homeCampLost: false, seconds: 60 })).toEqual({ victoire: true, camp: true, eclair: true });
    expect(medalsFor({ win: true, homeCampLost: true, seconds: 60 })).toEqual({ victoire: true, eclair: true });
    expect(medalsFor({ win: true, homeCampLost: false, seconds: FAST_WIN_SECONDS })).toEqual({ victoire: true, camp: true });
    expect(medalsFor({ win: true, homeCampLost: true, seconds: 600 })).toEqual({ victoire: true });
  });

  it('cumule les médailles et signale les nouvelles', () => {
    let r = mergeMedals(undefined, 'preau', { victoire: true });
    expect(r.fresh).toEqual(['victoire']);
    r = mergeMedals(r.medals, 'preau', { victoire: true, eclair: true });
    expect(r.fresh).toEqual(['eclair']);
    expect(r.medals.preau).toEqual({ victoire: true, eclair: true });
    // Une moins bonne partie ne retire rien.
    r = mergeMedals(r.medals, 'preau', {});
    expect(r.fresh).toEqual([]);
    expect(r.medals.preau).toEqual({ victoire: true, eclair: true });
    r = mergeMedals(r.medals, 'cour', { victoire: true, camp: true });
    expect(Object.keys(r.medals).sort()).toEqual(['cour', 'preau']);
  });

  it('nettoie les données corrompues', () => {
    expect(sanitizeMedals(null)).toEqual({});
    expect(sanitizeMedals([1, 2])).toEqual({});
    expect(sanitizeMedals({ preau: { victoire: true, camp: 'oui', bidon: true }, cour: 3 })).toEqual({ preau: { victoire: true } });
  });
});

describe('sauvegarde', () => {
  it('relit une ancienne sauvegarde sans médailles', () => {
    const old = { unlocked: 3, wins: { preau: 2, cour: 1 }, muted: true, lastTeam: 2, lastDifficulty: 'difficile' };
    const p = loadProgress(memoryStore({ [STORAGE_KEY]: JSON.stringify(old) }));
    expect(p.unlocked).toBe(3);
    expect(p.wins).toEqual(old.wins);
    expect(p.muted).toBe(true);
    expect(p.lastTeam).toBe(2);
    expect(p.lastDifficulty).toBe('difficile');
    expect(p.medals ?? {}).toEqual({});
  });

  it('conserve les médailles et les champs inconnus restent sans effet', () => {
    const store = memoryStore();
    const base = loadProgress(store);
    const { medals } = mergeMedals(base.medals, 'preau', { victoire: true, camp: true });
    saveProgress({ ...recordWin(base, 'preau', 0, LEVELS.length), medals }, store);
    const back = loadProgress(store);
    expect(back.unlocked).toBe(2);
    expect(back.medals).toEqual({ preau: { victoire: true, camp: true } });
    // Une sauvegarde abîmée ne casse rien.
    store.setItem(STORAGE_KEY, JSON.stringify({ unlocked: 2, medals: 'n’importe quoi' }));
    expect(loadProgress(store).medals).toEqual({});
  });
});
