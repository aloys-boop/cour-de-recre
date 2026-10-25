// Types partagés par la simulation (logique pure, sans DOM).

export type TeamId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const NO_TEAM = -1;

export type Suit = 'spade' | 'heart' | 'diamond' | 'club';

export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 = Est (x+), sens horaire en coordonnées grille

export type Anim = 'idle' | 'walk' | 'punch' | 'ko';

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Une case au sol.
 *  - `camp` : base d'une équipe (2 × 2 cellules), produit les élèves ;
 *  - `bonus` : case blanche marquée d'un symbole, donne un bonus à son propriétaire ;
 *  - `throne` : trône du mode « Roi de la cour » (2 × 2, sans bonus ni production, voir king.ts).
 */
export interface TileDef {
  kind: 'camp' | 'bonus' | 'throne';
  /** Coin nord de la case (cellule). */
  x: number;
  y: number;
  /** Symbole des cases bonus. */
  suit?: Suit;
  /** Équipe propriétaire au départ (obligatoire pour un camp, sauf camp fantôme). */
  owner?: TeamId;
  /** Camp fantôme : camp sans propriétaire au départ (option d'escarmouche, voir ghosts.ts). */
  ghost?: boolean;
}

export interface MapDef {
  id: string;
  name: string;
  /** Dimensions du sol (en cellules). */
  w: number;
  h: number;
  /** Nombre d'équipes en jeu sur cette carte. */
  teams: number;
  /** Plafond d'unités par équipe. */
  unitCap: number;
  /** Secondes entre deux apparitions dans un camp (avant bonus et profil d'équipe). */
  spawnInterval: number;
  /** Nombre d'élèves de départ par équipe. */
  startUnits: number;
  tiles: TileDef[];
  /** Obstacles infranchissables (cellules). */
  obstacles?: Vec2[];
  /** Graine du tirage (cartes générées). */
  seed?: number;
}

export type Difficulty = 'facile' | 'normal' | 'difficile';

export interface UnitOrder {
  kind: 'move' | 'attack' | 'none';
  target: Vec2;
  /** Identifiant de l'unité visée (ordre d'attaque). */
  unitId?: number;
  /**
   * Déplacement « offensif » : l'élève se bat contre ce qu'il croise (IA).
   * Sans ce drapeau, un ordre de déplacement est un repli : l'élève court sans riposter.
   */
  engage?: boolean;
}
