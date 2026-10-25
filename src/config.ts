import type { Difficulty } from './core/types';

export const TEAM_NAMES = ['Noir', 'Vert', 'Jaune', 'Violet'] as const;

/** Couleur d'uniforme, version claire (HUD) et version sombre (ombres). */
export const TEAM_COLORS = [
  { main: '#2b2b33', light: '#5c5c6b', dark: '#15151a', ui: '#3a3a46', text: '#ffffff' },
  { main: '#2f9e44', light: '#69c56f', dark: '#1b6b2b', ui: '#2f9e44', text: '#ffffff' },
  { main: '#f2c22e', light: '#ffe27a', dark: '#b58a10', ui: '#e0b020', text: '#2b2b33' },
  { main: '#7a3fb5', light: '#b07be0', dark: '#4e2378', ui: '#7a3fb5', text: '#ffffff' },
] as const;

/** Teinte des cases possédées (plus claire que l'uniforme pour rester lisible). */
export const TEAM_TILE_COLORS = ['#6d6d7a', '#7fd48a', '#ffe066', '#c08ae8'] as const;

export const TUNING = {
  unitHp: 60,
  unitSpeed: 2.6, // cellules par seconde
  punchDamageMin: 7,
  punchDamageMax: 11,
  punchInterval: 0.75, // secondes entre deux coups
  punchRange: 0.55, // distance de contact (cellules)
  aggroRange: 2.2, // distance à laquelle un élève inoccupé engage un ennemi
  knockback: 0.22,
  unitRadius: 0.22,
  captureSeconds: 3.0, // temps de capture pour un seul élève
  captureDecayPerSec: 0.15, // retour à zéro d'une jauge abandonnée
  koSeconds: 1.6, // durée pendant laquelle l'élève KO reste visible
  tileRadius: 0.6, // demi-côté (en cellules) de la zone d'une case
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
  facile: { reaction: 2.6, groupMin: 5, keepHome: 0.5, aggression: 0.3, rallyRadius: 1.6, damage: 0.7 },
  normal: { reaction: 1.5, groupMin: 4, keepHome: 0.35, aggression: 0.6, rallyRadius: 1.4, damage: 1 },
  difficile: { reaction: 0.8, groupMin: 3, keepHome: 0.2, aggression: 0.9, rallyRadius: 1.2, damage: 1.15 },
};

export const STORAGE_KEY = 'cour-de-recre.v1';
