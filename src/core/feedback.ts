/**
 * Retours tactiles visuels et transitions (v5.22, saison 2, interface b).
 *
 * - Onde sous le doigt : chaque ordre donné du doigt fait naître, à l'endroit exact du doigt,
 *   une onde courte dont la couleur et la forme disent l'ordre compris (déplacement blanc,
 *   charge orange, attaque rouge avec quatre crans qui se referment, case à la couleur de
 *   l'équipe, sélection en petit anneau, tap sans effet en anneau pâle).
 * - Boutons qui s'enfoncent : durée minimale d'enfoncement, pour qu'un tap très bref se voie.
 * - Fondus entre menu, partie et écran de fin : durée et courbe d'un voile qui se lève.
 *
 * Tout est en coordonnées d'écran (pixels CSS) et en temps réel : rien ne touche à la partie.
 */

import { mixHex } from './emblems';

export type RippleKind = 'move' | 'charge' | 'attack' | 'capture' | 'select' | 'tap' | 'power';

export interface Ripple {
  /** Position du doigt, en pixels CSS. */
  x: number;
  y: number;
  /** Âge en secondes (temps réel). */
  t: number;
  kind: RippleKind;
  /** Couleur de l'équipe du joueur (teinte claire), pour la capture et la sélection. */
  team: string;
}

export interface RippleRing {
  radius: number;
  alpha: number;
  width: number;
}

export interface RippleStyle {
  color: string;
  /** Nombre d'anneaux (décalés dans le temps). */
  rings: number;
  /** Rayon final en pixels CSS. */
  maxR: number;
  /** Épaisseur de trait de départ. */
  width: number;
  /** Quatre crans qui se referment sur le doigt (attaque). */
  ticks: boolean;
  /** Opacité de départ. */
  alpha: number;
}

export const RIPPLE = {
  /** Durée de vie d'une onde, en secondes. */
  life: 0.5,
  /** Avec « réduire les animations » : une onde, plus courte, sans crans tournants. */
  reducedLife: 0.28,
  /** Décalage entre deux anneaux, en part de la vie. */
  ringDelay: 0.22,
  /** Nombre maximal d'ondes à l'écran (les plus vieilles cèdent la place). */
  max: 6,
} as const;

export const ORDER_COLORS = {
  move: '#ffffff',
  charge: '#ff9a2e',
  attack: '#ff3b2f',
  tap: '#ffffff',
} as const;

/** Allure d'une onde selon l'ordre compris. */
export function rippleStyle(kind: RippleKind, team: string): RippleStyle {
  switch (kind) {
    case 'move':
      return { color: ORDER_COLORS.move, rings: 2, maxR: 34, width: 3, ticks: false, alpha: 0.95 };
    case 'charge':
      return { color: ORDER_COLORS.charge, rings: 2, maxR: 38, width: 3.5, ticks: false, alpha: 1 };
    case 'attack':
      return { color: ORDER_COLORS.attack, rings: 2, maxR: 36, width: 3.5, ticks: true, alpha: 1 };
    case 'capture':
    case 'power':
      return { color: team, rings: 2, maxR: 40, width: 3, ticks: false, alpha: 1 };
    case 'select':
      return { color: team, rings: 1, maxR: 26, width: 2.5, ticks: false, alpha: 0.9 };
    case 'tap':
    default:
      return { color: ORDER_COLORS.tap, rings: 1, maxR: 22, width: 2, ticks: false, alpha: 0.45 };
  }
}

/**
 * Couleur d'équipe d'une onde : la teinte claire de l'équipe éclaircie de 45 % vers le blanc,
 * pour rester visible sur le sol (la teinte claire des Noirs, gris foncé, s'y perdrait).
 */
export function rippleTeamColor(light: string): string {
  return mixHex(light, '#ffffff', 0.45);
}

/** Durée de vie d'une onde. */
export function rippleLife(reduced: boolean): number {
  return reduced ? RIPPLE.reducedLife : RIPPLE.life;
}

/** Sortie douce (cubique) : l'onde part vite puis ralentit, comme une goutte. */
export function easeOut(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return 1 - (1 - c) ** 3;
}

