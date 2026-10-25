import { generateMap, LEVELS, type LevelDef } from './mapgen';
import { clampSkirmish, describeSkirmish, skirmishLevel, type SkirmishSettings } from './skirmish';
import type { MapDef } from './types';

/**
 * Code de carte partageable : 6 caractères en base 32 sans caractères ambigus
 * (ni 0, ni 1, ni I, ni O), qui encodent le type de partie (niveau de campagne
 * ou réglages d'escarmouche) et la graine du tirage. Le même code redonne
 * exactement la même disposition de cases et d'obstacles.
 *
 * 30 bits = 10 bits d'en-tête + 20 bits de graine, mélangés de façon
 * réversible pour que deux codes proches ne se ressemblent pas.
 *  - campagne : bit 9 = 0, bits 0 à 2 = niveau, bits 3 à 8 = 0 (contrôle) ;
 *  - escarmouche à 2-4 équipes : bit 9 = 1, bits 0-1 = équipes - 2, bits 2-3 = taille,
 *    bits 4 à 8 = cases - 10 ;
 *  - escarmouche à 5-8 équipes (20 à 30 cases) : bit 9 = 0 et en-tête ≥ 64, soit
 *    64 + ((équipes - 5) × 4 + taille) × 11 + (cases - 20), dans la place laissée libre par la
 *    campagne. Les anciens codes (2 à 4 équipes, 5 niveaux) se décodent donc à l'identique.
 */

export type MapSpec = { kind: 'campagne'; level: number } | ({ kind: 'escarmouche' } & SkirmishSettings);

export interface MapCode {
  spec: MapSpec;
  seed: number;
}

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;
export const SEED_BITS = 20;
export const SEED_COUNT = 1 << SEED_BITS;

const BITS = 30;
const MASK = (1 << BITS) - 1;
const MUL_A = 0x2c1b3c6d | 1;
const MUL_B = 0x297a2d39 | 1;

/** Inverse d'un impair modulo 2^30 (itération de Newton). */
function inverse(a: number): number {
  let x = a;
  for (let i = 0; i < 5; i++) x = Math.imul(x, 2 - Math.imul(a, x));
  return x & MASK;
}
const INV_A = inverse(MUL_A);
const INV_B = inverse(MUL_B);

const mul = (x: number, m: number) => Math.imul(x, m) & MASK;
// x ^= x >>> 15 est sa propre réciproque sur 30 bits.
const shuffle = (x: number) => (x ^ (x >>> 15)) & MASK;

function mix(x: number): number {
  return shuffle(mul(shuffle(mul(x, MUL_A)), MUL_B));
}

function unmix(x: number): number {
  return mul(shuffle(mul(shuffle(x), INV_B)), INV_A);
}

/** Nouvelle graine tirée au sort, compatible avec le code de carte. */
export function randomSeed(rand: () => number = Math.random): number {
  return Math.floor(rand() * SEED_COUNT) % SEED_COUNT;
}

const MANY_BASE = 64;
const MANY_TILES = 11; // 20 à 30 cases
const MANY_COUNT = 4 * 4 * MANY_TILES; // 5 à 8 équipes × 4 tailles × 11

function header(spec: MapSpec): number {
  if (spec.kind === 'campagne') return spec.level & 7;
  const s = clampSkirmish(spec);
  if (s.teams >= 5) return MANY_BASE + ((s.teams - 5) * 4 + s.size) * MANY_TILES + (s.tiles - 20);
  return (1 << 9) | ((s.tiles - 10) << 4) | (s.size << 2) | (s.teams - 2);
}

export function encodeMapCode(code: MapCode): string {
  const seed = ((code.seed % SEED_COUNT) + SEED_COUNT) % SEED_COUNT;
  let x = mix(header(code.spec) * SEED_COUNT + seed);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out = CODE_ALPHABET[x & 31] + out;
    x >>>= 5;
  }
  return out;
}

/** Majuscules, sans espaces ni tirets. */
export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/[\s\-_.]/g, '');
}

/** Décode un code saisi par le joueur ; null si le code n'est pas valide. */
export function decodeMapCode(text: string): MapCode | null {
  const s = normalizeCode(text);
  if (s.length !== CODE_LENGTH) return null;
  let x = 0;
  for (const c of s) {
    const v = CODE_ALPHABET.indexOf(c);
    if (v < 0) return null;
    x = x * 32 + v;
  }
  x = unmix(x);
  const seed = x % SEED_COUNT;
  const h = Math.floor(x / SEED_COUNT);
  if (h & (1 << 9)) {
    const teams = (h & 3) + 2;
    const size = (h >> 2) & 3;
    const tiles = ((h >> 4) & 31) + 10;
    if (teams > 4 || tiles > 30) return null;
    return { spec: { kind: 'escarmouche', teams, size, tiles }, seed };
  }
  if (h >= MANY_BASE) {
    const idx = h - MANY_BASE;
    if (idx >= MANY_COUNT) return null;
    const tiles = (idx % MANY_TILES) + 20;
    const rest = Math.floor(idx / MANY_TILES);
    return { spec: { kind: 'escarmouche', teams: Math.floor(rest / 4) + 5, size: rest % 4, tiles }, seed };
  }
  const level = h & 7;
  if (h >> 3 || level >= LEVELS.length) return null;
  return { spec: { kind: 'campagne', level }, seed };
}

export function levelForSpec(spec: MapSpec): LevelDef {
  return spec.kind === 'campagne' ? LEVELS[Math.max(0, Math.min(LEVELS.length - 1, spec.level))] : skirmishLevel(spec);
}

/** Carte correspondant à un code : même code, même disposition. */
export function mapForCode(code: MapCode): MapDef {
  return generateMap(levelForSpec(code.spec), code.seed);
}

/** Description lisible, par ex. « Niveau 3 : Le gymnase » ou « Escarmouche : 4 équipes, cour moyenne, 18 cases ». */
export function describeSpec(spec: MapSpec): string {
  if (spec.kind === 'campagne') return `Niveau ${spec.level + 1} : ${levelForSpec(spec).name}`;
  return `Escarmouche : ${describeSkirmish(spec)}`;
}
