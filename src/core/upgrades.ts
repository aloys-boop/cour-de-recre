// Améliorations payées en bons points.
//  - Globales (toute l'équipe, achetées une fois, valables pour tous ses élèves et tous ses camps,
//    y compris ceux capturés plus tard) : Production, Uniformes, Entraînement (3 niveaux chacune)
//    et le déblocage des classes d'élèves.
//  - Par camp : Défense (3 niveaux). Le pion, la classe produite et le point de ralliement sont
//    aussi propres à chaque camp (voir pion.ts, classes.ts, world.ts). Un camp capturé perd tout
//    cela, mais profite aussitôt des améliorations globales de son nouveau propriétaire.
import { canAfford, spendMerits } from './merits';
import type { Tile } from './tile';
import type { World } from './world';

export type GlobalBranch = 'prod' | 'hp' | 'dmg';
export type UpgradeBranch = GlobalBranch | 'def';

export const GLOBAL_BRANCHES: readonly GlobalBranch[] = ['prod', 'hp', 'dmg'];
export const UPGRADE_BRANCHES: readonly UpgradeBranch[] = ['prod', 'hp', 'dmg', 'def'];

export const MAX_UPGRADE_LEVEL = 3;

export interface UpgradeInfo {
  label: string;
  /** Effet d'un niveau, en clair (panneau du camp). */
  effect: string;
  /** Gain par niveau (0,15 = +15 %). */
  perLevel: number;
  /** Coût des niveaux 1, 2 et 3. */
  costs: [number, number, number];
  /** Couleur du fanion. */
  color: string;
}

/**
 * Réglages (valeurs réglées par simulation IA contre IA, voir README) : une amélioration globale
 * vaut plus cher qu'une amélioration d'un seul camp.
 */
export const UPGRADES: Record<UpgradeBranch, UpgradeInfo> = {
  prod: { label: 'Production', effect: 'production de tous tes camps', perLevel: 0.15, costs: [40, 80, 140], color: '#5fd35a' },
  hp: { label: 'Uniformes', effect: 'PV de tous tes élèves', perLevel: 0.1, costs: [40, 80, 140], color: '#4fa3ff' },
  dmg: { label: 'Entraînement', effect: 'dégâts de tous tes élèves', perLevel: 0.1, costs: [40, 80, 140], color: '#ff6a4a' },
  def: { label: 'Défense', effect: 'prise plus lente, soins plus rapides', perLevel: 0.3, costs: [20, 40, 70], color: '#c9c9d4' },
};

/** Déblocage des classes d'élèves (Costaud, Sprinteur, Infirmier) pour toute l'équipe. */
export const CLASS_UNLOCK = { label: 'Classes d’élèves', effect: 'tous tes camps peuvent produire costauds, sprinteurs, infirmiers', cost: 60 };

/** Améliorations globales d'une équipe. */
export interface TeamUpgrades {
  prod: number;
  hp: number;
  dmg: number;
  classes: boolean;
}

export function freshTeamUpgrades(): TeamUpgrades {
  return { prod: 0, hp: 0, dmg: 0, classes: false };
}

/** Améliorations globales d'une équipe (objet vide pour une équipe hors partie). */
export function teamUpgrades(world: World, team: number): TeamUpgrades {
  return world.teamUpgrades[team] ?? freshTeamUpgrades();
}

export type UpgradeResult = 'ok' | 'pas-ton-camp' | 'max' | 'pas-assez' | 'deja';

/** Coût du prochain niveau d'une amélioration globale, ou null au maximum. */
export function globalCost(world: World, team: number, branch: GlobalBranch): number | null {
  const lvl = teamUpgrades(world, team)[branch];
  return lvl >= MAX_UPGRADE_LEVEL ? null : UPGRADES[branch].costs[lvl];
}

/** Achète le niveau suivant d'une amélioration globale (toute l'équipe). */
export function buyGlobal(world: World, team: number, branch: GlobalBranch): UpgradeResult {
  const up = world.teamUpgrades[team];
  if (!up) return 'pas-ton-camp';
  const cost = globalCost(world, team, branch);
  if (cost === null) return 'max';
  if (!canAfford(world, team, cost)) return 'pas-assez';
  spendMerits(world, team, cost);
  up[branch]++;
  // Les élèves déjà sur le terrain en profitent aussitôt (PV et dégâts suivent les multiplicateurs d'équipe).
  world.refreshMods();
  return 'ok';
}

/** Débloque les classes d'élèves pour toute l'équipe. */
export function buyClassUnlock(world: World, team: number): UpgradeResult {
  const up = world.teamUpgrades[team];
  if (!up) return 'pas-ton-camp';
  if (up.classes) return 'deja';
  if (!canAfford(world, team, CLASS_UNLOCK.cost)) return 'pas-assez';
  spendMerits(world, team, CLASS_UNLOCK.cost);
  up.classes = true;
  return 'ok';
}

/** Coût du prochain niveau de Défense d'un camp, ou null au maximum. */
export function defenseCost(tile: Tile): number | null {
  return tile.defense >= MAX_UPGRADE_LEVEL ? null : UPGRADES.def.costs[tile.defense];
}

/** Achète le niveau suivant de Défense d'un camp de l'équipe. */
export function buyDefense(world: World, team: number, tile: Tile): UpgradeResult {
  if (!tile.isCamp || tile.owner !== team) return 'pas-ton-camp';
  const cost = defenseCost(tile);
  if (cost === null) return 'max';
  if (!canAfford(world, team, cost)) return 'pas-assez';
  spendMerits(world, team, cost);
  tile.defense++;
  return 'ok';
}

/** Multiplicateurs globaux d'une équipe (appliqués avec le profil et les cases bonus). */
export function teamProdMul(world: World, team: number): number {
  return 1 + UPGRADES.prod.perLevel * teamUpgrades(world, team).prod;
}

export function teamHpMul(world: World, team: number): number {
  return 1 + UPGRADES.hp.perLevel * teamUpgrades(world, team).hp;
}

export function teamDmgMul(world: World, team: number): number {
  return 1 + UPGRADES.dmg.perLevel * teamUpgrades(world, team).dmg;
}

/**
 * Défense : le camp se capture plus lentement (+30 % de temps par niveau) et soigne
 * plus vite (+30 % par niveau).
 */
export function campDefenseMul(tile: Tile): number {
  return 1 + UPGRADES.def.perLevel * tile.defense;
}

/** Total des niveaux globaux d'une équipe (classes débloquées : 1) — IA, affichage. */
export function totalTeamUpgrades(world: World, team: number): number {
  const u = teamUpgrades(world, team);
  return u.prod + u.hp + u.dmg + (u.classes ? 1 : 0);
}
