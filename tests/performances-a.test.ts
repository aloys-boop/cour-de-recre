/** v5.24, saison 2 « Performances a » : compteur d’images (fenêtre glissante, images sautées, verdict). */
import { describe, expect, it } from 'vitest';
import { FRAME_BUDGET_MS, FrameMeter, frameVerdict, meterLabel, VERDICT_COLORS, WORK_TARGET_MS } from '../src/core/frame-meter';
import { loadProgress } from '../src/core/save';

const feed = (m: FrameMeter, n: number, interval: number, sim = 1, render = 2) => {
  for (let i = 0; i < n; i++) m.record({ interval, sim, render });
};

describe('compteur d’images', () => {
  it('vide : rien à dire, verdict fluide, libellé d’attente', () => {
    const m = new FrameMeter();
    expect(m.stats().frames).toBe(0);
    expect(frameVerdict(m.stats())).toBe('fluide');
    expect(meterLabel(m.stats())).toBe('… i/s');
  });

  it('60 images régulières : 60 i/s, rien de sauté, travail moyen', () => {
    const m = new FrameMeter();
    feed(m, 120, FRAME_BUDGET_MS, 1, 2.2);
    const s = m.stats();
    expect(Math.round(s.fps)).toBe(60);
    expect(s.dropped).toBe(0);
    expect(s.work).toBeCloseTo(3.2, 5);
    expect(s.sim).toBeCloseTo(1, 5);
    expect(s.render).toBeCloseTo(2.2, 5);
    expect(frameVerdict(s)).toBe('fluide');
    expect(meterLabel(s)).toBe('60 i/s · 3,2 ms');
  });

  it('écran 120 Hz : l’intervalle médian sert de référence, rien n’est compté comme sauté', () => {
    const m = new FrameMeter();
    feed(m, 200, 1000 / 120);
    const s = m.stats();
    expect(Math.round(s.fps)).toBe(120);
    expect(s.medianInterval).toBeCloseTo(1000 / 120, 5);
    expect(s.dropped).toBe(0);
  });

  it('images sautées : un intervalle double en perd une, triple en perd deux', () => {
    const m = new FrameMeter();
    feed(m, 100, FRAME_BUDGET_MS);
    m.record({ interval: 2 * FRAME_BUDGET_MS, sim: 1, render: 2 });
    m.record({ interval: 3 * FRAME_BUDGET_MS, sim: 1, render: 2 });
    const s = m.stats();
    expect(s.dropped).toBe(3);
    expect(s.droppedShare).toBeCloseTo(3 / 105, 5);
  });

  it('verdict : juste au-delà de la moitié du budget, saccadé au-delà du budget ou à 10 % d’images sautées', () => {
    const juste = new FrameMeter();
    feed(juste, 100, FRAME_BUDGET_MS, 4, WORK_TARGET_MS - 3);
    expect(frameVerdict(juste.stats())).toBe('juste');
    const lourd = new FrameMeter();
    feed(lourd, 100, FRAME_BUDGET_MS, 8, 10);
    expect(frameVerdict(lourd.stats())).toBe('saccade');
    const saute = new FrameMeter();
    feed(saute, 60, FRAME_BUDGET_MS);
    feed(saute, 10, 2 * FRAME_BUDGET_MS);
    expect(frameVerdict(saute.stats())).toBe('saccade');
    const peu = new FrameMeter();
    feed(peu, 100, FRAME_BUDGET_MS);
    feed(peu, 4, 2 * FRAME_BUDGET_MS);
    expect(frameVerdict(peu.stats())).toBe('juste');
    expect(new Set(Object.values(VERDICT_COLORS)).size).toBe(3);
  });

  it('fenêtre glissante : seules les dernières images comptent', () => {
    const m = new FrameMeter(60);
    feed(m, 60, 2 * FRAME_BUDGET_MS, 9, 9);
    feed(m, 60, FRAME_BUDGET_MS, 1, 1);
    const s = m.stats();
    expect(m.size).toBe(60);
    expect(Math.round(s.fps)).toBe(60);
    expect(s.work).toBeCloseTo(2, 5);
  });

  it('un onglet revenu de veille ou un intervalle absurde ne fausse rien', () => {
    const m = new FrameMeter();
    feed(m, 30, FRAME_BUDGET_MS);
    m.record({ interval: 5000, sim: 1, render: 1 });
    m.record({ interval: 0, sim: 1, render: 1 });
    m.record({ interval: Number.NaN, sim: 1, render: 1 });
    m.record({ interval: -3, sim: 1, render: 1 });
    expect(m.size).toBe(30);
    expect(m.stats().dropped).toBe(0);
    m.reset();
    expect(m.size).toBe(0);
  });

  it('95e centile et pire image', () => {
    const m = new FrameMeter();
    feed(m, 95, FRAME_BUDGET_MS, 1, 1);
    feed(m, 5, FRAME_BUDGET_MS, 6, 6);
    const s = m.stats();
    expect(s.workP95).toBe(12);
    expect(s.workWorst).toBe(12);
  });

  it('sauvegarde : réglage absent = masqué, ancienne sauvegarde compatible', () => {
    const store = (v: object) => ({ getItem: () => JSON.stringify(v), setItem: () => {} });
    expect(loadProgress(store({ unlocked: 2, wins: {} })).meter).toBe(false);
    expect(loadProgress(store({ unlocked: 2, wins: {}, meter: true })).meter).toBe(true);
    expect(loadProgress(store({ unlocked: 2, wins: {}, meter: 'oui' })).meter).toBe(false);
  });
});
