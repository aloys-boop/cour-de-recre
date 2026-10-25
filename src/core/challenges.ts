/**
 * Défis et médailles de la campagne : pour chaque niveau, trois médailles.
 *  - victoire : gagner la partie ;
 *  - camp intact : gagner sans jamais avoir perdu son camp de départ ;
 *  - éclair : gagner en moins de 3 minutes (temps de jeu, pauses exclues).
 */

export type MedalId = 'victoire' | 'camp' | 'eclair';

export const MEDAL_IDS: readonly MedalId[] = ['victoire', 'camp', 'eclair'];

export const FAST_WIN_SECONDS = 180;

export const MEDAL_INFO: Record<MedalId, { label: string; hint: string; glyph: string }> = {
  victoire: { label: 'Victoire', hint: 'Gagner la partie', glyph: '★' },
  camp: { label: 'Camp intact', hint: 'Gagner sans perdre son camp', glyph: '⚑' },
  eclair: { label: 'Éclair', hint: 'Gagner en moins de 3 minutes', glyph: '⚡' },
};

/** Médailles obtenues sur un niveau. */
export type MedalSet = Partial<Record<MedalId, boolean>>;

/** Médailles par identifiant de niveau. */
export type MedalMap = Record<string, MedalSet>;

export interface MatchSummary {
  win: boolean;
  /** Le camp de départ du joueur a-t-il été pris au moins une fois ? */
  homeCampLost: boolean;
  /** Durée de la partie en secondes de jeu. */
  seconds: number;
}

/** Médailles méritées par une partie (aucune en cas de défaite). */
export function medalsFor(m: MatchSummary): MedalSet {
  if (!m.win) return {};
  const out: MedalSet = { victoire: true };
  if (!m.homeCampLost) out.camp = true;
  if (m.seconds < FAST_WIN_SECONDS) out.eclair = true;
  return out;
}

/** Ajoute des médailles à la collection ; renvoie la nouvelle collection et les médailles nouvellement obtenues. */
export function mergeMedals(all: MedalMap | undefined, levelId: string, earned: MedalSet): { medals: MedalMap; fresh: MedalId[] } {
  const prev = all?.[levelId] ?? {};
  const fresh = MEDAL_IDS.filter((id) => earned[id] && !prev[id]);
  const next: MedalSet = { ...prev };
  for (const id of MEDAL_IDS) if (earned[id]) next[id] = true;
  return { medals: { ...(all ?? {}), [levelId]: next }, fresh };
}

/** Nettoie des médailles lues depuis le stockage (données anciennes ou corrompues). */
export function sanitizeMedals(raw: unknown): MedalMap {
  const out: MedalMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [level, set] of Object.entries(raw as Record<string, unknown>)) {
    if (!set || typeof set !== 'object') continue;
    const clean: MedalSet = {};
    for (const id of MEDAL_IDS) if ((set as Record<string, unknown>)[id] === true) clean[id] = true;
    out[level] = clean;
  }
  return out;
}
