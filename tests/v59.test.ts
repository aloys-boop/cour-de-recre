import { describe, expect, it } from 'vitest';
import { MAX_TEAMS, TEAM_NAMES, TEAM_PLURALS } from '../src/config';
import { FOG_INTERVAL } from '../src/core/fog';
import { chipCount, headcount } from '../src/core/headcount';
import type { MapDef } from '../src/core/types';
import { stepText, TUTORIAL_MAP, TUTORIAL_STEPS, TutorialState, UPGRADE_BUY_TEXT } from '../src/core/tutorial';
import { World } from '../src/core/world';
import { candidateSpots, overlap, pickSpot, spotCost, type Avoid } from '../src/ui/bubble-place';

/** Couleurs comme les attribue Game : celle du joueur d'abord, puis les autres dans l'ordre. */
function colorsFor(player: number): number[] {
  return [player, ...Array.from({ length: MAX_TEAMS }, (_, c) => c).filter((c) => c !== player)];
}

describe('v5.9 : tutoriel, nom de l’adversaire', () => {
  it('quelle que soit la couleur du joueur, l’adversaire a une autre couleur et chaque texte le nomme correctement', () => {
    for (let pc = 0; pc < MAX_TEAMS; pc++) {
      const w = new World(TUTORIAL_MAP, 2, 1, colorsFor(pc));
      const t = new TutorialState(w, 0);
      expect(t.enemyColor).not.toBe(pc);
      const enemy = TEAM_PLURALS[t.enemyColor];
      let named = 0;
      for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
        t.index = i;
        const text = t.text;
        expect(text).not.toMatch(/\{|\}/);
        expect(text.length).toBeLessThanOrEqual(90);
        // Aucune autre couleur que celle de l'adversaire réel n'est citée.
        for (let c = 0; c < MAX_TEAMS; c++) {
          if (c === t.enemyColor) continue;
          expect(text).not.toMatch(new RegExp(`\\b(${TEAM_PLURALS[c]}|${TEAM_NAMES[c]})\\b`));
        }
        if (text.includes(enemy)) named++;
      }
      expect(named).toBe(2); // « Des … arrivent ! » et « prends le camp des … »
    }
  });

  it('textes générés : « Des Rouges arrivent ! », « le camp des Rouges »', () => {
    const attack = TUTORIAL_STEPS.find((s) => s.id === 'attack')!;
    const win = TUTORIAL_STEPS.find((s) => s.id === 'win')!;
    expect(stepText(attack, 4)).toMatch(/^Des Rouges arrivent !/);
    expect(stepText(win, 4)).toBe('Dernière étape : prends le camp des Rouges pour gagner !');
    expect(stepText(win, 0)).toMatch(/camp des Noirs/);
    expect(UPGRADE_BUY_TEXT).toMatch(/Production/);
    expect(UPGRADE_BUY_TEXT.length).toBeLessThanOrEqual(90);
  });
});

describe('v5.9 : placement de la bulle du tutoriel', () => {
  const view = { w: 844, h: 390 };
  const size = { w: 440, h: 77 };
  const spots = candidateSpots(view, size, 56, { l: 8, r: 8, b: 8 });

  it('places candidates dans l’écran, en haut au centre d’abord', () => {
    expect(spots[0]).toEqual({ id: 'haut-centre', x: 202, y: 56 });
    for (const s of spots) {
      expect(s.x).toBeGreaterThanOrEqual(8);
      expect(s.x + size.w).toBeLessThanOrEqual(view.w - 8);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y + size.h).toBeLessThanOrEqual(view.h - 8);
    }
  });

  it('rien à éviter : en haut au centre', () => {
    expect(pickSpot(spots, size, []).id).toBe('haut-centre');
  });

  it('le bouton « Améliorer » sous la bulle : elle part ailleurs et ne le cache plus', () => {
    // Panneau du camp quasi plein écran, bouton de Production et main en haut à gauche du centre.
    const target: Avoid = { x: 290, y: 92, w: 96, h: 32, weight: 10 };
    const hand: Avoid = { x: 300, y: 68, w: 84, h: 98, weight: 10 };
    const panel: Avoid = { x: 70, y: 6, w: 766, h: 378, weight: 1 };
    const best = pickSpot(spots, size, [target, hand, panel]);
    expect(best.id).not.toBe('haut-centre');
    const r = { x: best.x, y: best.y, ...size };
    expect(overlap(r, target)).toBe(0);
    expect(overlap(r, hand)).toBe(0);
  });

  it('ne sautille pas : garde sa place tant qu’elle n’est pas nettement pire', () => {
    const small: Avoid = { x: 630, y: 120, w: 40, h: 20, weight: 3 }; // effleure le bas-droit d'une place
    const cur = spots.find((s) => s.id === 'bas-centre')!;
    expect(spotCost(cur, size, [small])).toBe(0);
    expect(pickSpot(spots, size, [small], 'bas-centre').id).toBe('bas-centre');
    // Mais si la main arrive dessus, elle bouge.
    const hand: Avoid = { x: cur.x + 100, y: cur.y, w: 84, h: 98, weight: 10 };
    expect(pickSpot(spots, size, [hand], 'bas-centre').id).not.toBe('bas-centre');
  });
});

