// Dépenses de bons points des IA : améliorations globales, Défense et pion des camps menacés,
// classes d'élèves par camp, pouvoirs. Stratégie selon la difficulté : en Facile, achats lents
// et au hasard ; en Normal, achats raisonnés ; en Difficile, achats rapides qui suivent la
// situation (camp menacé → Défense et pion).
import { CLASSES, classCount, classUnlocked, type UnitClass } from './classes';
import { meritsOf } from './merits';
import { buyPion, PION } from './pion';
import { bestPowerSpot, castPower, POWER_IDS, POWERS, powerCooldown, type PowerId } from './powers';
import { Rng } from './rng';
import type { Tile } from './tile';
import { NO_TEAM, type Difficulty } from './types';
import {
  buyClassUnlock,
  buyDefense,
  buyGlobal,
  CLASS_UNLOCK,
  defenseCost,
  GLOBAL_BRANCHES,
  globalCost,
  MAX_UPGRADE_LEVEL,
  teamUpgrades,
  totalTeamUpgrades,
  type GlobalBranch,
} from './upgrades';
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
  /**
   * Pouvoirs de récré : nombre d'élèves touchés à partir duquel l'IA lance chaque pouvoir
   * (null : jamais, en Facile).
   */
  powers: Record<PowerId, number> | null;
  /** Achat du pion : solde minimal (au-delà du prix) pour un camp tranquille, et pour un camp menacé. */
  pionSpare: number;
  pionSpareThreat: number;
  /** L'IA met de côté pour un pion (camp principal) quand elle totalise ce nombre de niveaux globaux. */
  pionAfter: number;
}

export const ECONOMY_PROFILES: Record<Difficulty, EconomyProfile> = {
  facile: { interval: 9, maxLevel: 2, margin: 1.5, smart: false, classes: 'rare', classReserve: 60, powers: null, pionSpare: 120, pionSpareThreat: 120, pionAfter: 8 },
  normal: { interval: 4, maxLevel: 3, margin: 1, smart: true, classes: 'mix', classReserve: 15, powers: { sonnerie: 6, neige: 5, gouter: 4 }, pionSpare: 30, pionSpareThreat: 0, pionAfter: 5 },
  difficile: { interval: 2, maxLevel: 3, margin: 1, smart: true, classes: 'mix', classReserve: 10, powers: { sonnerie: 5, neige: 4, gouter: 3 }, pionSpare: 10, pionSpareThreat: 0, pionAfter: 4 },
};

/** Élèves qu'un camp produira dans la classe choisie avant la prochaine réflexion (répartition entre camps). */
const PLANNED_PER_CAMP = 2;
/** Distance maximale (cases) entre un camp et son ralliement placé par l'IA. Mutable pour les essais. */
export let RALLY_REACH = 6;
export function setRallyReach(v: number): void {
  RALLY_REACH = v;
}

/** Mélange visé des classes (parts de l'armée) ; voir chooseClass. Mutables pour les essais d'équilibrage. */
export const CLASS_MIX = { costaud: 0.6, sprintBase: 0.05, sprintFree: 0.12, nursePer: 8 };

/** Poids de base de chaque achat dans le choix raisonné (divisés ensuite par le coût). Mutables pour les essais. */
export const BUY_WEIGHT = { prod: 1.25, hp: 1, dmg: 1.05, classes: 0.9, def: 0.45, defThreat: 0.9 };

