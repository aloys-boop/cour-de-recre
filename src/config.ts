import type { Difficulty, Suit } from './core/types';

/** Nombre maximal d'équipes dans une partie (1 joueur + 7 IA). */
export const MAX_TEAMS = 8;

export const TEAM_NAMES = ['Noir', 'Vert', 'Jaune', 'Violet', 'Rouge', 'Bleu', 'Orange', 'Rose'] as const;

/** Nom d'équipe au pluriel, pour les annonces (« Les Verts acceptent l’alliance. »). */
export const TEAM_PLURALS = ['Noirs', 'Verts', 'Jaunes', 'Violets', 'Rouges', 'Bleus', 'Oranges', 'Roses'] as const;

/** Couleur d'uniforme : teintes claire / principale / sombre, plus la couleur d'interface. */
export const TEAM_COLORS = [
  { light: '#6a6a74', main: '#44444e', dark: '#26262e', ui: '#3d3d47', text: '#ffffff' },
  { light: '#7fd36a', main: '#3aa83a', dark: '#1f6b27', ui: '#2f9e44', text: '#ffffff' },
  { light: '#ffe27a', main: '#f0bd2a', dark: '#b7860f', ui: '#e0b020', text: '#2b2b33' },
  { light: '#b784e6', main: '#8046c2', dark: '#51297f', ui: '#7a3fb5', text: '#ffffff' },
  { light: '#ff7b6b', main: '#d8322a', dark: '#8c1a16', ui: '#d0342b', text: '#ffffff' },
  { light: '#74b4ff', main: '#2f6fd8', dark: '#1a3f88', ui: '#2b68cf', text: '#ffffff' },
  { light: '#ffb466', main: '#f07c1c', dark: '#a8500c', ui: '#ec7a1e', text: '#2b2b33' },
  { light: '#ffb3d9', main: '#ec6fae', dark: '#a83d74', ui: '#e46aa8', text: '#2b2b33' },
] as const;

/**
 * Profil de chaque équipe (par couleur d'uniforme) : les forces sont volontairement inégales.
 *  hp : points de vie, dmg : dégâts, prod : vitesse de production, speed : vitesse de déplacement.
 */
/** Les quatre caractéristiques d'une équipe. */
export type TeamStat = 'hp' | 'dmg' | 'prod' | 'speed';
export const TEAM_STATS: readonly TeamStat[] = ['hp', 'dmg', 'prod', 'speed'];

/** Budget fixe : chaque équipe répartit exactement 12 points, de 1 à 5 par caractéristique. */
export const TEAM_POINT_BUDGET = 12;
export const STAT_POINTS_MIN = 1;
export const STAT_POINTS_MAX = 5;

/**
 * Valeur réelle (multiplicateur) de 1, 2, 3, 4 et 5 points dans chaque caractéristique.
 * 3 points = valeur de référence (×1). Les caractéristiques n'ont pas le même poids
 * (la vitesse sert à capturer, la production compte moins depuis le plafond de 30 élèves) :
 * la valeur d'un point a été réglée par simulations IA contre IA (voir README).
 */
export const STAT_POINT_VALUES: Record<TeamStat, number[]> = {
  hp: [0.8, 0.9, 1, 1.08, 1.17],
  dmg: [0.8, 0.9, 1, 1.1, 1.2],
  prod: [0.83, 0.91, 1, 1.12, 1.22],
  speed: [0.72, 0.84, 1, 1.23, 1.36],
};

export type TeamPoints = Record<TeamStat, number>;

export interface TeamProfile {
  /** Points répartis (1 à 5 chacun, total 12). */
  points: TeamPoints;
  /** Multiplicateurs réels, calculés à partir des points. */
  readonly hp: number;
  readonly dmg: number;
  readonly prod: number;
  readonly speed: number;
  blurb: string;
}

/** Multiplicateur réel d'une caractéristique pour un nombre de points. */
export function statValue(stat: TeamStat, points: number): number {
  const p = Math.max(STAT_POINTS_MIN, Math.min(STAT_POINTS_MAX, Math.round(points)));
  return STAT_POINT_VALUES[stat][p - 1];
}

function profile(hp: number, dmg: number, prod: number, speed: number, blurb: string): TeamProfile {
  const points: TeamPoints = { hp, dmg, prod, speed };
  return {
    points,
    blurb,
    get hp() {
      return statValue('hp', points.hp);
    },
    get dmg() {
      return statValue('dmg', points.dmg);
    },
    get prod() {
      return statValue('prod', points.prod);
    },
    get speed() {
      return statValue('speed', points.speed);
    },
  };
}

/** Répartition des 12 points de chaque couleur (vie / dégâts / production / vitesse). */
export const TEAM_PROFILES: readonly TeamProfile[] = [
  profile(3, 3, 3, 3, 'Équilibrés en tout'),
  profile(2, 2, 5, 3, 'Production très rapide, mais fragiles'),
  profile(2, 3, 3, 4, 'Rapides, un peu fragiles'),
  profile(4, 4, 1, 3, 'Très forts, mais lents à produire'),
  profile(2, 5, 2, 3, 'Frappent très fort, mais peu de vie'),
  profile(5, 3, 2, 2, 'Beaucoup de vie, mais lents'),
  profile(2, 2, 4, 4, 'Production et vitesse élevées, petits poings'),
  profile(4, 3, 3, 2, 'Résistants, un peu lents'),
];

