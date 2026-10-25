import type { Difficulty, Suit } from './core/types';

export const TEAM_NAMES = ['Noir', 'Vert', 'Jaune', 'Violet'] as const;

/** Couleur d'uniforme : teintes claire / principale / sombre, plus la couleur d'interface. */
export const TEAM_COLORS = [
  { light: '#6a6a74', main: '#44444e', dark: '#26262e', ui: '#3d3d47', text: '#ffffff' },
  { light: '#7fd36a', main: '#3aa83a', dark: '#1f6b27', ui: '#2f9e44', text: '#ffffff' },
  { light: '#ffe27a', main: '#f0bd2a', dark: '#b7860f', ui: '#e0b020', text: '#2b2b33' },
  { light: '#b784e6', main: '#8046c2', dark: '#51297f', ui: '#7a3fb5', text: '#ffffff' },
] as const;

/**
 * Profil de chaque équipe (par couleur d'uniforme) : les forces sont volontairement inégales.
 *  hp : points de vie, dmg : dégâts, prod : vitesse de production, speed : vitesse de déplacement.
 */
export interface TeamProfile {
  hp: number;
  dmg: number;
  prod: number;
  speed: number;
  blurb: string;
}

export const TEAM_PROFILES: readonly TeamProfile[] = [
  { hp: 1.05, dmg: 1.05, prod: 1.05, speed: 1.0, blurb: 'Solides et équilibrés en tout' },
  { hp: 0.7, dmg: 0.85, prod: 1.7, speed: 1.1, blurb: 'Production très rapide, mais fragiles' },
  { hp: 0.95, dmg: 0.95, prod: 1.1, speed: 1.35, blurb: 'Très rapides, un peu légers' },
  { hp: 1.4, dmg: 1.25, prod: 0.6, speed: 0.9, blurb: 'Très forts, mais lents à produire' },
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
