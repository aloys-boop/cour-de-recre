// Dépenses de bons points des IA : améliorations de camp (puis classes, pouvoirs et pion).
// Stratégie selon la difficulté : en Facile, achats lents et au hasard ; en Normal, achats
// raisonnés ; en Difficile, achats rapides qui suivent la situation (camp menacé → Défense).
import { meritsOf } from './merits';
import { Rng } from './rng';
import type { Tile } from './tile';
import { NO_TEAM, type Difficulty } from './types';
import { buyUpgrade, MAX_UPGRADE_LEVEL, upgradeCost, UPGRADE_BRANCHES, type UpgradeBranch } from './upgrades';
import type { World } from './world';

export interface EconomyProfile {
  /** Secondes entre deux décisions d'achat. */
  interval: number;
  /** Niveau maximal visé dans une branche. */
  maxLevel: number;
  /** Achat seulement si le solde couvre `margin` fois le coût (épargne). */
  margin: number;
  /** Choix raisonné (sinon : branche au hasard parmi Production, Uniformes, Entraînement). */
  smart: boolean;
}

export const ECONOMY_PROFILES: Record<Difficulty, EconomyProfile> = {
  facile: { interval: 9, maxLevel: 2, margin: 1.5, smart: false },
  normal: { interval: 4, maxLevel: 3, margin: 1, smart: true },
  difficile: { interval: 2, maxLevel: 3, margin: 1, smart: true },
};

/** Poids de base de chaque branche dans le choix raisonné. */
const BRANCH_WEIGHT: Record<UpgradeBranch, number> = { prod: 1.25, hp: 1, dmg: 1.05, def: 0.45 };

export class EconomyAi {
  readonly profile: EconomyProfile;
  /** Faux : l'IA ne dépense rien (outils d'équilibrage). */
  enabled = true;
  private timer: number;
  /** Hasard propre (le tirage du monde reste inchangé : mêmes parties qu'avant les bons points). */
  private rng: Rng;

  constructor(
    readonly world: World,
    readonly team: number,
    readonly difficulty: Difficulty,
  ) {
    this.profile = ECONOMY_PROFILES[difficulty];
    this.rng = new Rng(((world.map.seed ?? 1) * 31 + team * 977 + 5) >>> 0);
    this.timer = this.profile.interval * (0.5 + 0.1 * team);
  }

  update(dt: number): void {
    if (!this.enabled) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.profile.interval * (0.85 + 0.3 * this.rng.next());
    this.think();
  }

  /** Une décision : au plus un achat par réflexion (les achats s'étalent dans le temps). */
  think(): void {
    const w = this.world;
    const camps = w.tiles.filter((t) => t.isCamp && t.owner === this.team);
    if (camps.length === 0) return;
    const pick = this.profile.smart ? this.bestUpgrade(camps) : this.randomUpgrade(camps);
    if (!pick) return;
    const cost = upgradeCost(pick.camp, pick.branch);
    if (cost === null || meritsOf(w, this.team) < cost * this.profile.margin) return;
    buyUpgrade(w, this.team, pick.camp, pick.branch);
  }

  private randomUpgrade(camps: Tile[]): { camp: Tile; branch: UpgradeBranch } | null {
    const camp = camps[Math.floor(this.rng.next() * camps.length)];
    const options = (['prod', 'hp', 'dmg'] as UpgradeBranch[]).filter((b) => camp.upgrades[b] < Math.min(this.profile.maxLevel, MAX_UPGRADE_LEVEL));
    if (options.length === 0) return null;
    return { camp, branch: options[Math.floor(this.rng.next() * options.length)] };
  }

  /** Meilleur achat : poids de la branche, situation du camp, coût du niveau. */
  private bestUpgrade(camps: Tile[]): { camp: Tile; branch: UpgradeBranch } | null {
    const w = this.world;
    const capped = w.teamUnitCount(this.team) >= w.map.unitCap * 0.9;
    let best: { camp: Tile; branch: UpgradeBranch } | null = null;
    let bestScore = 0;
    for (const camp of camps) {
      const threat = this.threat(camp);
      for (const branch of UPGRADE_BRANCHES) {
        if (camp.upgrades[branch] >= this.profile.maxLevel) continue;
        const cost = upgradeCost(camp, branch);
        if (cost === null) continue;
        let score = BRANCH_WEIGHT[branch];
        // Au plafond d'élèves, produire plus vite ne sert à rien.
        if (branch === 'prod' && capped) score *= 0.3;
        if (branch === 'def') score += threat * 0.9;
        // Un camp menacé ne mérite pas qu'on y investisse autre chose que sa défense.
        else if (threat > 1) score *= 0.5;
        score /= cost / 20;
        if (score > bestScore) {
          bestScore = score;
          best = { camp, branch };
        }
      }
    }
    return best;
  }

  /** Menace sur un camp : ennemis proches et jauge de capture adverse. */
  private threat(camp: Tile): number {
    const w = this.world;
    let n = 0;
    w.hash.query(camp.cx, camp.cy, 4, (u) => {
      if (u.alive && !w.isFriend(u.team, this.team)) n++;
    });
    const capturing = camp.capTeam !== NO_TEAM && !w.isFriend(camp.capTeam, this.team);
    return Math.min(3, n / 4 + (capturing ? 1.5 : 0));
  }
}
