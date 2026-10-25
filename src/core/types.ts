// Types partagés par la simulation (logique pure, sans DOM).

export type TeamId = 0 | 1 | 2 | 3;
export const NO_TEAM = -1;

export type Suit = 'spade' | 'heart' | 'diamond' | 'club';

export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0 = Est (x+), sens horaire en coordonnées grille

export type Anim = 'idle' | 'walk' | 'punch' | 'ko';

export interface Vec2 {
  x: number;
  y: number;
}

export interface TileDef {
  x: number;
  y: number;
  suit: Suit;
  /** Équipe qui possède la case au départ (facultatif). */
  owner?: TeamId;
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
  /** Secondes entre deux apparitions sur une case possédée. */
  spawnInterval: number;
  /** Nombre d'élèves de départ par équipe. */
  startUnits: number;
  tiles: TileDef[];
  /** Obstacles infranchissables (cellules). */
  obstacles?: Vec2[];
}

export type Difficulty = 'facile' | 'normal' | 'difficile';

export interface UnitOrder {
  kind: 'move' | 'attack' | 'none';
  target: Vec2;
  /** Identifiant de l'unité visée (ordre d'attaque). */
  unitId?: number;
}