/** Un achat possible : amélioration globale, déblocage des classes ou Défense d'un camp. */
export type Purchase = { kind: 'global'; branch: GlobalBranch } | { kind: 'classes' } | { kind: 'def'; camp: Tile };

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
    if (this.usePowers()) return;
    if (this.buyPionIfUseful(camps)) return;
    // Épargne pour un pion : un camp bien amélioré mérite d'être gardé ; plus d'achat d'amélioration en attendant.
    const saving = this.allowPion && camps.some((c) => !c.pionBought) && totalTeamUpgrades(w, this.team) >= this.profile.pionAfter && !camps.some((c) => c.pionBought);
    const pick = saving || !this.allowUpgrades ? null : this.profile.smart ? this.bestPurchase(camps) : this.randomPurchase();
    if (pick) {
      const cost = purchaseCost(w, this.team, pick);
      if (cost !== null && meritsOf(w, this.team) >= cost * this.profile.margin) buy(w, this.team, pick);
    }
    // Types d'élèves différents selon les camps : chaque camp prend la classe la plus en retard,
    // en tenant compte de ce que les camps déjà servis vont produire (le camp le plus menacé d'abord).
    const planned = new Map<UnitClass, number>();
    for (const camp of camps.slice().sort((a, b) => this.threat(b) - this.threat(a))) {
      const f = this.forceClass;
      const cls = f === null ? this.chooseClass(camp, planned) : f === 'aucune' || !classUnlocked(w, this.team, f) ? 'eleve' : f;
      camp.produce = cls;
      planned.set(cls, (planned.get(cls) ?? 0) + PLANNED_PER_CAMP);
    }
    if (this.allowRallies) this.placeRallies(camps);
  }

  /** Outils d'équilibrage : points de ralliement et améliorations (globales et Défense) autorisés. */
  allowRallies = true;
  allowUpgrades = true;
  /** Cible d'attaque courante de l'IA (fournie par TeamAi) : sert à placer les ralliements vers le front. */
  targetOf: () => Tile | null = () => null;

  /**
   * Ralliements vers les fronts (Normal et Difficile) : chaque camp envoie ses nouveaux élèves
   * vers sa case menacée la plus proche, sinon un peu en avant vers la cible d'attaque de l'IA
   * (au plus RALLY_REACH cases du camp, pour ne pas les envoyer seuls trop loin).
   */
  placeRallies(camps: Tile[]): void {
    const w = this.world;
    if (!this.profile.smart) return;
    const owned = w.tiles.filter((t) => t.owner === this.team && !t.isCamp);
    const target = this.targetOf();
    for (const camp of camps) {
      let goal: { x: number; y: number } | null = null;
      let bd = Infinity;
      for (const t of owned) {
        if (this.threat(t) <= 0) continue;
        const d = Math.hypot(t.cx - camp.cx, t.cy - camp.cy);
        if (d < bd && d <= RALLY_REACH * 1.6) {
          bd = d;
          goal = { x: t.cx, y: t.cy };
        }
      }
      if (!goal && target && target !== camp) {
        const dx = target.cx - camp.cx;
        const dy = target.cy - camp.cy;
        const d = Math.hypot(dx, dy) || 1;
        const step = Math.min(RALLY_REACH, d * 0.4);
        goal = { x: camp.cx + (dx / d) * step, y: camp.cy + (dy / d) * step };
      }
      if (goal && Math.hypot(goal.x - camp.cx, goal.y - camp.cy) > 1.5) w.setCampRally(this.team, camp, goal);
      else w.clearCampRally(this.team, camp);
    }
  }

  /** Pouvoirs : au plus un lancé par réflexion, là où il touche assez d'élèves. */
  usePowers(): boolean {
    const w = this.world;
    const th = this.profile.powers;
    if (!th || !this.allowPowers) return false;
    for (const id of POWER_IDS) {
      if (powerCooldown(w, this.team, id) > 0 || meritsOf(w, this.team) < POWERS[id].cost) continue;
      const spot = bestPowerSpot(w, this.team, id);
      if (!spot || spot.score < th[id]) continue;
      // Sonnerie : seulement si des élèves de l'IA sont là pour en profiter.
      if (id === 'sonnerie') {
        let own = 0;
        w.hash.query(spot.x, spot.y, POWERS.sonnerie.radius + 2, (u) => {
          if (u.alive && u.team === this.team && !u.pion) own++;
        });
        if (own < 3) continue;
      }
      if (castPower(w, this.team, id, spot.x, spot.y) === 'ok') return true;
    }
    return false;
  }

  /** Pion : acheté pour le camp le plus menacé (ou le camp principal quand l'IA est riche). */
  buyPionIfUseful(camps: Tile[]): boolean {
    if (!this.allowPion) return false;
    const w = this.world;
    const points = meritsOf(w, this.team);
    let best: Tile | null = null;
    let bestThreat = -1;
    for (const c of camps) {
      if (c.pionBought) continue;
      const t = this.threat(c);
      if (t > bestThreat) {
        bestThreat = t;
        best = c;
      }
    }
    if (!best) return false;
    const saved = totalTeamUpgrades(w, this.team) >= this.profile.pionAfter && !camps.some((c) => c.pionBought);
    const spare = bestThreat >= 1 || saved ? this.profile.pionSpareThreat : this.profile.pionSpare;
    if (points < PION.cost + spare) return false;
    return buyPion(w, this.team, best) === 'ok';
  }

  /** Outils d'équilibrage : pouvoirs et pion autorisés. */
  allowPowers = true;
  allowPion = true;

  /**
   * Classe à produire dans un camp (débloquée au niveau 2 de Production). Mélange raisonné :
   *  - des infirmiers dès que l'armée compte une dizaine d'élèves (1 pour 6, 3 au plus) ;
   *  - des sprinteurs tant qu'il reste des cases libres à prendre (moins ensuite) ;
   *  - des costauds pour encaisser, d'autant plus que les combats sont nombreux ou le camp menacé ;
   * on prend la classe la plus en retard sur sa part visée ; faute de bons points, des élèves normaux.
   */
  chooseClass(camp: Tile, planned: Map<UnitClass, number> = new Map()): UnitClass {
    const w = this.world;
    if (!classUnlocked(w, this.team, 'costaud')) return 'eleve';
    const points = meritsOf(w, this.team);
    if (points < this.profile.classReserve) return 'eleve';
    if (this.profile.classes === 'rare') return this.rng.next() < 0.5 ? 'costaud' : 'eleve';
    let n = 0;
    for (const u of w.units) if (u.team === this.team && u.alive && !u.pion) n++;
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
    // Une classe déjà confiée à un autre camp passe après toute autre classe qui manque d'au moins un élève.
    let fresh: UnitClass | null = null;
    let freshGap = 1;
    for (const cls of ['infirmier', 'costaud', 'sprinteur'] as UnitClass[]) {
      if (CLASSES[cls].max > 0 && classCount(w, this.team, cls) >= CLASSES[cls].max) continue;
      const gap = target[cls] * n - classCount(w, this.team, cls) - (planned.get(cls) ?? 0);
      if (gap > bestGap) {
        bestGap = gap;
        best = cls;
      }
      if (!planned.has(cls) && gap >= freshGap) {
        freshGap = gap;
        fresh = cls;
      }
    }
    return planned.has(best) && fresh ? fresh : best;
  }

  /** Facile : une amélioration globale au hasard (niveau 2 au plus), parfois le déblocage des classes. */
  private randomPurchase(): Purchase | null {
    const up = teamUpgrades(this.world, this.team);
    const options: Purchase[] = GLOBAL_BRANCHES.filter((b) => up[b] < Math.min(this.profile.maxLevel, MAX_UPGRADE_LEVEL)).map((branch) => ({ kind: 'global', branch }));
    if (!up.classes && up.prod + up.hp + up.dmg >= 3) options.push({ kind: 'classes' });
    if (options.length === 0) return null;
    return options[Math.floor(this.rng.next() * options.length)];
  }

  /**
   * Meilleur achat : poids, situation, coût. Les améliorations globales passent d'abord ; la Défense
   * d'un camp ne vaut le coup que s'il est menacé (et alors avant tout le reste).
   */
  bestPurchase(camps: Tile[]): Purchase | null {
    const w = this.world;
    const up = teamUpgrades(w, this.team);
    const capped = w.teamUnitCount(this.team) >= w.map.unitCap * 0.9;
    let best: Purchase | null = null;
    let bestScore = 0;
    const consider = (p: Purchase, weight: number) => {
      const cost = purchaseCost(w, this.team, p);
      if (cost === null) return;
      const score = weight / (cost / 40);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    };
    for (const branch of GLOBAL_BRANCHES) {
      if (up[branch] >= this.profile.maxLevel) continue;
      // Au plafond d'élèves, produire plus vite ne sert à rien.
      consider({ kind: 'global', branch }, BUY_WEIGHT[branch] * (branch === 'prod' && capped ? 0.3 : 1));
    }
    if (!up.classes && this.profile.classes === 'mix' && w.teamUnitCount(this.team) >= 10) consider({ kind: 'classes' }, BUY_WEIGHT.classes);
    for (const camp of camps) {
      if (camp.defense >= this.profile.maxLevel) continue;
      // Un camp tranquille ne mérite presque pas de Défense ; un camp menacé, avant tout le reste.
      const threat = this.threat(camp);
      consider({ kind: 'def', camp }, threat > 0 ? BUY_WEIGHT.def + threat * BUY_WEIGHT.defThreat : 0.1);
    }
    return best;
  }

  /** Menace sur un camp : ennemis proches et jauge de capture adverse. */
  threat(camp: Tile): number {
    const w = this.world;
    let n = 0;
    w.hash.query(camp.cx, camp.cy, 4, (u) => {
      if (u.alive && !w.isFriend(u.team, this.team)) n++;
    });
    const capturing = camp.capTeam !== NO_TEAM && !w.isFriend(camp.capTeam, this.team);
    return Math.min(3, n / 4 + (capturing ? 1.5 : 0));
  }
}

/** Coût d'un achat (null : déjà au maximum ou déjà acheté). */
export function purchaseCost(w: World, team: number, p: Purchase): number | null {
  if (p.kind === 'global') return globalCost(w, team, p.branch);
  if (p.kind === 'classes') return teamUpgrades(w, team).classes ? null : CLASS_UNLOCK.cost;
  return defenseCost(p.camp);
}

function buy(w: World, team: number, p: Purchase): void {
  if (p.kind === 'global') buyGlobal(w, team, p.branch);
  else if (p.kind === 'classes') buyClassUnlock(w, team);
  else buyDefense(w, team, p.camp);
}
