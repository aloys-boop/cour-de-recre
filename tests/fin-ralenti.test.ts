// @vitest-environment jsdom
/** Fin de partie mise en scène et écran de fin vivant (v5.21) : logique pure et tableau. */
import { describe, expect, it } from 'vitest';
import { bestIndex, countUp, FINALE, FinaleTracker, finaleBars, finaleFocus, finalBlowLine, finaleStamp, finaleTimeScale, finaleTitle } from '../src/core/finale';
import { endStats, GameStats } from '../src/core/stats';
import { Overlay } from '../src/ui/overlay';
import type { World } from '../src/core/world';

describe('coup décisif', () => {
  it('un camp pris récemment passe avant le dernier KO, un coup vu avant un coup caché', () => {
    const tr = new FinaleTracker();
    tr.note({ kind: 'ko', x: 1, y: 1, team: 1, by: 0 }, 10, true);
    tr.note({ kind: 'captured', x: 5, y: 5, team: 0, camp: true }, 11, true);
    tr.note({ kind: 'ko', x: 2, y: 2, team: 1, by: 0 }, 12, true);
    expect(tr.decisive(12.1)).toMatchObject({ kind: 'camp', x: 5, y: 5 });
    // Une case bonus prise ne compte pas.
    const t2 = new FinaleTracker();
    t2.note({ kind: 'captured', x: 5, y: 5, team: 0, camp: false }, 11, true);
    t2.note({ kind: 'ko', x: 2, y: 2, team: 1, by: 0 }, 12, true);
    expect(t2.decisive(12)).toMatchObject({ kind: 'ko', x: 2 });
    // Camp caché sous le brouillard, KO vu : le KO.
    const t3 = new FinaleTracker();
    t3.note({ kind: 'captured', x: 5, y: 5, team: 2, camp: true }, 11, false);
    t3.note({ kind: 'ko', x: 2, y: 2, team: 1, by: 0 }, 11.5, true);
    expect(t3.decisive(12)).toMatchObject({ kind: 'ko' });
    // Un KO caché au même instant ne remplace pas un KO vu.
    t3.note({ kind: 'ko', x: 9, y: 9, team: 2, by: 1 }, 11.6, false);
    expect(t3.decisive(12)).toMatchObject({ x: 2 });
  });

  it('rien de récent : pas de coup décisif (la caméra ne bouge pas)', () => {
    const tr = new FinaleTracker();
    expect(tr.decisive(30)).toBeNull();
    tr.note({ kind: 'ko', x: 1, y: 1, team: 1, by: 0 }, 10, true);
    expect(tr.decisive(10 + FINALE.window + 0.1)).toBeNull();
  });
});

describe('ralenti, caméra et tampon', () => {
  it('le temps tourne au ralenti puis relâche, sans jamais dépasser la moitié', () => {
    expect(finaleTimeScale(0)).toBe(FINALE.slow);
    expect(finaleTimeScale(FINALE.seconds * 0.5)).toBe(FINALE.slow);
    let prev = 0;
    for (let t = 0; t <= FINALE.seconds; t += 0.05) {
      const s = finaleTimeScale(t);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(s).toBeLessThanOrEqual(FINALE.releaseTo + 1e-9);
      prev = s;
    }
    expect(finaleTimeScale(FINALE.seconds)).toBeCloseTo(FINALE.releaseTo);
  });

  it('la caméra arrive en douceur, les bandes de cinéma se posent, le tampon tombe puis se pose', () => {
    expect(finaleFocus(0)).toBe(0);
    expect(finaleFocus(FINALE.focusSeconds)).toBe(1);
    expect(finaleFocus(FINALE.focusSeconds / 2)).toBeCloseTo(0.5);
    expect(finaleBars(0)).toBe(0);
    expect(finaleBars(1)).toBeCloseTo(0.085);
    expect(finaleStamp(0).alpha).toBe(0);
    const mid = finaleStamp(0.3);
    expect(mid.alpha).toBeGreaterThan(0);
    expect(mid.scale).toBeLessThan(2.2);
    // Petit écrasement sous 1 avant de se poser.
    expect(finaleStamp(0.34).scale).toBeLessThan(1);
    expect(finaleStamp(1)).toEqual({ scale: 1, alpha: 1 });
    // Le tampon est posé bien avant la fin du ralenti : il se lit.
    expect(0.15 + 0.36).toBeLessThan(FINALE.seconds / 2);
  });

  it('titres du tampon', () => {
    expect(finaleTitle('victoire')).toBe('Victoire !');
    expect(finaleTitle('victoire', true)).toBe('Victoire de l’équipe !');
    expect(finaleTitle('defaite')).toBe('Défaite…');
  });
});

