import { describe, expect, it } from 'vitest';
import { AI_ATTENTION, HUMAN_ATTENTION, UNLIMITED_ATTENTION } from '../src/config';
import { describeAttention, TeamAi } from '../src/core/ai';
import type { Tile } from '../src/core/tile';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

// Cour de test : l'IA (équipe 1) possède trois cases éloignées les unes des autres.
const MAP: MapDef = {
  id: 'attention',
  name: 'Attention',
  w: 24,
  h: 24,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 22, y: 22, owner: 1 },
    { kind: 'bonus', x: 20, y: 6, suit: 'heart' },
    { kind: 'bonus', x: 6, y: 20, suit: 'club' },
    { kind: 'bonus', x: 12, y: 12, suit: 'spade' },
    { kind: 'bonus', x: 3, y: 10, suit: 'diamond' },
  ],
};

function setup(attention: Parameters<typeof makeAi>[1]) {
  const w = new World(MAP, 2, 3);
  const owned = w.tiles.slice(2, 5);
  for (const t of owned) t.owner = 1;
  // Douze élèves de l'IA autour de son camp.
  for (let i = 0; i < 12; i++) w.spawnUnit(1, 20.5 + (i % 4) * 0.4, 20.5 + Math.floor(i / 4) * 0.4, false);
  const ai = makeAi(w, attention);
  ai.economy.allowPowers = false;
  ai.economy.allowUpgrades = false;
  ai.economy.allowRallies = false;
  ai.economy.allowPion = false;
  return { w, ai, owned };
}

function makeAi(w: World, attention: Partial<typeof HUMAN_ATTENTION>) {
  return new TeamAi(w, 1, 'normal', undefined, attention);
}

/** Lâche `n` élèves de l'équipe 0 sur une case (ils la menacent), ou juste à côté (sans la prendre). */
function threaten(w: World, t: Tile, n = 3, beside = false) {
  for (let i = 0; i < n; i++) w.spawnUnit(0, t.cx + (i - 1) * 0.3, t.cy + (beside ? 1.6 : 0.2), false);
}

function run(w: World, ai: TeamAi, seconds: number) {
  const step = 1 / 60;
  for (let s = 0; s < seconds; s += step) {
    ai.update(step);
    w.update(step);
    w.drainEvents();
  }
}

/** Élèves de l'IA envoyés défendre la case. */
function defendersOf(w: World, t: Tile): number {
  return w.units.filter((u) => u.team === 1 && u.alive && u.aiTag === 1 && u.order.kind === 'move' && Math.hypot(u.order.target.x - t.cx, u.order.target.y - t.cy) < 2).length;
}

