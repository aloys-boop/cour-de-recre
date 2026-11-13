/**
 * Rythme réglable (1.6, v5.14) : vitesse de jeu et pause tactique.
 *
 * Sur un téléphone, un humain donne quelques ordres par minute de temps réel. Ralentir la
 * partie lui donne plus d'ordres par minute de jeu ; la pause tactique fige la cour pendant
 * qu'il donne ses ordres. Les deux sont réservés à Facile et Normal : en Difficile et Expert,
 * la cour tourne toujours à pleine vitesse, sans pause tactique.
 */
import type { AiAttention } from '../config';
import type { Difficulty } from './types';

export type GameSpeed = 'normale' | 'lente';

export const TEMPO = {
  /** Facteur de vitesse de chaque réglage (temps de jeu par seconde réelle). */
  speeds: { normale: 1, lente: 0.75 } as Record<GameSpeed, number>,
  /** Difficultés où le rythme est réglable. */
  allowed: ['facile', 'normal'] as readonly Difficulty[],
};

/** Le rythme (vitesse lente, pause tactique) est-il proposé à cette difficulté ? */
export function tempoAllowed(difficulty: Difficulty, tutorial = false): boolean {
  return !tutorial && TEMPO.allowed.includes(difficulty);
}

/** Réglage de vitesse lu dans une sauvegarde (toute valeur inconnue redevient « normale »). */
export function sanitizeSpeed(v: unknown): GameSpeed {
  return v === 'lente' ? 'lente' : 'normale';
}

/** Facteur de vitesse effectif : toujours 1 hors de Facile et Normal (et dans le tutoriel). */
export function speedFactor(speed: GameSpeed, difficulty: Difficulty, tutorial = false): number {
  return tempoAllowed(difficulty, tutorial) ? TEMPO.speeds[speed] : 1;
}

/**
 * Attention d'un humain exprimée en temps de jeu : à vitesse `factor`, ses ordres par minute
 * réelle valent `1 / factor` fois plus d'ordres par minute de jeu, et ses délais de réaction
 * raccourcissent d'autant. Sert au joueur témoin des simulations (`vitesse=0.75`).
 */
export function attentionAtSpeed(base: AiAttention, factor: number): AiAttention {
  const f = factor > 0 ? factor : 1;
  return { ...base, ordersPerMin: base.ordersPerMin / f, threatDelay: base.threatDelay * f };
}

/**
 * Pause tactique : la cour est figée, mais le joueur peut sélectionner, donner des ordres,
 * acheter et poser ses consignes. Compte les pauses et le temps réel passé figé (statistiques).
 */
export class TacticalPause {
  active = false;
  /** Nombre de pauses tactiques prises dans la partie. */
  count = 0;
  /** Secondes réelles passées en pause tactique. */
  realSeconds = 0;

  constructor(readonly allowed: boolean) {}

  /** Bascule la pause ; renvoie le nouvel état (toujours false si elle n'est pas permise). */
  toggle(): boolean {
    return this.set(!this.active);
  }

  set(on: boolean): boolean {
    if (!this.allowed) return (this.active = false);
    if (on && !this.active) this.count++;
    this.active = on;
    return this.active;
  }

  /** À appeler à chaque image avec le temps réel écoulé. */
  tick(realDt: number): void {
    if (this.active) this.realSeconds += Math.max(0, realDt);
  }
}
