import { describe, expect, it } from 'vitest';
import { HARASS_MIN_GAP, TeamAi } from '../src/core/ai';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

// 1.1 bis : réglages du « joueur témoin » humain (secours limité, second front).
const MAP: MapDef = {
  id: 'th',
  name: 'TH',
  w: 24,
  h: 16,
  teams: 2,
  unitCap: 30,
  spawnInterval: 999,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 22, y: 14, owner: 1 },
    { kind: 'bonus', x: 6, y: 6, suit: 'heart' },
    { kind: 'bonus', x: 12, y: 2, suit: 'club' },
    { kind: 'bonus', x: 12, y: 12, suit: 'spade' },
    { kind: 'bonus', x: 20, y: 4, suit: 'diamond' },
  ],
};

const run = (w: World, ai: TeamAi, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) {
    ai.update(1 / 60);
    w.update(1 / 60);
    w.drainEvents();
  }
};

/** Équipe 0 : la case ♥ (index 2) lui appartient, un ennemi immobile s'y tient ; ses élèves sont au camp. */
function threatened(mode: 'all' | 'camps' | 'none', onCamp = false) {
  const w = new World(MAP, 2, 5);
  const heart = w.tiles[2];
  heart.owner = 0;
  const camp = w.tiles[0];
  const target = onCamp ? camp : heart;
  const e = w.spawnUnit(1, target.cx + 0.6, target.cy + 0.6, false);
  e.frozenUntil = 999;
  e.maxHp = e.hp = 100000;
  const mine = Array.from({ length: 6 }, (_, i) => w.spawnUnit(0, onCamp ? 4 + i * 0.3 : camp.cx + 0.3 * i, onCamp ? 8 : camp.cy, false));
  const ai = new TeamAi(w, 0, 'normal', { reaction: 0.5 }, { ordersPerMin: 600, burst: 10, threatDelay: 0 });
  ai.selfRescue = mode;
  ai.harassSize = 0;
  return { w, ai, target, mine, e };
}

const TAG_DEFEND = 1;
const TAG_HARASS = 5;

describe('témoin humain (1.1 bis) : secours de ses propres cases', () => {
  it('par défaut, l’IA envoie des défenseurs sur une case bonus menacée', () => {
    const { w, ai, mine } = threatened('all');
    run(w, ai, 1.2);
    expect(mine.some((u) => u.aiTag === TAG_DEFEND)).toBe(true);
  });

  it('« camps » : une case bonus menacée n’est pas secourue, son camp l’est', () => {
    const a = threatened('camps');
    run(a.w, a.ai, 1.2);
    expect(a.mine.some((u) => u.aiTag === TAG_DEFEND)).toBe(false);
    const b = threatened('camps', true);
    run(b.w, b.ai, 1.2);
    expect(b.mine.some((u) => u.aiTag === TAG_DEFEND)).toBe(true);
  });

  it('« none » : même le camp menacé n’est pas secouru par l’IA', () => {
    const { w, ai, mine } = threatened('none', true);
    run(w, ai, 1.2);
    expect(mine.some((u) => u.aiTag === TAG_DEFEND)).toBe(false);
  });
});

describe('témoin humain (1.1 bis) : second front', () => {
  function army(harass: number) {
    const w = new World(MAP, 2, 9);
    const camp = w.tiles[0];
    const mine = Array.from({ length: 24 }, (_, i) => w.spawnUnit(0, camp.cx + 0.25 * (i % 6), camp.cy + 0.25 * Math.floor(i / 6), false));
    const ai = new TeamAi(w, 0, 'normal', { reaction: 0.5 }, { ordersPerMin: 600, burst: 10, threatDelay: 0 });
    ai.harassSize = harass;
    return { w, ai, mine };
  }

  it('un petit groupe part vers une case éloignée de la cible principale', () => {
    const { w, ai, mine } = army(3);
    run(w, ai, 3);
    const h = ai.harassing;
    expect(h).not.toBeNull();
    const harassers = mine.filter((u) => u.aiTag === TAG_HARASS);
    expect(harassers.length).toBe(3);
    // La cible principale du gros de l'armée est loin de celle du harcèlement.
    const main = mine.filter((u) => u.aiTag === 2 || u.aiTag === 3);
    expect(main.length).toBeGreaterThanOrEqual(4);
    const mx = main.reduce((s, u) => s + u.x, 0) / main.length;
    const my = main.reduce((s, u) => s + u.y, 0) / main.length;
    run(w, ai, 6);
    const hx = harassers.reduce((s, u) => s + u.x, 0) / harassers.length;
    const hy = harassers.reduce((s, u) => s + u.y, 0) / harassers.length;
    expect(Math.hypot(hx - mx, hy - my)).toBeGreaterThan(2);
    expect(HARASS_MIN_GAP).toBeGreaterThanOrEqual(5);
  });

  it('sans réglage, aucun second front (comportement des IA inchangé)', () => {
    const { w, ai, mine } = army(0);
    run(w, ai, 3);
    expect(ai.harassing).toBeNull();
    expect(mine.some((u) => u.aiTag === TAG_HARASS)).toBe(false);
  });

  it('une petite armée ne se divise pas', () => {
    const w = new World(MAP, 2, 9);
    const camp = w.tiles[0];
    for (let i = 0; i < 4; i++) w.spawnUnit(0, camp.cx + 0.3 * i, camp.cy, false);
    const ai = new TeamAi(w, 0, 'normal', { reaction: 0.5 }, { ordersPerMin: 600, burst: 10, threatDelay: 0 });
    ai.harassSize = 3;
    run(w, ai, 3);
    expect(ai.harassing).toBeNull();
  });
});
