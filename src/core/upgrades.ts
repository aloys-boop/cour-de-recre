// Améliorations de camp, payées en bons points : 4 branches de 3 niveaux, propres à chaque camp.
// Un camp capturé perd ses améliorations (voir Tile.owner).
import { canAfford, spendMerits } from './merits';
import type { Tile } from './tile';
import type { World } from './world';

export type UpgradeBranch = 'prod' | 'hp' | 'dmg' | 'def';

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
  /** Couleur du fanion sur le camp. */
  color: string;
}

/** Réglages des branches (coûts croissants ; valeurs réglées par simulation, voir README). */
export const UPGRADES: Record<UpgradeBranch, UpgradeInfo> = {
  prod: { label: 'Production', effect: 'élèves produits plus vite', perLevel: 0.15, costs: [25, 50, 90], color: '#5fd35a' },
  hp: { label: 'Uniformes', effect: 'PV des élèves du camp', perLevel: 0.1, costs: [25, 50, 90], color: '#4fa3ff' },
  dmg: { label: 'Entraînement', effect: 'dégâts des élèves du camp', perLevel: 0.1, costs: [25, 50, 90], color: '#ff6a4a' },
  def: { label: 'Défense', effect: 'prise plus lente, soins', perLevel: 0.3, costs: [20, 40, 70], color: '#c9c9d4' },
};

/** Niveaux d'améliorations d'un camp (tous à 0 pour un camp neuf ou capturé). */
export type CampUpgrades = Record<UpgradeBranch, number>;

export function freshUpgrades(): CampUpgrades {
  return { prod: 0, hp: 0, dmg: 0, def: 0 };
}

/** Coût du prochain niveau d'une branche, ou null si elle est au maximum. */
export function upgradeCost(tile: Tile, branch: UpgradeBranch): number | null {
  const lvl = tile.upgrades[branch];
  return lvl >= MAX_UPGRADE_LEVEL ? null : UPGRADES[branch].costs[lvl];
}

export type UpgradeResult = 'ok' | 'pas-ton-camp' | 'max' | 'pas-assez';

/** Achète le niveau suivant d'une branche pour un camp de l'équipe. */
export function buyUpgrade(world: World, team: number, tile: Tile, branch: UpgradeBranch): UpgradeResult {
  if (!tile.isCamp || tile.owner !== team) return 'pas-ton-camp';
  const cost = upgradeCost(tile, branch);
  if (cost === null) return 'max';
  if (!canAfford(world, team, cost)) return 'pas-assez';
  spendMerits(world, team, cost);
  tile.upgrades[branch]++;
  return 'ok';
}

/** Multiplicateur de vitesse de production du camp (Production : +15 % par niveau). */
export function campProdMul(tile: Tile): number {
  return 1 + UPGRADES.prod.perLevel * tile.upgrades.prod;
}

/** Multiplicateur de PV des élèves sortis du camp (Uniformes : +10 % par niveau). */
export function campHpMul(tile: Tile): number {
  return 1 + UPGRADES.hp.perLevel * tile.upgrades.hp;
}

/** Multiplicateur de dégâts des élèves sortis du camp (Entraînement : +10 % par niveau). */
export function campDmgMul(tile: Tile): number {
  return 1 + UPGRADES.dmg.perLevel * tile.upgrades.dmg;
}

/**
 * Défense : le camp se capture plus lentement (+30 % de temps par niveau) et soigne
 * plus vite (+30 % par niveau). Vaut 1 pour une case qui n'est pas un camp.
 */
export function campDefenseMul(tile: Tile): number {
  return 1 + UPGRADES.def.perLevel * tile.upgrades.def;
}

/** Somme des niveaux d'un camp (affichage, IA). */
export function totalUpgrades(tile: Tile): number {
  return tile.upgrades.prod + tile.upgrades.hp + tile.upgrades.dmg + tile.upgrades.def;
}
