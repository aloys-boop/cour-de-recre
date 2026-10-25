import { TUNING } from '../config';
import { NO_TEAM, type Suit, type TileDef } from './types';

export type CaptureEvent = { kind: 'captured'; team: number } | null;

/**
 * Une case au sol : camp d'équipe (2 × 2) ou case bonus (1 × 1) marquée d'un symbole.
 * Porte la possession, la jauge de capture et, pour un camp, la minuterie d'apparition.
 */
export class Tile {
  readonly kind: 'camp' | 'bonus';
  /** Coin nord (cellule). */
  readonly x: number;
  readonly y: number;
  /** Centre (continu). */
  readonly cx: number;
  readonly cy: number;
  /** Côté en cellules (1 ou 2). */
  readonly size: number;
  readonly suit: Suit | null;
  /** Demi-côté de la zone de capture. */
  readonly half: number;
  /** Équipe propriétaire ou NO_TEAM. */
  owner: number;
  /** Équipe qui remplit la jauge, ou NO_TEAM. */
  capTeam: number = NO_TEAM;
  /** Jauge 0..1. */
  cap = 0;
  /** Vrai quand plusieurs équipes sont dessus. */
  contested = false;
  spawnTimer = 0;

  constructor(def: TileDef) {
    this.kind = def.kind;
    this.x = def.x;
    this.y = def.y;
    this.size = def.kind === 'camp' ? 2 : 1;
    this.cx = def.x + this.size / 2;
    this.cy = def.y + this.size / 2;
    this.suit = def.suit ?? null;
    this.half = def.kind === 'camp' ? TUNING.campHalf : TUNING.bonusTileHalf;
    this.owner = def.owner ?? NO_TEAM;
  }

  get isCamp(): boolean {
    return this.kind === 'camp';
  }

  /** La position (continue) est-elle sur la case ? */
  contains(px: number, py: number, half = this.half): boolean {
    return Math.abs(px - this.cx) <= half && Math.abs(py - this.cy) <= half;
  }
}

/**
 * Fait avancer la capture d'une case pour un pas de temps.
 * `presence[t]` = nombre d'élèves vivants de l'équipe t sur la case.
 * Règles :
 *  - plusieurs équipes présentes : contestée, rien ne bouge ;
 *  - une seule équipe présente, différente du propriétaire : elle vide la jauge adverse
 *    puis remplit la sienne ; jauge pleine → la case change de main ;
 *  - le propriétaire seul : il efface la jauge adverse ;
 *  - personne : la jauge se vide lentement.
 * Un camp se capture plus lentement qu'une case bonus.
 */
export function updateCapture(tile: Tile, presence: number[], dt: number): CaptureEvent {
  let present = -1;
  let count = 0;
  let teamsPresent = 0;
  for (let t = 0; t < presence.length; t++) {
    if (presence[t] > 0) {
      teamsPresent++;
      present = t;
      count = presence[t];
    }
  }

  if (teamsPresent > 1) {
    tile.contested = true;
    return null;
  }
  tile.contested = false;

  if (teamsPresent === 0) {
    if (tile.capTeam !== NO_TEAM) {
      tile.cap -= TUNING.captureDecayPerSec * dt;
      if (tile.cap <= 0) {
        tile.cap = 0;
        tile.capTeam = NO_TEAM;
      }
    }
    return null;
  }

  // Une seule équipe présente.
  const seconds = TUNING.captureSeconds * (tile.isCamp ? TUNING.campCaptureFactor : 1);
  const speed = Math.min(2, Math.sqrt(count)) / seconds;

  if (present === tile.owner) {
    if (tile.capTeam !== NO_TEAM) {
      tile.cap -= speed * dt;
      if (tile.cap <= 0) {
        tile.cap = 0;
        tile.capTeam = NO_TEAM;
      }
    }
    return null;
  }

  if (tile.capTeam !== present) {
    if (tile.capTeam === NO_TEAM || tile.cap <= 0) {
      tile.capTeam = present;
      tile.cap = 0;
    } else {
      tile.cap -= speed * dt;
      if (tile.cap <= 0) {
        tile.cap = 0;
        tile.capTeam = present;
      }
      return null;
    }
  }

  tile.cap += speed * dt;
  if (tile.cap >= 1) {
    tile.owner = present;
    tile.cap = 0;
    tile.capTeam = NO_TEAM;
    tile.spawnTimer = 0;
    return { kind: 'captured', team: present };
  }
  return null;
}
