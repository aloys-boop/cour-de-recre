// Ressource « bons points » : chaque équipe en gagne en jouant et les dépense
// (améliorations de camp, classes d'élèves, pouvoirs, pion).
// Logique pure, sans DOM : appelée par World, testée par Vitest.
import type { World } from './world';

/**
 * Gains de bons points (valeurs réglées par simulation IA contre IA, voir README) :
 *  - koUnit : élève ennemi mis KO (l'équipe qui porte le dernier coup) ;
 *  - captureBonus / captureCamp : case bonus ou camp capturé (le trône compte comme un camp) ;
 *  - holdPerTile : toutes les `holdEvery` secondes, par case tenue (cases bonus, camps et trône) ;
 *  - supervisor : surveillant mis KO (dernier coup, option « Surveillants »).
 */
export const MERITS = {
  koUnit: 2,
  captureBonus: 10,
  captureCamp: 25,
  holdPerTile: 1,
  holdEvery: 10,
  supervisor: 40,
};

/** Pourquoi une équipe gagne des bons points (effets et annonces). */
export type MeritReason = 'ko' | 'capture' | 'hold' | 'supervisor';

export interface MeritEvent {
  kind: 'merit';
  x: number;
  y: number;
  team: number;
  amount: number;
  reason: MeritReason;
}

/** Bons points de chaque équipe, portés par le monde. */
export class MeritState {
  /** Solde courant. */
  readonly points: number[];
  /** Total gagné et total dépensé depuis le début de la partie (statistiques, équilibrage). */
  readonly earned: number[];
  readonly spent: number[];
  /** Temps écoulé depuis le dernier versement des cases tenues. */
  holdTimer = 0;

  constructor(numTeams: number) {
    this.points = new Array<number>(numTeams).fill(0);
    this.earned = new Array<number>(numTeams).fill(0);
    this.spent = new Array<number>(numTeams).fill(0);
  }
}

/** Ajoute des bons points à une équipe (et l'annonce par un événement « merit »). */
export function awardMerit(world: World, team: number, amount: number, x: number, y: number, reason: MeritReason): void {
  const m = world.merits;
  if (team < 0 || team >= m.points.length || amount <= 0) return;
  m.points[team] += amount;
  m.earned[team] += amount;
  world.events.push({ kind: 'merit', x, y, team, amount, reason });
}

/** Solde d'une équipe. */
export function meritsOf(world: World, team: number): number {
  return world.merits.points[team] ?? 0;
}

/** L'équipe a-t-elle de quoi payer ? */
export function canAfford(world: World, team: number, cost: number): boolean {
  return meritsOf(world, team) >= cost;
}

/** Dépense des bons points ; faux (et rien n'est retiré) si le solde ne suffit pas. */
export function spendMerits(world: World, team: number, cost: number): boolean {
  if (cost < 0 || !canAfford(world, team, cost)) return false;
  world.merits.points[team] -= cost;
  world.merits.spent[team] += cost;
  return true;
}

/** Versement périodique : +holdPerTile par case tenue, toutes les holdEvery secondes. */
export function updateMerits(world: World, dt: number): void {
  const m = world.merits;
  m.holdTimer += dt;
  if (m.holdTimer < MERITS.holdEvery) return;
  m.holdTimer -= MERITS.holdEvery;
  const held = new Array<number>(world.numTeams).fill(0);
  for (const t of world.tiles) if (t.owner >= 0 && t.owner < world.numTeams) held[t.owner]++;
  for (let team = 0; team < world.numTeams; team++) {
    if (held[team] === 0) continue;
    // Point d'affichage : le premier camp de l'équipe (ou sa première case).
    const at = world.tiles.find((t) => t.owner === team && t.isCamp) ?? world.tiles.find((t) => t.owner === team)!;
    awardMerit(world, team, held[team] * MERITS.holdPerTile, at.cx, at.cy, 'hold');
  }
}

/** Bons points rapportés par la capture d'une case. */
export function captureReward(kind: 'camp' | 'bonus' | 'throne'): number {
  return kind === 'bonus' ? MERITS.captureBonus : MERITS.captureCamp;
}
