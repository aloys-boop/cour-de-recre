import { describe, expect, it } from 'vitest';
import { HUMAN_ATTENTION } from '../src/config';
import { loadProgress } from '../src/core/save';
import { attentionAtSpeed, sanitizeSpeed, speedFactor, TacticalPause, tempoAllowed } from '../src/core/tempo';

const store = (v: unknown) => ({ getItem: () => JSON.stringify(v), setItem: () => undefined });

describe('rythme réglable (1.6, v5.14)', () => {
  it('vitesse lente et pause tactique : Facile et Normal seulement, jamais dans le tutoriel', () => {
    expect(tempoAllowed('facile')).toBe(true);
    expect(tempoAllowed('normal')).toBe(true);
    expect(tempoAllowed('difficile')).toBe(false);
    expect(tempoAllowed('expert')).toBe(false);
    expect(tempoAllowed('facile', true)).toBe(false);
  });

  it('facteur de vitesse : 0,75 en lente, 1 sinon et toujours 1 en Difficile et Expert', () => {
    expect(speedFactor('lente', 'normal')).toBe(0.75);
    expect(speedFactor('lente', 'facile')).toBe(0.75);
    expect(speedFactor('normale', 'normal')).toBe(1);
    expect(speedFactor('lente', 'difficile')).toBe(1);
    expect(speedFactor('lente', 'expert')).toBe(1);
    expect(speedFactor('lente', 'normal', true)).toBe(1);
  });

  it('réglage de vitesse lu prudemment', () => {
    expect(sanitizeSpeed('lente')).toBe('lente');
    expect(sanitizeSpeed('turbo')).toBe('normale');
    expect(sanitizeSpeed(undefined)).toBe('normale');
  });

  it('attention humaine en temps de jeu : plus d’ordres par minute de jeu, réactions plus courtes', () => {
    const a = attentionAtSpeed(HUMAN_ATTENTION, 0.75);
    expect(a.ordersPerMin).toBeCloseTo(HUMAN_ATTENTION.ordersPerMin / 0.75);
    expect(a.threatDelay).toBeCloseTo(HUMAN_ATTENTION.threatDelay * 0.75);
    expect(a.fronts).toBe(HUMAN_ATTENTION.fronts);
    expect(attentionAtSpeed(HUMAN_ATTENTION, 1)).toEqual(HUMAN_ATTENTION);
    expect(attentionAtSpeed(HUMAN_ATTENTION, 0)).toEqual(HUMAN_ATTENTION);
  });

  it('pause tactique : bascule, compte les pauses et le temps figé', () => {
    const p = new TacticalPause(true);
    expect(p.toggle()).toBe(true);
    p.tick(1.5);
    expect(p.set(true)).toBe(true); // déjà figée : ne compte pas deux fois
    expect(p.toggle()).toBe(false);
    p.tick(3); // pas figée : pas compté
    p.toggle();
    expect(p.count).toBe(2);
    expect(p.realSeconds).toBeCloseTo(1.5);
  });

  it('pause tactique interdite : jamais active', () => {
    const p = new TacticalPause(false);
    expect(p.toggle()).toBe(false);
    expect(p.active).toBe(false);
    expect(p.count).toBe(0);
  });

  it('sauvegardes : anciennes compatibles (vitesse normale, bouton affiché), réglages relus', () => {
    const old = loadProgress(store({ unlocked: 2, wins: {}, muted: false, lastTeam: 3, lastDifficulty: 'normal', difficultyScale: 2 }));
    expect(old.speed).toBe('normale');
    expect(old.tacticalPause).toBe(true);
    expect(old.lastDifficulty).toBe('normal');
    const neu = loadProgress(store({ unlocked: 2, wins: {}, muted: false, lastTeam: 3, lastDifficulty: 'normal', difficultyScale: 2, speed: 'lente', tacticalPause: false }));
    expect(neu.speed).toBe('lente');
    expect(neu.tacticalPause).toBe(false);
  });
});
