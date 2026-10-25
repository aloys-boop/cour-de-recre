/**
 * Règles optionnelles d'une partie (escarmouche). Toutes désactivées par défaut :
 * la campagne joue toujours avec les règles de base.
 *
 * Pour ajouter une option : un champ booléen dans GameRules, une entrée dans RULE_TOGGLES
 * (libellé + description affichés dans le menu d'escarmouche), puis lire `world.rules.<champ>`
 * là où la règle s'applique.
 */
export type GameMode = 'classique' | 'roi';

export interface GameRules {
  /** Mode de jeu : classique (élimination / tous les camps) ou « Roi de la cour ». */
  mode?: GameMode;
  /** Cadeaux entre alliés : envoyer des élèves ou céder une case à un allié. */
  gifts?: boolean;
  /** Appel à l'aide : bouton SOS qui fait venir les alliés défendre ton camp. */
  sos?: boolean;
  /** Tribut : céder une case à une équipe pour obtenir une trêve de 30 s. */
  tribute?: boolean;
  /** Surveillants : équipe neutre qui se promène et sépare les bagarres. */
  supervisors?: boolean;
  /** Brouillard de guerre : on ne voit que ce que voient ses élèves et ceux de ses alliés. */
  fog?: boolean;
  /** Camps fantômes : camps sans propriétaire au départ, à conquérir. */
  ghostCamps?: boolean;
}

export type RuleFlag = Exclude<keyof GameRules, 'mode'>;

export interface RuleToggle {
  key: RuleFlag;
  label: string;
  description: string;
}

/** Options affichées (case à cocher) dans le menu d'escarmouche, dans cet ordre. */
export const RULE_TOGGLES: RuleToggle[] = [
  { key: 'ghostCamps', label: 'Camps fantômes', description: 'Des camps sans propriétaire à conquérir\u00a0: pris, ils produisent des élèves.' },
];

export interface ModeDef {
  id: GameMode;
  label: string;
  description: string;
}

/** Modes proposés dans le menu d'escarmouche. */
export const GAME_MODES: ModeDef[] = [
  { id: 'classique', label: 'Classique', description: 'Élimine les autres équipes ou prends tous les camps.' },
];

export const DEFAULT_RULES: GameRules = { mode: 'classique' };

export function normalizeRules(r: GameRules | undefined): GameRules {
  return { ...DEFAULT_RULES, ...(r ?? {}) };
}
