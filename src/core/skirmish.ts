import { unitCapFor, type LevelDef } from './mapgen';
import type { Suit } from './types';

/**
 * Mode escarmouche : une partie libre dont on choisit les réglages
 * (nombre d'équipes, taille de cour, nombre de cases bonus). La carte est
 * générée par generateMap à partir d'un LevelDef construit à la volée.
 */

export interface CourSize {
  id: string;
  label: string;
  /** Côté de la cour (cellules) ; grandit si l'on demande beaucoup de cases. */
  w: number;
  obstacles: number;
  unitCap: number;
  spawnInterval: number;
  startUnits: number;
}

export const COUR_SIZES: readonly CourSize[] = [
  { id: 'petite', label: 'Petite', w: 13, obstacles: 2, unitCap: 30, spawnInterval: 6, startUnits: 6 },
  { id: 'moyenne', label: 'Moyenne', w: 16, obstacles: 4, unitCap: 30, spawnInterval: 5.2, startUnits: 6 },
  { id: 'grande', label: 'Grande', w: 20, obstacles: 6, unitCap: 30, spawnInterval: 4.8, startUnits: 7 },
  { id: 'immense', label: 'Immense', w: 26, obstacles: 10, unitCap: 30, spawnInterval: 4.5, startUnits: 8 },
];

/** Cases bonus : de 4 à 30, quel que soit le nombre d'équipes. */
export const SKIRMISH_TILES_MIN = 4;
export const SKIRMISH_TILES_MAX = 30;
export const SKIRMISH_TEAMS_MIN = 2;
export const SKIRMISH_TEAMS_MAX = 8;

/** Nombre minimal de cases bonus (le même pour tous les nombres d'équipes depuis la v5.3). */
export function minTilesFor(_teams: number): number {
  return SKIRMISH_TILES_MIN;
}

/** Ordre d'affichage des symboles. */
export const SUIT_ORDER: readonly Suit[] = ['heart', 'spade', 'club', 'diamond'];

/** Nombre de cases de chaque symbole (0 à 30 chacun, total de 4 à 30). */
export type SuitCounts = Record<Suit, number>;

export interface SkirmishSettings {
  /** 2 à 8. */
  teams: number;
  /** Index dans COUR_SIZES (0 à 3). */
  size: number;
  /** 4 à 30 (total des cases bonus). */
  tiles: number;
  /**
   * Cases personnalisées : nombre de cases de chaque symbole (total = `tiles`).
   * Absent : symboles répartis à parts égales, comme dans la campagne.
   */
  suits?: SuitCounts;
}

/** Répartition à parts égales de `total` cases entre les quatre symboles (♥ d'abord pour le reste). */
export function evenSuits(total: number): SuitCounts {
  const out = {} as SuitCounts;
  SUIT_ORDER.forEach((s, i) => (out[s] = Math.floor(total / 4) + (i < total % 4 ? 1 : 0)));
  return out;
}

/** Total des cases d'une répartition. */
export function suitTotal(c: SuitCounts): number {
  return SUIT_ORDER.reduce((n, s) => n + c[s], 0);
}

/** Ramène une répartition dans les bornes : 0 à 30 par symbole, total de 4 à 30. */
export function clampSuits(input: Partial<Record<Suit, unknown>>): SuitCounts {
  const out = {} as SuitCounts;
  for (const s of SUIT_ORDER) {
    const n = Math.round(Number(input[s]));
    out[s] = Number.isFinite(n) ? Math.max(0, Math.min(SKIRMISH_TILES_MAX, n)) : 0;
  }
  // Trop de cases : on retire au symbole le plus nombreux ; pas assez : on ajoute au moins nombreux.
  while (suitTotal(out) > SKIRMISH_TILES_MAX) {
    const s = SUIT_ORDER.reduce((a, b) => (out[b] > out[a] ? b : a));
    out[s]--;
  }
  while (suitTotal(out) < SKIRMISH_TILES_MIN) {
    const s = SUIT_ORDER.reduce((a, b) => (out[b] < out[a] ? b : a));
    out[s]++;
  }
  return out;
}

export const DEFAULT_SKIRMISH: SkirmishSettings = { teams: 4, size: 1, tiles: 18 };

/** Ramène des réglages quelconques dans les bornes autorisées. */
export function clampSkirmish(s: Partial<SkirmishSettings>): SkirmishSettings {
  const int = (v: unknown, lo: number, hi: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const teams = int(s.teams, SKIRMISH_TEAMS_MIN, SKIRMISH_TEAMS_MAX, DEFAULT_SKIRMISH.teams);
  const size = int(s.size, 0, COUR_SIZES.length - 1, DEFAULT_SKIRMISH.size);
  if (s.suits && typeof s.suits === 'object') {
    const suits = clampSuits(s.suits);
    return { teams, size, tiles: suitTotal(suits), suits };
  }
  return { teams, size, tiles: int(s.tiles, minTilesFor(teams), SKIRMISH_TILES_MAX, DEFAULT_SKIRMISH.tiles) };
}

/**
 * Niveau d'escarmouche. Sur une petite cour, beaucoup de cases ne tiennent pas
 * à l'écart les unes des autres : la cour s'agrandit alors un peu (une cellule de
 * côté pour deux cases supplémentaires), en restant ordonnée de la petite à
 * l'immense, pour que le générateur place toujours le nombre de cases demandé.
 * Au-delà de 4 équipes, la cour grandit de deux cellules par équipe supplémentaire
 * (camps aux milieux des bords), avec un côté pair pour que les camps restent symétriques.
 * Le plafond d'élèves est de 30 par équipe, quel que soit le nombre d'équipes.
 */
export function skirmishLevel(input: SkirmishSettings): LevelDef {
  const s = clampSkirmish(input);
  const size = COUR_SIZES[s.size];
  const extra = Math.max(0, s.teams - 4) * 2;
  let w = Math.max(size.w, 6 + Math.ceil(s.tiles / 2) + 2 * s.size) + extra;
  if (s.teams > 4 && s.teams % 2 === 0 && w % 2 === 1) w++;
  return {
    id: 'escarmouche',
    name: 'Escarmouche',
    w,
    h: w,
    teams: s.teams,
    tiles: s.tiles,
    obstacles: size.obstacles + Math.max(0, s.teams - 4),
    unitCap: unitCapFor(size.unitCap, s.teams),
    spawnInterval: size.spawnInterval,
    startUnits: size.startUnits,
    ...(s.suits ? { suits: s.suits } : {}),
  };
}

/** Description courte des réglages, par ex. « 4 équipes, cour moyenne, 18 cases ». */
export function describeSkirmish(input: SkirmishSettings): string {
  const s = clampSkirmish(input);
  const base = `${s.teams} équipes, cour ${COUR_SIZES[s.size].label.toLowerCase()}, ${s.tiles} cases`;
  if (!s.suits) return base;
  const glyph: Record<Suit, string> = { heart: '♥', spade: '♠', club: '♣', diamond: '♦' };
  return `${base} (${SUIT_ORDER.map((k) => `${s.suits![k]} ${glyph[k]}`).join(', ')})`;
}
