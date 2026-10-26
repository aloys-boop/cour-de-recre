// Dépenses de bons points des IA : améliorations de camp (puis classes, pouvoirs et pion).
// Stratégie selon la difficulté : en Facile, achats lents et au hasard ; en Normal, achats
// raisonnés ; en Difficile, achats rapides qui suivent la situation (camp menacé → Défense).
import { CLASSES, classCount, classUnlocked, type UnitClass } from './classes';
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
  /** Classes d'élèves : « rare » (un costaud de temps en temps, quand l'IA est riche) ou « mix » (mélange raisonné). */
  classes: 'rare' | 'mix';
  /** Solde minimal pour produire une classe payante (le reste sert aux améliorations). */
  classReserve: number;
}

export const ECONOMY_PROFILES: Record<Difficulty, EconomyProfile> = {
  facile: { interval: 9, maxLevel: 2, margin: 1.5, smart: false, classes: 'rare', classReserve: 60 },
  normal: { interval: 4, maxLevel: 3, margin: 1, smart: true, classes: 'mix', classReserve: 15 },
  difficile: { interval: 2, maxLevel: 3, margin: 1, smart: true, classes: 'mix', classReserve: 10 },
};

/** Mélange visé des classes (parts de l'armée) ; voir chooseClass. Mutables pour les essais d'équilibrage. */
export const CLASS_MIX = { costaud: 0.45, sprintBase: 0.05, sprintFree: 0.12, nursePer: 8 };

/** Poids de base de chaque branche dans le choix raisonné. */
const BRANCH_WEIGHT: Record<UpgradeBranch, number> = { prod: 1.25, hp: 1, dmg: 1.05, def: 0.45 };

export class EconomyAi {
  readonly profile: EconomyProfile;
  /** Faux : l'IA ne dépense rien (outils d'équilibrage). */
  enabled = true;
  /** Classes autorisées (outils d'équilibrage) : null = toutes, selon la stratégie ; sinon la seule classe produite. */
  forceClass: UnitClass | 'aucune' | null = null;
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
    if (pick) {
      const cost = upgradeCost(pick.camp, pick.branch);
      if (cost !== null && meritsOf(w, this.team) >= cost * this.profile.margin) buyUpgrade(w, this.team, pick.camp, pick.branch);
    }
    for (const camp of camps) {
      const f = this.forceClass;
      camp.produce = f === null ? this.chooseClass(camp) : f === 'aucune' || !classUnlocked(camp, f) ? 'eleve' : f;
    }
  }

  /**
   * Classe à produire dans un camp (débloquée au niveau 2 de Production). Mélange raisonné :
   *  - des infirmiers dès que l'armée compte une dizaine d'élèves (1 pour 6, 3 au plus) ;
   *  - des sprinteurs tant qu'il reste des cases libres à prendre (moins ensuite) ;
   *  - des costauds pour encaisser, d'autant plus que les combats sont nombreux ou le camp menacé ;
   * on prend la classe la plus en retard sur sa part visée ; faute de bons points, des élèves normaux.
   */
  chooseClass(camp: Tile): UnitClass {
    const w = this.world;
    if (!classUnlocked(camp, 'costaud')) return 'eleve';
    const points = meritsOf(w, this.team);
    if (points < this.profile.classReserve) return 'eleve';
    if (this.profile.classes === 'rare') return this.rng.next() < 0.5 ? 'costaud' : 'eleve';
    let n = 0;
    for (const u of w.units) if (u.team === this.team && u.alive) n++;
    const bonus = w.tiles.filter((t) => t.kind === 'bonus');
    const free = bonus.filter((t) => t.owner === NO_TEAM).length / Math.max(1, bonus.length);
    const threat = this.threat(camp);
    const target: Record<UnitClass, number> = {
      eleve: 0,
      costaud: CLASS_MIX.costaud + 0.1 * threat,
      sprinteur: CLASS_MIX.sprintBase + CLASS_MIX.sprintFree * free,
      infirmier: n >= 8 ? Math.min(CLASSES.infirmier.max, Math.floor(n / CLASS_MIX.nursePer)) / Math.max(1, n) : 0,
    };
    let best: UnitClass = 'eleve';
    let bestGap = 0.5; // au moins un demi-élève de retard
    for (const cls of ['infirmier', 'costaud', 'sprinteur'] as UnitClass[]) {
      if (CLASSES[cls].max > 0 && classCount(w, this.team, cls) >= CLASSES[cls].max) continue;
      const gap = target[cls] * n - classCount(w, this.team, cls);
      if (gap > bestGap) {
        bestGap = gap;
        best = cls;
      }
    }
    return best;
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
