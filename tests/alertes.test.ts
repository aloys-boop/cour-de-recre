// v5.7 : alertes (case attaquée, case perdue, camp en danger), regroupées pour ne pas noyer le joueur.
import { describe, expect, it } from 'vitest';
import { ALERTS, AlertWatcher, type Alert } from '../src/core/alerts';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const MAP: MapDef = {
  id: 'alertes',
  name: 'Alertes',
  w: 20,
  h: 20,
  teams: 3,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 18, y: 18, owner: 1 },
    { kind: 'camp', x: 0, y: 18, owner: 2 },
    { kind: 'bonus', x: 9, y: 2, suit: 'heart', owner: 0 },
    { kind: 'bonus', x: 2, y: 9, suit: 'spade', owner: 0 },
    { kind: 'bonus', x: 14, y: 4, suit: 'club', owner: 0 },
  ],
};

/** Simulation figée (élèves immobiles) : on avance l'horloge et on interroge les alertes. */
function setup() {
  const w = new World(MAP, 3, 1);
  const a = new AlertWatcher(w, 0);
  const out: Alert[] = [];
  const run = (s: number) => {
    const dt = 1 / 20;
    for (let t = 0; t < s; t += dt) {
      w.time += dt;
      const r = a.update(dt);
      if (r) out.push(r);
    }
  };
  const tile = (suit: string) => w.tiles.find((t) => t.suit === suit)!;
  return { w, a, out, run, tile };
}

describe('alertes', () => {
  it('un ennemi qui passe ne déclenche rien ; une menace qui dure, si (une seule fois)', () => {
    const { w, out, run, tile } = setup();
    const heart = tile('heart');
    const u = w.spawnUnit(1, heart.cx + 0.5, heart.cy, false);
    run(ALERTS.delay - 0.4);
    expect(out).toEqual([]);
    run(0.8);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'attaque', count: 1, x: heart.cx, y: heart.cy, text: 'Case ♥ attaquée' });
    run(20);
    expect(out).toHaveLength(1); // pas de répétition pendant la même attaque
    // Calme, puis nouvelle attaque : nouvelle alerte.
    u.x = 15;
    u.y = 15;
    run(ALERTS.calm + 0.5);
    u.x = heart.cx;
    u.y = heart.cy;
    run(ALERTS.delay + 0.5);
    expect(out).toHaveLength(2);
  });

  it('les alliés ne menacent pas', () => {
    const { w, out, run, tile } = setup();
    w.setAllied(0, 1, true);
    w.spawnUnit(1, tile('heart').cx, tile('heart').cy, false);
    run(5);
    expect(out).toEqual([]);
  });

  it('camp en danger avant tout ; plusieurs attaques au même moment sont regroupées', () => {
    const { w, out, run, tile } = setup();
    const camp = w.tiles[0];
    w.spawnUnit(2, tile('heart').cx, tile('heart').cy, false);
    w.spawnUnit(2, tile('spade').cx, tile('spade').cy, false);
    w.spawnUnit(1, camp.cx + 0.3, camp.cy + 0.3, false);
    run(ALERTS.delay + 0.5);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('camp');
    expect(out[0].count).toBe(3);
    expect(out[0]).toMatchObject({ x: camp.cx, y: camp.cy });
    expect(out[0].text).toBe('Ton camp est attaqué, et 2 autres cases !');
  });

  it('deux alertes sont espacées d’au moins 6 s ; une case perdue est signalée', () => {
    const { w, out, run, tile } = setup();
    w.spawnUnit(2, tile('heart').cx, tile('heart').cy, false);
    run(ALERTS.delay + 0.5);
    expect(out).toHaveLength(1);
    // Nouvelle attaque juste après : attend la fin du délai, puis sort seule.
    w.spawnUnit(1, tile('club').cx, tile('club').cy, false);
    run(1.5);
    expect(out).toHaveLength(1);
    run(ALERTS.minGap);
    expect(out).toHaveLength(2);
    expect(out[1].text).toBe('Case ♣ attaquée');
    // La case ♥ tombe.
    tile('heart').owner = 2;
    run(ALERTS.minGap + 0.5);
    expect(out[2]).toMatchObject({ kind: 'perdue', count: 1, text: 'Case ♥ perdue' });
    // Un camp perdu.
    w.tiles[0].owner = 1;
    run(ALERTS.minGap + 0.5);
    expect(out[3]).toMatchObject({ kind: 'perdue', text: 'Camp perdu !' });
  });

  it('une case neutre (jamais à nous) ne déclenche rien', () => {
    const { w, out, run } = setup();
    w.spawnUnit(1, 10, 10, false);
    run(5);
    expect(out).toEqual([]);
  });
});

describe('« Comment jouer » (v5.7)', () => {
  it('explique le bandeau d’alerte', async () => {
    const { HOW_TO } = await import('../src/ui/overlay');
    expect(HOW_TO.find(([t]) => t === 'Alertes')?.[1]).toMatch(/Touche-le pour y aller/);
  });
});
