// Pion : surveillant aux couleurs d'une équipe, acheté une fois par camp. Il reste près de
// son camp et frappe les intrus ; mis KO, il revient 60 s plus tard tant que son équipe tient
// le camp. Un camp capturé perd son pion (comme ses améliorations).
//
// Le pion est un élève particulier de `world.units` (u.pion = true) : il se bat comme les autres
// (cible, coups, recul réduit), mais il ne compte pas dans l'effectif ni dans le plafond de
// l'équipe, ne se sélectionne pas et ne capture rien.
import { dist2 } from './math';
import { canAfford, spendMerits } from './merits';
import type { Tile } from './tile';
import type { Unit } from './unit';
import type { World } from './world';

export const PION = {
  /** Prix (une fois par camp). */
  cost: 120,
  hp: 400,
  /** Multiplicateur de dégâts d'un coup (un élève : 7 à 11). */
  dmg: 3,
  speed: 0.95,
  /** Rayon de garde autour du centre du camp : un ennemi qui y entre est attaqué. */
  guard: 3.2,
  /** Distance maximale de poursuite depuis le centre du camp. */
  leash: 4.5,
  /** Retour après un KO (secondes). */
  respawn: 60,
  /** Bons points pour l'équipe qui met un pion KO (dernier coup). */
  koReward: 20,
};

export type PionResult = 'ok' | 'pas-ton-camp' | 'deja' | 'pas-assez';

/** Le camp a-t-il un pion acheté (debout, ou KO en attente de retour) ? */
export function hasPion(tile: Tile): boolean {
  return tile.pionBought;
}

/** Pion debout d'un camp, ou null. */
export function pionOf(world: World, tile: Tile): Unit | null {
  for (const u of world.units) if (u.pion && u.home === tile && u.alive) return u;
  return null;
}

/** Secondes avant le retour du pion KO d'un camp (0 s'il est debout ou absent). */
export function pionRespawnLeft(world: World, tile: Tile): number {
  if (!tile.pionBought || pionOf(world, tile)) return 0;
  return Math.max(0, tile.pionRespawnAt - world.time);
}

/** Achète le pion d'un camp de l'équipe (une seule fois par camp). */
export function buyPion(world: World, team: number, tile: Tile): PionResult {
  if (!tile.isCamp || tile.owner !== team) return 'pas-ton-camp';
  if (tile.pionBought) return 'deja';
  if (!canAfford(world, team, PION.cost)) return 'pas-assez';
  spendMerits(world, team, PION.cost);
  tile.pionBought = true;
  spawnPion(world, tile);
  return 'ok';
}

function spawnPion(world: World, tile: Tile): Unit {
  const u = world.spawnUnit(tile.owner, tile.cx + 0.6, tile.cy + 0.6, false);
  u.pion = true;
  u.home = tile;
  u.maxHp = u.hp = PION.hp;
  u.dmgMul = PION.dmg;
  u.speedMul = PION.speed;
  tile.pionUp = true;
  return u;
}

/**
 * Comportement des pions (appelé avant les élèves à chaque pas) :
 *  - camp perdu : le pion s'en va ;
 *  - un ennemi dans le rayon de garde : le pion l'attaque (le plus proche du camp) ;
 *  - cible trop loin du camp, ou plus d'intrus : retour au camp ;
 *  - KO : retour 60 s plus tard.
 */
export function updatePions(world: World): void {
  // Pion d'un camp perdu (ou revendu) : il quitte la cour.
  for (const u of world.units) if (u.pion && u.alive && (!u.home || !u.home.pionBought || u.home.owner !== u.team)) u.takeDamage(u.hp, u.x, u.y);
  for (const t of world.tiles) {
    if (!t.isCamp || !t.pionBought) continue;
    const p = pionOf(world, t);
    if (!p) {
      // Il vient de tomber : retour programmé.
      if (t.pionUp) {
        t.pionUp = false;
        t.pionRespawnAt = world.time + PION.respawn;
      }
      if (t.pionRespawnAt <= world.time && t.owner >= 0) spawnPion(world, t);
      continue;
    }
    const L2 = PION.leash * PION.leash;
    const target = p.engagedId >= 0 ? world.unitById(p.engagedId) : undefined;
    if (target && target.alive && dist2(target.x, target.y, t.cx, t.cy) > L2) {
      p.engagedId = -1;
      p.pendingHit = 0;
    }
    if (p.engagedId < 0) {
      const intruder = nearestIntruder(world, p, t);
      if (intruder) {
        world.orderAttack([p], intruder.id);
        continue;
      }
      const home = dist2(p.x, p.y, t.cx, t.cy);
      if (home > 1.4 * 1.4 && (p.order.kind !== 'move' || dist2(p.order.target.x, p.order.target.y, t.cx, t.cy) > 1)) world.orderMove([p], { x: t.cx + 0.6, y: t.cy + 0.6 }, false);
    }
  }
}

function nearestIntruder(world: World, p: Unit, t: Tile): Unit | null {
  let best: Unit | null = null;
  let bd = PION.guard * PION.guard;
  world.hash.query(t.cx, t.cy, PION.guard, (u) => {
    if (!u.alive || world.isFriend(u.team, p.team)) return;
    const d = dist2(u.x, u.y, t.cx, t.cy);
    if (d < bd) {
      bd = d;
      best = u;
    }
  });
  return best;
}
