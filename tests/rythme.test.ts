import { describe, expect, it } from 'vitest';
import { RHYTHM, SUIT_BONUS } from '../src/config';
import { goldenAiBonus, rhythmAnnouncement } from '../src/core/events';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World, type WorldEvent } from '../src/core/world';

const SMALL: MapDef = {
  id: 'small',
  name: 'Petit',
  w: 8,
  h: 8,
  teams: 3,
  unitCap: 5,
  spawnInterval: 1000, // pas de renforts pendant les tests
  startUnits: 2,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 6, y: 6, owner: 1 },
    { kind: 'camp', x: 0, y: 6, owner: 2 },
    { kind: 'bonus', x: 3, y: 3, suit: 'heart' },
    { kind: 'bonus', x: 4, y: 3, suit: 'spade' },
    { kind: 'bonus', x: 3, y: 4, suit: 'club' },
    { kind: 'bonus', x: 6, y: 0, suit: 'diamond' },
  ],
};

/** Avance le monde et collecte les événements. */
function tick(w: World, seconds: number, events: WorldEvent[] = []): WorldEvent[] {
  const step = 1 / 60;
  for (let t = 0; t < seconds - 1e-9; t += step) {
    w.update(step);
    events.push(...w.drainEvents());
  }
  return events;
}

/** Monde vide d'élèves (les équipes gardent leurs camps). */
function emptyWorld(map: MapDef = SMALL): World {
  const w = new World(map, map.teams, 3, [0, 0, 0]);
  w.units.length = 0;
  return w;
}

describe('case dorée', () => {
  it('apparaît à ~45 s, dure 30 s, puis revient environ toutes les 60 s', () => {
    const w = emptyWorld();
    const ev = tick(w, RHYTHM.goldenFirstAt - 0.5);
    expect(w.rhythm.golden).toBeNull();
    expect(ev.some((e) => e.kind === 'golden')).toBe(false);

    tick(w, 1, ev);
    const first = w.rhythm.golden;
    expect(first).not.toBeNull();
    expect(first!.isCamp).toBe(false);
    expect(ev.filter((e) => e.kind === 'golden').length).toBe(1);
    expect(w.rhythm.goldenLeft).toBeGreaterThan(RHYTHM.goldenDuration - 1);

    // Elle s'éteint au bout de 30 s.
    tick(w, RHYTHM.goldenDuration - 1, ev);
    expect(w.rhythm.golden).toBe(first);
    tick(w, 1.5, ev);
    expect(w.rhythm.golden).toBeNull();
    expect(ev.filter((e) => e.kind === 'goldenEnd').length).toBe(1);

    // La suivante arrive environ 60 s après le début de la première, sur une autre case.
    const start = RHYTHM.goldenFirstAt;
    const next = w.rhythm.nextGoldenAt;
    expect(next).toBeGreaterThanOrEqual(start + RHYTHM.goldenInterval - RHYTHM.goldenJitter - 0.1);
    expect(next).toBeLessThanOrEqual(start + RHYTHM.goldenInterval + RHYTHM.goldenJitter + 0.1);
    tick(w, next - w.time + 0.1, ev);
    expect(w.rhythm.golden).not.toBeNull();
    expect(w.rhythm.golden).not.toBe(first);
    expect(ev.filter((e) => e.kind === 'golden').length).toBe(2);
  });

  it('préfère une case centrale et disputée', () => {
    const w = emptyWorld();
    tick(w, RHYTHM.goldenFirstAt + 0.1);
    // La case du carreau, collée au bord de la cour, n'est jamais choisie en premier.
    expect(w.rhythm.golden!.suit).not.toBe('diamond');
  });

  it('son bonus compte double pour son propriétaire, puis redevient normal', () => {
    const w = emptyWorld();
    const heart = w.tiles.find((t) => t.suit === 'heart')!;
    const spade = w.tiles.find((t) => t.suit === 'spade')!;
    heart.owner = 1;
    spade.owner = 1;
    tick(w, 1 / 60);
    w.rhythm.nextGoldenAt = Infinity;
    // Même uniforme pour tous : l'équipe 0, sans case, donne les valeurs de base.
    const base = { ...w.mods[0] };
    const simpleHp = base.hp * (1 + SUIT_BONUS.heart.perTile);
    // Le cœur devient la seule candidate possible : toutes les autres cases bonus sont retirées.
    const others = w.tiles.filter((t) => !t.isCamp && t !== heart);
    for (const t of others) w.tiles.splice(w.tiles.indexOf(t), 1);
    w.tiles.push(spade); // le pique reste possédé, mais exclu du tirage
    w.rhythm.lastGolden = spade;
    w.rhythm.nextGoldenAt = w.time;
    tick(w, 1 / 60);
    expect(w.rhythm.golden).toBe(heart);
    expect(w.mods[1].suits.heart).toBe(RHYTHM.goldenMultiplier);
    expect(w.mods[1].suits.spade).toBe(1);
    expect(w.mods[1].hp).toBeCloseTo(base.hp * (1 + SUIT_BONUS.heart.perTile * RHYTHM.goldenMultiplier));
    expect(w.mods[1].dmg).toBeCloseTo(base.dmg * (1 + SUIT_BONUS.spade.perTile)); // le pique, lui, n'est pas doublé
    // Les autres équipes n'en profitent pas.
    expect(w.mods[0].suits.heart).toBe(0);
    expect(w.mods[0].hp).toBeCloseTo(base.hp);

    // Fin de la case dorée : retour au bonus simple.
    w.rhythm.nextGoldenAt = Infinity;
    tick(w, RHYTHM.goldenDuration + 0.1);
    expect(w.rhythm.golden).toBeNull();
    expect(w.mods[1].suits.heart).toBe(1);
    expect(w.mods[1].hp).toBeCloseTo(simpleHp);
  });

  it('les IA la jugent plus attirante, et le joueur est prévenu', () => {
    const w = emptyWorld();
    tick(w, RHYTHM.goldenFirstAt + 0.1);
    const g = w.rhythm.golden!;
    expect(goldenAiBonus(w, g)).toBeGreaterThan(0);
    expect(goldenAiBonus(w, w.tiles.find((t) => t !== g)!)).toBe(0);
    const text = rhythmAnnouncement({ kind: 'golden', team: NO_TEAM, tile: g }, 0);
    expect(text).toMatch(/^Case dorée !/);
  });
});

