/**
 * v5.26, saison 2, « Performances c » : garde-fou de fluidité. Saccades durables → un cran plus
 * léger (effets, puis résolution) ; fluidité durable → on retente le cran supérieur, avec un délai
 * qui double à chaque rechute ; rien n'est jugé en pause ; réglage mémorisé, ancienne sauvegarde = activé.
 */
import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../src/config';
import type { FrameStats } from '../src/core/frame-meter';
import { QUALITY, QualityGovernor, dprCap, lightEffects, qualityLabel } from '../src/core/quality';
import { loadProgress, saveProgress } from '../src/core/save';
import { Effects } from '../src/render/effects';
import type { Camera } from '../src/render/camera';

const base: FrameStats = { frames: 240, fps: 60, medianInterval: 16.7, dropped: 0, droppedShare: 0, work: 3, sim: 1, render: 2, workP95: 4, workWorst: 6 };
const FLUIDE = base;
const SACCADE: FrameStats = { ...base, fps: 40, dropped: 60, droppedShare: 0.2 };
const JUSTE: FrameStats = { ...base, workP95: 12 };

/** Fait vivre le garde-fou `s` secondes à 60 i/s ; renvoie les changements de cran. */
function run(g: QualityGovernor, s: number, stats: FrameStats, running = true) {
  const out: Array<{ level: number; dir: string; at: number }> = [];
  for (let t = 0; t < s; t += 1 / 60) {
    const ch = g.update(1 / 60, running, () => stats);
    if (ch) out.push({ ...ch, at: t });
  }
  return out;
}

function memoryStore(init: Record<string, string> = {}) {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}

describe('garde-fou de fluidité', () => {
  it('reste au complet tant que tout est fluide ou juste', () => {
    const g = new QualityGovernor();
    expect(run(g, 30, FLUIDE)).toEqual([]);
    expect(run(g, 30, JUSTE)).toEqual([]);
    expect(g.level).toBe(0);
  });

  it('descend d’un cran après 2 s de saccades, puis laisse 3 s au nouveau cran, jamais sous le cran 2', () => {
    const g = new QualityGovernor();
    const ch = run(g, 20, SACCADE);
    expect(ch.map((c) => c.level)).toEqual([1, 2]);
    expect(ch[0].at).toBeGreaterThanOrEqual(QUALITY.downAfter - 0.05);
    expect(ch[0].at).toBeLessThan(QUALITY.downAfter + 0.6);
    // Entre deux crans : le temps de se mesurer, plus 2 s de saccades.
    expect(ch[1].at - ch[0].at).toBeGreaterThanOrEqual(QUALITY.settle + QUALITY.downAfter - 0.05);
    expect(g.level).toBe(2);
    expect(g.downs).toBe(2);
  });

  it('une saccade brève n’allège rien', () => {
    const g = new QualityGovernor();
    for (let i = 0; i < 5; i++) {
      run(g, 1, SACCADE);
      run(g, 1, FLUIDE);
    }
    expect(g.level).toBe(0);
  });

  it('rien n’est jugé en pause, ni avant une seconde de mesure, ni désactivé', () => {
    const g = new QualityGovernor();
    expect(run(g, 20, SACCADE, false)).toEqual([]);
    expect(run(g, 20, { ...SACCADE, frames: 30 })).toEqual([]);
    g.enabled = false;
    expect(run(g, 20, SACCADE)).toEqual([]);
    expect(g.level).toBe(0);
  });

  it('remonte après 15 s de fluidité, et attend deux fois plus après une rechute', () => {
    const g = new QualityGovernor();
    run(g, 3, SACCADE);
    expect(g.level).toBe(1);
    const up = run(g, 25, FLUIDE);
    expect(up.map((c) => [c.level, c.dir])).toEqual([[0, 'up']]);
    expect(up[0].at).toBeGreaterThanOrEqual(QUALITY.upAfter + 1);
    // Rechute aussitôt (le cran remonté se mesure d'abord 3 s) : on redescend, et la prochaine remontée exige 30 s.
    run(g, QUALITY.settle + 3, SACCADE);
    expect(g.level).toBe(1);
    expect(g.upDelay).toBe(QUALITY.upAfter * 2);
    expect(run(g, QUALITY.settle + QUALITY.upAfter + 1, FLUIDE)).toEqual([]);
    expect(run(g, QUALITY.upAfter + 1, FLUIDE).map((c) => c.level)).toEqual([0]);
  });

  it('le délai de remontée plafonne à 2 minutes', () => {
    const g = new QualityGovernor();
    for (let i = 0; i < 8; i++) {
      run(g, QUALITY.settle + 3, SACCADE);
      run(g, QUALITY.settle + g.upDelay + 1, FLUIDE);
    }
    expect(g.upDelay).toBe(QUALITY.upAfterMax);
  });

  it('« juste » ne fait ni descendre ni remonter', () => {
    const g = new QualityGovernor();
    run(g, 3, SACCADE);
    expect(run(g, 60, JUSTE)).toEqual([]);
    expect(g.level).toBe(1);
  });

  it('désactivé en cours de route : retour immédiat au complet', () => {
    const g = new QualityGovernor();
    run(g, 20, SACCADE);
    expect(g.setEnabled(false)).toEqual({ level: 0, dir: 'up' });
    expect(g.level).toBe(0);
    expect(g.setEnabled(true)).toBeNull();
  });

  it('crans : effets allégés dès 1, image ×1,5 au cran 2, libellés français', () => {
    expect([0, 1, 2].map((l) => lightEffects(l as 0))).toEqual([false, true, true]);
    expect([0, 1, 2].map((l) => dprCap(l as 0))).toEqual([2, 2, 1.5]);
    expect(qualityLabel(0)).toBe('tous les effets');
    expect(qualityLabel(1)).toBe('effets allégés');
    expect(qualityLabel(2)).toBe('effets allégés, image ×1,5');
  });
});

describe('effets allégés', () => {
  const CAM = { gridToScreen: (x: number, y: number) => ({ x: 100 + x, y: 100 + y }), viewW: 800, viewH: 400, zoom: 1 } as unknown as Camera;
  const active = (fx: Effects) => (fx as unknown as { popups: Array<{ active: boolean; word: number }> }).popups.filter((p) => p.active);

  it('plus de « Paf ! » sur les coups, mais les KO et « Paré ! » restent', () => {
    const full = new Effects(() => 0.01);
    full.onEvent({ kind: 'hit', x: 1, y: 1 } as never, CAM);
    expect(active(full).length).toBe(1);
    const light = new Effects(() => 0.01);
    light.light = true;
    light.onEvent({ kind: 'hit', x: 1, y: 1 } as never, CAM);
    expect(active(light).length).toBe(0);
    light.onEvent({ kind: 'hit', x: 1, y: 1, parried: true } as never, CAM);
    light.onEvent({ kind: 'ko', x: 2, y: 2, team: 1 } as never, CAM);
    expect(active(light).length).toBe(2);
  });
});

describe('sauvegarde : « Allègement auto »', () => {
  it('absent = activé ; désactivé, il le reste', () => {
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ unlocked: 2, wins: {}, muted: false, lastTeam: 1, lastDifficulty: 'normal', difficultyScale: 2 }) });
    const p = loadProgress(store);
    expect(p.autoQuality).toBe(true);
    saveProgress({ ...p, autoQuality: false }, store);
    expect(loadProgress(store).autoQuality).toBe(false);
  });
});