describe('IA à attention limitée (saison 1)', () => {
  it('budget d’ordres par minute, fronts et délai de réaction selon la difficulté ; l’humain témoin entre 15 et 25 ordres par minute', () => {
    const opm = (['facile', 'normal', 'difficile', 'expert'] as const).map((d) => AI_ATTENTION[d].ordersPerMin);
    expect(opm).toEqual([10, 18, 28, 40]);
    expect(AI_ATTENTION.facile.fronts).toBe(1);
    expect(AI_ATTENTION.normal.fronts).toBe(1);
    expect(AI_ATTENTION.expert.fronts).toBeGreaterThan(AI_ATTENTION.difficile.fronts);
    expect(AI_ATTENTION.facile.threatDelay).toBeGreaterThan(AI_ATTENTION.normal.threatDelay);
    expect(AI_ATTENTION.normal.threatDelay).toBeGreaterThan(AI_ATTENTION.expert.threatDelay);
    expect(HUMAN_ATTENTION.ordersPerMin).toBeGreaterThanOrEqual(15);
    expect(HUMAN_ATTENTION.ordersPerMin).toBeLessThanOrEqual(25);
  });

  it('jamais plus d’ordres que le budget sur une minute, même sous pression', () => {
    const { w, ai, owned } = setup({ ordersPerMin: 10, burst: 2, fronts: 3, threatDelay: 0 });
    for (const t of owned) threaten(w, t, 2);
    run(w, ai, 60);
    expect(ai.ordersGiven).toBeGreaterThan(0);
    expect(ai.ordersGiven).toBeLessThanOrEqual(10 + 2);
  });

  it('sans limite, la même IA donne nettement plus d’ordres (l’ancienne IA omniprésente)', () => {
    const a = setup({ ordersPerMin: 10, burst: 2, fronts: 3, threatDelay: 0 });
    const b = setup(UNLIMITED_ATTENTION);
    for (const s of [a, b]) for (const t of s.owned) threaten(s.w, t, 2);
    run(a.w, a.ai, 30);
    run(b.w, b.ai, 30);
    expect(b.ai.ordersGiven).toBeGreaterThan(a.ai.ordersGiven);
  });

  it('une seule case secourue à la fois avec un front : les autres attendent', () => {
    const { w, ai, owned } = setup({ ordersPerMin: 600, burst: 20, fronts: 1, threatDelay: 0 });
    for (const t of owned) threaten(w, t, 2);
    run(w, ai, 1); // première réflexion de l'IA (à 0,9 s)
    const helped = owned.filter((t) => defendersOf(w, t) > 0);
    expect(helped.length).toBe(1);
  });

  it('avec trois fronts, les trois cases sont secourues d’un coup', () => {
    const { w, ai, owned } = setup({ ordersPerMin: 600, burst: 20, fronts: 3, threatDelay: 0 });
    for (const t of owned) threaten(w, t, 2);
    run(w, ai, 1);
    expect(owned.filter((t) => defendersOf(w, t) > 0).length).toBe(3);
  });

  it('délai de réaction propre à chaque case : une attaque n’est vue qu’après `threatDelay` secondes', () => {
    const { w, ai, owned } = setup({ ordersPerMin: 600, burst: 20, fronts: 3, threatDelay: 2.5 });
    const [a, b] = owned;
    // Réflexions de l'IA : à 0,9 s, puis toutes les 1,5 à 2,3 s.
    threaten(w, a, 2, true);
    run(w, ai, 3);
    expect(defendersOf(w, a)).toBe(0); // vue à 0,9 s, mais pas encore remarquée
    run(w, ai, 1.5);
    threaten(w, b, 2, true); // t = 4,5 s
    run(w, ai, 1.5); // t = 6 s : a remarquée (réflexion entre 3,4 et 6 s), b pas avant 7 s
    expect(defendersOf(w, a)).toBeGreaterThan(0);
    expect(defendersOf(w, b)).toBe(0);
    run(w, ai, 4);
    expect(defendersOf(w, b)).toBeGreaterThan(0);
  });

  it('le camp passe avant une case bonus quand l’attention manque', () => {
    const { w, ai, owned } = setup({ ordersPerMin: 600, burst: 20, fronts: 1, threatDelay: 0 });
    const camp = w.tiles[1];
    threaten(w, owned[0], 3);
    threaten(w, camp, 2);
    run(w, ai, 1);
    expect(defendersOf(w, camp)).toBeGreaterThan(0);
    expect(defendersOf(w, owned[0])).toBe(0);
  });

  it('la partie normale crée des IA avec l’attention de leur difficulté', () => {
    const w = new World(MAP, 2, 1);
    expect(new TeamAi(w, 1, 'facile').attention).toEqual(AI_ATTENTION.facile);
    expect(new TeamAi(w, 1, 'expert').attention).toEqual(AI_ATTENTION.expert);
  });

  it('le menu décrit l’attention de chaque difficulté, en français', () => {
    expect(describeAttention('normal')).toBe('IA : environ 18 ordres par minute, une case secourue à la fois, 1,6 s pour remarquer une attaque.');
    expect(describeAttention('expert')).toContain('3 cases secourues à la fois');
    expect(describeAttention('expert')).toContain('0,5 s');
  });
});
