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
  /** Camp fantôme (neutre au départ, voir ghosts.ts). */
  readonly ghost: boolean;
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
    this.ghost = def.kind === 'camp' && def.ghost === true;
  }

  get isCamp(): boolean {
    return this.kind === 'camp';
  }

  /** La position (continue) est-elle sur la case ? */
  contains(px: number, py: number, half = this.half): boolean {
    return Math.abs(px - this.cx) <= half && Math.abs(py - this.cy) <= half;
  }
}

/** Deux équipes sont-elles amies (même équipe ou alliées) ? */
export type FriendFn = (a: number, b: number) => boolean;

const SAME_TEAM: FriendFn = (a, b) => a === b;

/**
 * Fait avancer la capture d'une case pour un pas de temps.
 * `presence[t]` = nombre d'élèves vivants de l'équipe t sur la case.
 * `friends(a, b)` dit si deux équipes sont alliées (par défaut : seulement elles-mêmes).
 * Règles :
 *  - des équipes non alliées présentes : contestée, rien ne bouge ;
 *  - seuls des alliés présents : la capture avance pour celle qui capturait déjà,
 *    sinon pour la plus nombreuse (les alliés présents l'aident) ;
 *  - une équipe (ou alliance) présente, ni propriétaire ni alliée du propriétaire :
 *    elle vide la jauge adverse puis remplit la sienne ; jauge pleine → la case change de main ;
 *  - le propriétaire ou un de ses alliés : il efface la jauge adverse (un allié ne prend
 *    jamais la case d'un allié) ;
 *  - personne : la jauge se vide lentement.
 * Un camp se capture plus lentement qu'une case bonus.
 */
export function updateCapture(tile: Tile, presence: number[], dt: number, friends: FriendFn = SAME_TEAM): CaptureEvent {
  let teamsPresent = 0;
  let total = 0;
  let first = -1;
  let contested = false;
  for (let t = 0; t < presence.length; t++) {
    if (presence[t] <= 0) continue;
    teamsPresent++;
    total += presence[t];
    if (first < 0) first = t;
    else if (!contested) {
      // Contestée dès que deux équipes présentes ne sont pas alliées.
      for (let o = 0; o < t; o++) {
        if (presence[o] > 0 && !friends(o, t)) {
          contested = true;
          break;
        }
      }
    }
  }

  if (contested) {
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

  // Une seule équipe, ou des alliés seulement : qui fait avancer la capture ?
  let present = first;
  if (teamsPresent > 1) {
    if (tile.owner !== NO_TEAM && presence[tile.owner] > 0) present = tile.owner;
    else if (tile.capTeam !== NO_TEAM && presence[tile.capTeam] > 0) present = tile.capTeam;
    else for (let t = 0; t < presence.length; t++) if (presence[t] > presence[present]) present = t;
  }
  const count = total;
  const seconds = TUNING.captureSeconds * (tile.isCamp ? TUNING.campCaptureFactor : 1);
  const speed = Math.min(2, Math.sqrt(count)) / seconds;

  if (present === tile.owner || (tile.owner !== NO_TEAM && friends(present, tile.owner))) {
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
