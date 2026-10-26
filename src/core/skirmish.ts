import { unitCapFor, type LevelDef } from './mapgen';

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

export const SKIRMISH_TILES_MIN = 10;
export const SKIRMISH_TILES_MAX = 30;
export const SKIRMISH_TEAMS_MIN = 2;
export const SKIRMISH_TEAMS_MAX = 8;
/** À partir de 5 équipes, la cour compte toujours au moins une vingtaine de cases bonus. */
export const SKIRMISH_MANY_TEAMS = 5;
export const SKIRMISH_TILES_MIN_MANY = 20;

/** Nombre minimal de cases bonus pour un nombre d'équipes donné. */
export function minTilesFor(teams: number): number {
  return teams >= SKIRMISH_MANY_TEAMS ? SKIRMISH_TILES_MIN_MANY : SKIRMISH_TILES_MIN;
}

export interface SkirmishSettings {
  /** 2 à 8. */
  teams: number;
  /** Index dans COUR_SIZES (0 à 3). */
  size: number;
  /** 10 à 30 (20 à 30 à partir de 5 équipes). */
  tiles: number;
}

export const DEFAULT_SKIRMISH: SkirmishSettings = { teams: 4, size: 1, tiles: 18 };

/** Ramène des réglages quelconques dans les bornes autorisées. */
export function clampSkirmish(s: Partial<SkirmishSettings>): SkirmishSettings {
  const int = (v: unknown, lo: number, hi: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const teams = int(s.teams, SKIRMISH_TEAMS_MIN, SKIRMISH_TEAMS_MAX, DEFAULT_SKIRMISH.teams);
  return {
    teams,
    size: int(s.size, 0, COUR_SIZES.length - 1, DEFAULT_SKIRMISH.size),
    tiles: int(s.tiles, minTilesFor(teams), SKIRMISH_TILES_MAX, DEFAULT_SKIRMISH.tiles),
  };
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
  };
}

/** Description courte des réglages, par ex. « 4 équipes, cour moyenne, 18 cases ». */
export function describeSkirmish(input: SkirmishSettings): string {
  const s = clampSkirmish(input);
  return `${s.teams} équipes, cour ${COUR_SIZES[s.size].label.toLowerCase()}, ${s.tiles} cases`;
}