describe('écran de fin vivant', () => {
  const colors = [3, 1, 2];
  it('ligne « Dernier coup » selon qui frappe et qui tombe', () => {
    const ko = (team: number, by?: number) => ({ kind: 'ko' as const, x: 0, y: 0, team, by, time: 0, seen: true });
    expect(finalBlowLine(ko(1, 0), 0, colors)).toBe('Dernier coup : tu mets KO un élève des Verts.');
    expect(finalBlowLine(ko(0, 2), 0, colors)).toBe('Dernier coup : les Jaunes mettent KO un de tes élèves.');
    expect(finalBlowLine(ko(2, 1), 0, colors)).toBe('Dernier coup : les Verts mettent KO un élève des Jaunes.');
    expect(finalBlowLine(ko(1), 0, colors)).toBe('Dernier coup : un élève des Verts tombe KO.');
    expect(finalBlowLine({ kind: 'camp', x: 0, y: 0, team: 0, time: 0, seen: true }, 0, colors)).toBe('Dernier coup : tu prends un camp.');
    expect(finalBlowLine({ kind: 'camp', x: 0, y: 0, team: 2, time: 0, seen: true }, 0, colors)).toBe('Dernier coup : les Jaunes prennent un camp.');
    expect(finalBlowLine(null, 0, colors)).toBeNull();
  });

  it('meilleur score unique et non nul seulement', () => {
    expect(bestIndex([3, 9, 4])).toBe(1);
    expect(bestIndex([5, 5, 1])).toBe(-1);
    expect(bestIndex([0, 0])).toBe(-1);
    expect(bestIndex([])).toBe(-1);
  });

  it('les compteurs montent de 0 à leur valeur, sans la dépasser', () => {
    expect(countUp(12, 0)).toBe(0);
    let prev = 0;
    for (let t = 0; t <= 0.8; t += 0.05) {
      const v = countUp(12, t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(12);
      prev = v;
    }
    expect(countUp(12, 0.7)).toBe(12);
    expect(countUp(0, 0.1)).toBe(0);
  });

  it('tableau : valeurs finales tout de suite, étoiles des meilleurs, ligne « Dernier coup », durée arrêtée', () => {
    const stats = new GameStats(2);
    stats.teams[0] = { produced: 8, koDealt: 9, koTaken: 4, captured: 3 };
    stats.teams[1] = { produced: 6, koDealt: 4, koTaken: 9, captured: 3 };
    const world = { numTeams: 2, teamColors: [3, 1], time: 140, rules: {} } as unknown as World;
    const s = endStats(stats, world, 0, 0, 125);
    expect(s.duration).toBe(125);
    const root = document.createElement('div');
    new Overlay(root).end(true, 'Le Préau', {
      nextAvailable: false,
      onReplay: () => {},
      onNext: () => {},
      onMenu: () => {},
      stats: { ...s, finalBlow: 'Dernier coup : tu mets KO un élève des Verts.' },
    });
    const rows = [...root.querySelectorAll('.end-stats tr')].slice(1);
    expect([...rows[0].querySelectorAll('td')].slice(1).map((td) => td.textContent)).toEqual(['8', '9', '4', '3']);
    // Étoile : KO infligés du joueur ; cases prises à égalité, pas d'étoile.
    expect(rows[0].querySelectorAll('td.best').length).toBe(1);
    expect(rows[0].querySelectorAll('td')[2].classList.contains('best')).toBe(true);
    expect(rows[1].querySelectorAll('td.best').length).toBe(0);
    expect((rows[1] as HTMLElement).style.getPropertyValue('--i')).toBe('1');
    expect(root.querySelector('.end-duration')!.textContent).toBe('Durée de la partie : 2 min 05 s');
    expect(root.querySelector('.end-blow')!.textContent).toMatch(/Dernier coup/);
  });
});