/** Bonus accordé par chaque case possédée, selon son symbole. */
export const SUIT_BONUS: Record<Suit, { stat: 'hp' | 'dmg' | 'prod' | 'speed'; perTile: number; label: string }> = {
  heart: { stat: 'hp', perTile: 0.3, label: 'Points de vie' },
  spade: { stat: 'dmg', perTile: 0.3, label: 'Dégâts' },
  club: { stat: 'prod', perTile: 0.35, label: 'Production' },
  diamond: { stat: 'speed', perTile: 0.15, label: 'Vitesse' },
};

export const TUNING = {
  unitHp: 60,
  unitSpeed: 2.4, // cellules par seconde
  punchDamageMin: 7,
  punchDamageMax: 11,
  punchInterval: 0.75, // secondes entre deux coups
  punchRange: 0.6, // distance de contact (cellules)
  aggroRange: 2.2, // distance à laquelle un élève inoccupé engage un ennemi
  knockback: 0.22,
  unitRadius: 0.24,
  captureSeconds: 3.0, // temps de capture d'une case bonus pour un seul élève
  campCaptureFactor: 2.5, // un camp se prend plus lentement
  captureDecayPerSec: 0.15, // retour à zéro d'une jauge abandonnée
  koSeconds: 1.6, // durée pendant laquelle l'élève KO reste visible
  regenPerSec: 7, // points de vie rendus par seconde sur son camp ou un cœur possédé
  bonusTileHalf: 0.62, // demi-côté de la zone d'une case bonus (cellules)
  campHalf: 1.05, // demi-côté de la zone d'un camp (2 × 2 cellules)
};

export interface AiProfile {
  reaction: number; // secondes entre deux décisions
  groupMin: number; // taille minimale d'un groupe pour attaquer
  keepHome: number; // fraction des unités gardées en défense
  aggression: number; // 0..1, goût pour les cases ennemies
  rallyRadius: number; // rayon de regroupement avant attaque
  damage: number; // multiplicateur de dégâts des élèves IA
}

export const AI_PROFILES: Record<Difficulty, AiProfile> = {
  facile: { reaction: 2.6, groupMin: 5, keepHome: 0.5, aggression: 0.3, rallyRadius: 1.6, damage: 0.75 },
  normal: { reaction: 1.5, groupMin: 4, keepHome: 0.35, aggression: 0.6, rallyRadius: 1.4, damage: 1 },
  difficile: { reaction: 0.8, groupMin: 3, keepHome: 0.2, aggression: 0.9, rallyRadius: 1.2, damage: 1.15 },
};

export const STORAGE_KEY = 'cour-de-recre.v2';

/** Rythme de partie : case dorée périodique et épuisement des équipes sans camp. */
export const RHYTHM = {
  goldenFirstAt: 45, // secondes de jeu avant la première case dorée
  goldenInterval: 60, // écart moyen entre deux cases dorées (début à début)
  goldenJitter: 5, // variation aléatoire de cet écart (±)
  goldenDuration: 30, // durée de vie d'une case dorée
  goldenMultiplier: 2, // la case dorée compte pour autant de cases
  goldenAiScore: 0.55, // attrait de la case dorée dans le choix de cible des IA
  noCampDrainPerSec: 1, // points de vie perdus par seconde par les élèves d'une équipe sans camp
};

/**
 * Diplomatie : alliances entre équipes pendant la partie.
 *  - une paire ne peut changer d'alliance qu'une fois toutes les `pairCooldown` secondes ;
 *  - une rupture est annoncée `breakNotice` secondes avant de prendre effet ;
 *  - une équipe trahie se méfie du traître pendant `betrayalMemory` secondes.
 */
export const DIPLOMACY = {
  pairCooldown: 30,
  breakNotice: 5,
  betrayalMemory: 120,
  thinkInterval: 7, // secondes entre deux réflexions diplomatiques d'une IA (± 30 %)
  threatRatio: 1.5, // « nettement plus forte » : puissance au moins 1,5 fois celle des deux
  maxAllies: 2, // au-delà, une IA n'accepte plus que face à une menace commune
  maxAlliesThreat: 3, // plafond absolu d'alliés, même face à une menace
  firstThink: 25, // secondes de jeu avant la première initiative diplomatique des IA
};

/** Trahisons selon la difficulté : seuil de puissance de l'allié et probabilité de passer à l'acte. */
export const BETRAYAL: Record<Difficulty, { strongerRatio: number; chance: number; endgameChance: number }> = {
  facile: { strongerRatio: 2.2, chance: 0.12, endgameChance: 0.15 },
  normal: { strongerRatio: 1.8, chance: 0.3, endgameChance: 0.35 },
  difficile: { strongerRatio: 1.45, chance: 0.6, endgameChance: 0.7 },
};
