import { STORAGE_KEY } from '../config';
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
}

const DEFAULT: Progress = { unlocked: 1, wins: {}, muted: false, lastTeam: 0, lastDifficulty: 'normal', musicMuted: false };

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
      lastTeam: ([0, 1, 2, 3] as TeamId[]).includes(parsed.lastTeam as TeamId) ? (parsed.lastTeam as TeamId) : 0,
      lastDifficulty: (['facile', 'normal', 'difficile'] as Difficulty[]).includes(parsed.lastDifficulty as Difficulty)
        ? (parsed.lastDifficulty as Difficulty)
        : 'normal',
      musicMuted: !!parsed.musicMuted,
    };
  } catch {
    return { ...DEFAULT, wins: {} };
  }
}

export function saveProgress(p: Progress, store: StorageLike | null = storage()): void {
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(p));
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
