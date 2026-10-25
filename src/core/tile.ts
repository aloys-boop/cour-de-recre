import { TUNING } from '../config';
import { NO_TEAM, type Suit, type TileDef } from './types';

export type CaptureEvent = { kind: 'captured'; team: number } | { kind: 'neutralized' } | null;

/** Une case marquée d'un symbole : possession, jauge de capture, minuterie d'apparition. */
export class Tile {
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
  readonly suit: Suit;
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
    this.x = def.x;
    this.y = def.y;
    this.cx = def.x + 0.5;
    this.cy = def.y + 0.5;
    this.suit = def.suit;
    this.owner = def.owner ?? NO_TEAM;
  }

  /** La position (continue) est-elle sur la case ? */
  contains(px: number, py: number, r = TUNING.tileRadius): boolean {
    return Math.abs(px - this.cx) <= r && Math.abs(py - this.cy) <= r;
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
  const speed = Math.min(2, Math.sqrt(count)) / TUNING.captureSeconds;

  if (present === tile.owner) {
    // Le propriétaire défend : la jauge adverse recule.
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