/**
 * Anneaux visibles d'une onde à son âge : rayon qui s'ouvre en douceur, opacité et épaisseur qui
 * baissent. Les anneaux suivants partent un peu plus tard. Avec « réduire les animations » :
 * un seul anneau.
 */
export function rippleRings(r: Ripple, reduced: boolean): RippleRing[] {
  const s = rippleStyle(r.kind, r.team);
  const life = rippleLife(reduced);
  const rings = reduced ? 1 : s.rings;
  const out: RippleRing[] = [];
  for (let i = 0; i < rings; i++) {
    const start = i * RIPPLE.ringDelay * life;
    const span = life - start;
    const k = (r.t - start) / span;
    if (k < 0 || k >= 1) continue;
    const e = easeOut(k);
    out.push({
      radius: s.maxR * (0.25 + 0.75 * e) * (i === 0 ? 1 : 0.82),
      alpha: s.alpha * (1 - k) * (i === 0 ? 1 : 0.6),
      width: Math.max(0.8, s.width * (1 - 0.6 * k)),
    });
  }
  return out;
}

/** Crans de l'attaque : distance au doigt (qui se referme) et angle (qui tourne un peu). */
export function attackTicks(r: Ripple, reduced: boolean): { dist: number; angle: number; alpha: number } | null {
  if (r.kind !== 'attack') return null;
  const life = rippleLife(reduced);
  const k = r.t / life;
  if (k >= 1) return null;
  const s = rippleStyle('attack', r.team);
  const e = easeOut(k);
  return { dist: s.maxR * (1.05 - 0.55 * e), angle: reduced ? Math.PI / 4 : Math.PI / 4 + e * 0.6, alpha: 1 - k };
}

/** Ajoute une onde (les plus vieilles cèdent la place au-delà du maximum). */
export function addRipple(list: Ripple[], r: Omit<Ripple, 't'>): Ripple[] {
  list.push({ ...r, t: 0 });
  while (list.length > RIPPLE.max) list.shift();
  return list;
}

/** Fait vieillir les ondes et retire les éteintes. */
export function tickRipples(list: Ripple[], dt: number, reduced: boolean): Ripple[] {
  const life = rippleLife(reduced);
  for (const r of list) r.t += Math.max(0, dt);
  return list.filter((r) => r.t < life);
}

/**
 * Ordre compris d'après ce que le tap a produit : le repère d'ordre posé (déplacement, charge,
 * attaque, case), sinon une sélection, sinon un tap sans effet. null : le tap n'a rien à montrer
 * (fin au ralenti, partie en pause…).
 */
export function rippleKindFor(markerKind: string | null, selectionChanged: boolean, extra: 'power' | null = null): RippleKind {
  if (extra === 'power') return 'power';
  if (markerKind === 'move' || markerKind === 'charge' || markerKind === 'attack' || markerKind === 'capture') return markerKind;
  if (selectionChanged) return 'select';
  return 'tap';
}

// ---------------------------------------------------------------- boutons

/** Un bouton reste enfoncé au moins ce temps (ms), pour qu'un tap très bref se voie. */
export const PRESS_MIN_MS = 110;

/** Délai avant de relâcher un bouton lâché après `heldMs` d'appui. */
export function releaseDelay(heldMs: number): number {
  return Math.max(0, PRESS_MIN_MS - Math.max(0, heldMs));
}

// ---------------------------------------------------------------- fondus

export type TransitionKind = 'partie' | 'menu' | 'fin';

/** Durée (ms) du voile qui se lève, par écran d'arrivée. */
export const TRANSITION_MS: Record<TransitionKind, number> = {
  partie: 420,
  menu: 340,
  fin: 260,
};

/** Avec « réduire les animations » : un fondu bref, toujours là pour marquer le changement. */
export const TRANSITION_REDUCED_MS = 140;

export function transitionMs(kind: TransitionKind, reduced: boolean): number {
  return reduced ? TRANSITION_REDUCED_MS : TRANSITION_MS[kind];
}

/** Opacité du voile au temps `ms` d'un fondu de `total` ms : plein, puis se lève en douceur. */
export function veilOpacity(ms: number, total: number): number {
  if (total <= 0) return 0;
  const k = ms / total;
  if (k <= 0) return 1;
  if (k >= 1) return 0;
  return 1 - easeOut(k);
}