describe('équipe sans camp', () => {
  it('ses élèves perdent 1 PV par seconde jusqu’au KO', () => {
    const w = new World(SMALL, 3, 1, [0, 0, 0]);
    w.units.length = 0;
    w.camps[0].owner = 1; // l'équipe 0 perd son seul camp
    const u = w.spawnUnit(0, 4.5, 1.5, false);
    const hp0 = u.hp;
    const ev = tick(w, 5);
    expect(w.rhythm.starving[0]).toBe(true);
    expect(u.hp).toBeCloseTo(hp0 - 5 * RHYTHM.noCampDrainPerSec, 0);
    expect(ev.some((e) => e.kind === 'noCamp' && e.team === 0)).toBe(true);
    expect(rhythmAnnouncement({ kind: 'noCamp', team: 0 }, 0)).toContain('Plus de camp');
    expect(rhythmAnnouncement({ kind: 'noCamp', team: 1 }, 0)).toBeNull();
    // Jusqu'au bout : KO, puis l'équipe est éliminée.
    tick(w, hp0 / RHYTHM.noCampDrainPerSec + 3, ev);
    expect(w.teamUnitCount(0)).toBe(0);
    expect(w.stats()[0].alive).toBe(false);
  });

  it('pas de perte de PV tant que l’équipe garde un camp', () => {
    const w = new World(SMALL, 3, 1, [0, 0, 0]);
    w.units.length = 0;
    const u = w.spawnUnit(1, 4.5, 1.5, false); // loin de tout camp et de tout cœur
    const hp0 = u.hp;
    tick(w, 10);
    expect(w.rhythm.starving[1]).toBe(false);
    expect(u.hp).toBe(hp0);
  });

  it('un cœur possédé ne compense pas l’épuisement', () => {
    const w = new World(SMALL, 3, 1, [0, 0, 0]);
    w.units.length = 0;
    w.camps[0].owner = 1;
    const heart = w.tiles.find((t) => t.suit === 'heart')!;
    heart.owner = 0;
    const u = w.spawnUnit(0, heart.cx, heart.cy, false);
    const hp0 = u.hp;
    tick(w, 4);
    expect(u.hp).toBeLessThan(hp0);
  });
});
