import { STORAGE_KEY } from '../config';
import { sanitizeMedals, type MedalMap } from './challenges';
import type { Difficulty, TeamId } from './types';

export interface Progress {
  /** Nombre de cartes débloquées (la première l'est toujours). */
  unlocked: number;
  /** Victoires par identifiant de carte. */
  wins: Record<string, number>;
  muted: boolean;
  lastTeam: TeamId;
  lastDifficulty: Difficulty;
  /** Musique coupée (champ facultatif : absent des anciennes sauvegardes, la musique est alors active). */
  musicMuted?: boolean;
  /** Médailles de campagne par niveau (facultatif : absent des anciennes sauvegardes). */
  medals?: MedalMap;
  /** Le tutoriel a été proposé au premier lancement (accepté ou non). */
  tutorialSeen?: boolean;
  /** Le tutoriel a été terminé (victoire). */
  tutorialDone?: boolean;
  /**
   * Échelle de difficulté de la sauvegarde : absente avant la v5.2 (3 niveaux), 2 depuis (4 niveaux).
   * Une ancienne sauvegarde est convertie : « normal » → « difficile », « difficile » → « expert ».
   */
  difficultyScale?: number;
}

/** Échelle de difficulté actuelle (Facile, Normal, Difficile, Expert). */
export const DIFFICULTY_SCALE = 2;
const DIFFICULTY_IDS: readonly Difficulty[] = ['facile', 'normal', 'difficile', 'expert'];
/** Ancienne échelle à 3 niveaux → nouvelle : l'ancien Normal est le Difficile d'aujourd'hui, l'ancien Difficile l'Expert. */
const LEGACY_DIFFICULTY: Record<string, Difficulty> = { facile: 'facile', normal: 'difficile', difficile: 'expert' };

/** Difficulté lue dans une sauvegarde, convertie si elle date d'avant les 4 niveaux. */
export function migrateDifficulty(value: unknown, scale: unknown): Difficulty {
  if (scale === DIFFICULTY_SCALE) return DIFFICULTY_IDS.includes(value as Difficulty) ? (value as Difficulty) : 'normal';
  return typeof value === 'string' && value in LEGACY_DIFFICULTY ? LEGACY_DIFFICULTY[value] : 'normal';
}

const DEFAULT: Progress = { unlocked: 1, wins: {}, muted: false, lastTeam: 0, lastDifficulty: 'normal', musicMuted: false, difficultyScale: DIFFICULTY_SCALE };

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function storage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* accès refusé (navigation privée stricte) */
  }
  return null;
}

export function loadProgress(store: StorageLike | null = storage()): Progress {
  if (!store) return { ...DEFAULT, wins: {} };
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT, wins: {} };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      unlocked: Math.max(1, Number(parsed.unlocked) || 1),
      wins: parsed.wins && typeof parsed.wins === 'object' ? parsed.wins : {},
      muted: !!parsed.muted,
      lastTeam: ([0, 1, 2, 3, 4, 5, 6, 7] as TeamId[]).includes(parsed.lastTeam as TeamId) ? (parsed.lastTeam as TeamId) : 0,
      lastDifficulty: migrateDifficulty(parsed.lastDifficulty, parsed.difficultyScale),
      difficultyScale: DIFFICULTY_SCALE,
      musicMuted: !!parsed.musicMuted,
      medals: sanitizeMedals(parsed.medals),
      tutorialSeen: !!parsed.tutorialSeen,
      tutorialDone: !!parsed.tutorialDone,
    };
  } catch {
    return { ...DEFAULT, wins: {} };
  }
}

export function saveProgress(p: Progress, store: StorageLike | null = storage()): void {
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...p, difficultyScale: DIFFICULTY_SCALE }));
  } catch {
    /* quota ou stockage indisponible : on ignore */
  }
}

/** Enregistre une victoire et débloque la carte suivante si besoin. */
export function recordWin(p: Progress, mapId: string, mapIndex: number, totalMaps: number): Progress {
  const wins = { ...p.wins, [mapId]: (p.wins[mapId] ?? 0) + 1 };
  const unlocked = Math.min(totalMaps, Math.max(p.unlocked, mapIndex + 2));
  return { ...p, wins, unlocked };
}
