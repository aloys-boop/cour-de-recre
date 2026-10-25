import type { LevelDef } from './mapgen';

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
  { id: 'petite', label: 'Petite', w: 13, obstacles: 2, unitCap: 20, spawnInterval: 6, startUnits: 6 },
  { id: 'moyenne', label: 'Moyenne', w: 16, obstacles: 4, unitCap: 26, spawnInterval: 5.2, startUnits: 6 },
  { id: 'grande', label: 'Grande', w: 20, obstacles: 6, unitCap: 30, spawnInterval: 4.8, startUnits: 7 },
  { id: 'immense', label: 'Immense', w: 26, obstacles: 10, unitCap: 30, spawnInterval: 4.5, startUnits: 8 },
];

export const SKIRMISH_TILES_MIN = 10;
export const SKIRMISH_TILES_MAX = 30;
export const SKIRMISH_TEAMS_MIN = 2;
export const SKIRMISH_TEAMS_MAX = 4;

export interface SkirmishSettings {
  /** 2 à 4. */
  teams: number;
  /** Index dans COUR_SIZES (0 à 3). */
  size: number;
  /** 10 à 30. */
  tiles: number;
}

export const DEFAULT_SKIRMISH: SkirmishSettings = { teams: 4, size: 1, tiles: 18 };

/** Ramène des réglages quelconques dans les bornes autorisées. */
export function clampSkirmish(s: Partial<SkirmishSettings>): SkirmishSettings {
  const int = (v: unknown, lo: number, hi: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  return {
    teams: int(s.teams, SKIRMISH_TEAMS_MIN, SKIRMISH_TEAMS_MAX, DEFAULT_SKIRMISH.teams),
    size: int(s.size, 0, COUR_SIZES.length - 1, DEFAULT_SKIRMISH.size),
    tiles: int(s.tiles, SKIRMISH_TILES_MIN, SKIRMISH_TILES_MAX, DEFAULT_SKIRMISH.tiles),
  };
}

/**
 * Niveau d'escarmouche. Sur une petite cour, beaucoup de cases ne tiennent pas
 * à l'écart les unes des autres : la cour s'agrandit alors un peu (une cellule de
 * côté pour deux cases supplémentaires), en restant ordonnée de la petite à
 * l'immense, pour que le générateur place toujours le nombre de cases demandé.
 */
export function skirmishLevel(input: SkirmishSettings): LevelDef {
  const s = clampSkirmish(input);
  const size = COUR_SIZES[s.size];
  const w = Math.max(size.w, 6 + Math.ceil(s.tiles / 2) + 2 * s.size);
  return {
    id: 'escarmouche',
    name: 'Escarmouche',
    w,
    h: w,
    teams: s.teams,
    tiles: s.tiles,
    obstacles: size.obstacles,
    unitCap: size.unitCap,
    spawnInterval: size.spawnInterval,
    startUnits: size.startUnits,
  };
}

/** Description courte des réglages, par ex. « 4 équipes, cour moyenne, 18 cases ». */
export function describeSkirmish(input: SkirmishSettings): string {
  const s = clampSkirmish(input);
  return `${s.teams} équipes, cour ${COUR_SIZES[s.size].label.toLowerCase()}, ${s.tiles} cases`;
}
