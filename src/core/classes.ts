// Classes d'élèves : chaque camp choisit ce qu'il produit (panneau du camp). Les classes
// spéciales se débloquent au niveau 2 de Production du camp et se paient en bons points
// à chaque élève produit ; faute de bons points (ou au-delà de la limite), le camp produit
// un élève normal.
import { TUNING } from '../config';
import { canAfford, spendMerits } from './merits';
import type { Tile } from './tile';
import type { Unit } from './unit';
import type { World } from './world';

export type UnitClass = 'eleve' | 'costaud' | 'sprinteur' | 'infirmier';

export const UNIT_CLASSES: readonly UnitClass[] = ['eleve', 'costaud', 'sprinteur', 'infirmier'];

export interface ClassInfo {
  label: string;
  /** Description courte (panneau du camp). */
  blurb: string;
  /** Bons points payés à la production de chaque élève de cette classe. */
  cost: number;
  hp: number;
  speed: number;
  dmg: number;
  /** Poids dans la jauge de capture (un élève normal : 1 ; la vitesse de capture suit la racine du total). */
  capture: number;
  /** Soin des alliés proches (PV/s) et rayon (cellules). */
  heal: number;
  healRadius: number;
  /** Nombre maximal par équipe (0 : illimité). */
  max: number;
}

export const CLASSES: Record<UnitClass, ClassInfo> = {
  eleve: { label: 'Élève', blurb: 'Gratuit', cost: 0, hp: 1, speed: 1, dmg: 1, capture: 1, heal: 0, healRadius: 0, max: 0 },
  costaud: { label: 'Costaud', blurb: 'PV ×2, lent', cost: 5, hp: 2, speed: 0.75, dmg: 1, capture: 1, heal: 0, healRadius: 0, max: 0 },
  // Poids 4 : seul sur une case, il capture deux fois plus vite qu'un élève (√4 = 2).
  sprinteur: { label: 'Sprinteur', blurb: 'Vitesse ×1,4, capture ×2, PV ×0,7', cost: 4, hp: 0.7, speed: 1.4, dmg: 1, capture: 4, heal: 0, healRadius: 0, max: 0 },
  infirmier: { label: 'Infirmier', blurb: 'Soigne 4 PV/s autour de lui, frappe à peine', cost: 6, hp: 1, speed: 1, dmg: 0.25, capture: 1, heal: 4, healRadius: 2.2, max: 3 },
};

/** Niveau de Production du camp qui débloque les classes spéciales. */
export const CLASS_UNLOCK_LEVEL = 2;

/** Le camp peut-il produire cette classe (débloquée) ? */
export function classUnlocked(tile: Tile, cls: UnitClass): boolean {
  return cls === 'eleve' || tile.upgrades.prod >= CLASS_UNLOCK_LEVEL;
}

export type ProduceResult = 'ok' | 'pas-ton-camp' | 'verrouille';

/** Choisit ce que produit un camp de l'équipe. */
export function setProduce(team: number, tile: Tile, cls: UnitClass): ProduceResult {
  if (!tile.isCamp || tile.owner !== team) return 'pas-ton-camp';
  if (!classUnlocked(tile, cls)) return 'verrouille';
  tile.produce = cls;
  return 'ok';
}

/** Élèves vivants d'une classe dans une équipe. */
export function classCount(world: World, team: number, cls: UnitClass): number {
  let n = 0;
  for (const u of world.units) if (u.team === team && u.alive && u.cls === cls) n++;
  return n;
}

/**
 * Classe effectivement produite par un camp maintenant : celle choisie si elle est débloquée,
 * sous sa limite et payable (les bons points sont alors dépensés), sinon un élève normal.
 */
export function takeSpawnClass(world: World, tile: Tile): UnitClass {
  const cls = tile.produce;
  if (cls === 'eleve' || !classUnlocked(tile, cls)) return 'eleve';
  const info = CLASSES[cls];
  if (info.max > 0 && classCount(world, tile.owner, cls) >= info.max) return 'eleve';
  if (!canAfford(world, tile.owner, info.cost)) return 'eleve';
  spendMerits(world, tile.owner, info.cost);
  return cls;
}

/** Donne à un élève les caractéristiques de sa classe (avant le calcul de ses PV). */
export function applyClass(u: Unit, cls: UnitClass): void {
  const info = CLASSES[cls];
  u.cls = cls;
  u.hpMul *= info.hp;
  u.dmgMul *= info.dmg;
  u.speedMul *= info.speed;
}

/** Les infirmiers soignent les élèves amis (leur équipe et leurs alliés) autour d'eux. */
export function updateHealers(world: World, dt: number): void {
  for (const h of world.units) {
    if (!h.alive || h.cls !== 'infirmier') continue;
    const info = CLASSES.infirmier;
    const r2 = info.healRadius * info.healRadius;
    world.hash.query(h.x, h.y, info.healRadius, (u) => {
      if (u === h || !u.alive || u.hp >= u.maxHp || !world.isFriend(u.team, h.team)) return;
      const dx = u.x - h.x;
      const dy = u.y - h.y;
      if (dx * dx + dy * dy > r2) return;
      u.hp = Math.min(u.maxHp, u.hp + info.heal * dt);
      u.healedAt = world.time;
    });
  }
}

/**
 * Un infirmier ne se bat jamais de lui-même (il reste au milieu des siens pour les soigner) :
 * il ne frappe que sur un ordre d'attaque explicite.
 */
export function pacifist(u: Unit): boolean {
  return u.cls === 'infirmier' && u.order.kind !== 'attack';
}

/** Rayon d'engagement spontané : un infirmier ne va pas chercher la bagarre. */
export function aggroRange(u: Unit): number {
  return u.cls === 'infirmier' ? TUNING.punchRange * 1.6 : TUNING.aggroRange;
}
