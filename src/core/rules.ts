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
  /** Surveillants : mini-boss neutres qui patrouillent et frappent tous les élèves qui s'approchent. */
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
  { key: 'fog', label: 'Brouillard de guerre', description: 'Tu ne vois que les abords de tes élèves, de tes cases et de ceux de tes alliés.' },
  { key: 'supervisors', label: 'Surveillants', description: 'Des surveillants costauds patrouillent\u00a0: ils frappent tous ceux qui s’approchent. À plusieurs, mets-les KO pour un bonus de dégâts.' },
  { key: 'gifts', label: 'Cadeaux entre alliés', description: 'Donne des élèves ou une case à un allié ; les IA alliées en offrent parfois.' },
  { key: 'sos', label: 'Appel à l’aide', description: 'Bouton SOS : tes alliés envoient des élèves défendre ton camp pendant 25\u00a0s.' },
  { key: 'tribute', label: 'Tribut', description: 'Cède une case à une équipe ennemie contre 30\u00a0s de trêve.' },
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
  { id: 'roi', label: 'Roi de la cour', description: 'Tiens le trône doré du centre 2 minutes au total pour gagner. L’élimination compte toujours.' },
];

export const DEFAULT_RULES: GameRules = { mode: 'classique' };

export function normalizeRules(r: GameRules | undefined): GameRules {
  return { ...DEFAULT_RULES, ...(r ?? {}) };
}