/** Cour 20 × 20 : le joueur (0) au nord, deux adversaires loin. */
const COUR: MapDef = {
  id: 'compteur',
  name: 'Compteur',
  w: 20,
  h: 20,
  teams: 3,
  unitCap: 25,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 18, y: 18, owner: 1 },
    { kind: 'camp', x: 0, y: 18, owner: 2 },
    { kind: 'bonus', x: 15, y: 4, suit: 'heart' },
  ],
};

describe('v5.9 : compteur d’élèves', () => {
  function setup(fog: boolean): World {
    const w = new World(COUR, 3, 3);
    w.rules = { mode: 'classique', fog };
    for (let i = 0; i < 4; i++) w.spawnUnit(0, 10.5 + i * 0.2, 10.5, false);
    w.spawnUnit(1, 12, 10.5, false); // à 1,5 case : visible
    w.spawnUnit(1, 17, 17, false); // loin : caché
    w.spawnUnit(1, 16.5, 17, false);
    w.spawnUnit(2, 2, 17, false);
    return w;
  }

  it('sans brouillard : tout se compte, le joueur voit « élèves / plafond »', () => {
    const w = setup(false);
    const h = headcount(w, 0);
    expect(h.fog).toBe(false);
    expect(h.mine).toBe(4);
    expect(h.cap).toBe(25);
    expect(chipCount(h, 0)).toBe('4/25');
    expect(h.rows.map((r) => r.units)).toEqual([4, 3, 1]);
    expect(h.rows.every((r) => r.known)).toBe(true);
    expect(h.rows.map((r) => r.camps)).toEqual([1, 1, 1]);
    expect(chipCount(h, 1)).toBe('3');
  });

  it('avec brouillard : seuls les ennemis visibles comptent, et c’est indiqué', () => {
    const w = setup(true);
    w.time += FOG_INTERVAL;
    const h = headcount(w, 0);
    expect(h.fog).toBe(true);
    expect(h.rows[0]).toMatchObject({ isPlayer: true, known: true, units: 4 });
    expect(h.rows[1]).toMatchObject({ known: false, units: 1 });
    expect(h.rows[2]).toMatchObject({ known: false, units: 0 });
    // Camps jamais vus : inconnus (0), pas de triche.
    expect(h.rows[1].camps).toBe(0);
    expect(chipCount(h, 1)).toBe('1');
  });

  it('un allié est toujours connu en entier, même sous le brouillard', () => {
    const w = setup(true);
    w.setAllied(0, 1, true);
    w.time += FOG_INTERVAL;
    const h = headcount(w, 0);
    expect(h.rows[1]).toMatchObject({ ally: true, known: true, units: 3, camps: 1 });
  });

  it('les pions ne comptent pas comme élèves', () => {
    const w = setup(false);
    const before = headcount(w, 0).rows[1].units;
    const p = w.spawnUnit(1, 15, 15, false);
    p.pion = true;
    expect(headcount(w, 0).rows[1].units).toBe(before);
  });
});

describe('v5.9 : « Comment jouer »', () => {
  it('explique les effectifs (puce, maximum, œil du brouillard, détail)', async () => {
    const { HOW_TO } = await import('../src/ui/overlay');
    const text = HOW_TO.find(([t]) => t === 'Effectifs')?.[1] ?? '';
    expect(text).toMatch(/maximum/);
    expect(text).toMatch(/œil/);
    expect(text).toMatch(/Touche ta puce/);
  });
});
