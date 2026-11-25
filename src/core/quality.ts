// Garde-fou de fluidité (v5.26, saison 2, « Performances c ») : si le compteur d'images voit des
// saccades durables, le jeu allège tout seul ce qui ne sert pas la lecture de la partie, un cran à
// la fois, puis retente le niveau supérieur quand tout redevient fluide. Sans navigateur, testé ;
// branché sur `Game` (qui lui passe les statistiques du compteur deux fois par seconde).
//
// Crans :
//   0 « complet »   : tous les effets, image à la résolution de l'écran (×2 au plus) ;
//   1 « allégé »    : plus d'onomatopées de coups (« Paf ! », « Bam ! »…), mini-carte redessinée
//                     une image sur deux ; « Mêlée ! », « Paré ! » et les KO restent (ils informent) ;
//   2 « réduit »    : en plus, image du canvas en ×1,5 au lieu de ×2 (44 % de pixels en moins).

import { frameVerdict, type FrameStats } from './frame-meter';

export type QualityLevel = 0 | 1 | 2;
export const MAX_QUALITY_LEVEL: QualityLevel = 2;

export const QUALITY = {
  /** Intervalle entre deux examens du compteur (s). */
  checkEvery: 0.5,
  /** Images mesurées au moins avant de juger (une seconde à 60 i/s). */
  minFrames: 60,
  /** Saccades vues sans interruption avant de descendre d'un cran (s). */
  downAfter: 2,
  /** Temps laissé au nouveau cran pour se mesurer avant tout nouveau jugement (s). */
  settle: 3,
  /** Fluidité continue avant de retenter le cran supérieur (s) ; doublée à chaque rechute. */
  upAfter: 15,
  upAfterMax: 120,
  /** Une saccade dans ce délai après une remontée est une rechute (s). */
  relapseWindow: 12,
} as const;

/** Résolution maximale du canvas selon le cran (rapport pixels de l'appareil / points d'écran). */
export function dprCap(level: QualityLevel): number {
  return level >= 2 ? 1.5 : 2;
}

/** Le cran coupe-t-il les onomatopées de coups ? */
export function lightEffects(level: QualityLevel): boolean {
  return level >= 1;
}

/** Libellé court du cran, pour la pause et la pastille du compteur. */
export function qualityLabel(level: QualityLevel): string {
  return level === 0 ? 'tous les effets' : level === 1 ? 'effets allégés' : 'effets allégés, image ×1,5';
}

export type QualityChange = { level: QualityLevel; dir: 'down' | 'up' } | null;

export class QualityGovernor {
  level: QualityLevel = 0;
  enabled = true;
  private clock = 0;
  private sinceCheck = 0;
  private badFor = 0;
  private goodFor = 0;
  private settleLeft = 0;
  private upNeed: number = QUALITY.upAfter;
  /** Instant de la dernière remontée (pour repérer une rechute), -1 si aucune. */
  private lastUp = -1;
  /** Nombre de descentes depuis le début de la partie (la première est annoncée). */
  downs = 0;

  /** Coupe ou rétablit le garde-fou ; coupé, il revient au cran complet. */
  setEnabled(on: boolean): QualityChange {
    this.enabled = on;
    this.badFor = this.goodFor = 0;
    if (!on && this.level !== 0) {
      this.level = 0;
      this.settleLeft = QUALITY.settle;
      return { level: 0, dir: 'up' };
    }
    return null;
  }

  /**
   * Avance de `dt` secondes de temps réel. `running` est faux en pause, en fin de partie ou page
   * cachée : rien n'est jugé (les images d'un menu ouvert ne disent rien de la partie). `stats`
   * n'est lu qu'au moment d'un examen. Après un changement de cran, l'appelant vide le compteur
   * pour que la mesure reparte de zéro.
   */
  update(dt: number, running: boolean, stats: () => FrameStats): QualityChange {
    if (!(dt > 0)) return null;
    this.clock += dt;
    if (!this.enabled || !running) {
      this.sinceCheck = 0;
      return null;
    }
    if (this.settleLeft > 0) {
      this.settleLeft = Math.max(0, this.settleLeft - dt);
      return null;
    }
    this.sinceCheck += dt;
    if (this.sinceCheck < QUALITY.checkEvery) return null;
    const span = this.sinceCheck;
    this.sinceCheck = 0;
    const s = stats();
    if (s.frames < QUALITY.minFrames) return null;
    const v = frameVerdict(s);
    if (v === 'saccade') {
      this.goodFor = 0;
      this.badFor += span;
      if (this.badFor >= QUALITY.downAfter && this.level < MAX_QUALITY_LEVEL) {
        if (this.lastUp >= 0 && this.clock - this.lastUp <= QUALITY.relapseWindow) {
          this.upNeed = Math.min(QUALITY.upAfterMax, this.upNeed * 2);
        }
        this.lastUp = -1;
        return this.change((this.level + 1) as QualityLevel, 'down');
      }
      return null;
    }
    this.badFor = 0;
    if (v === 'fluide' && this.level > 0) {
      this.goodFor += span;
      if (this.goodFor >= this.upNeed) {
        this.lastUp = this.clock;
        return this.change((this.level - 1) as QualityLevel, 'up');
      }
    } else this.goodFor = 0;
    return null;
  }

  /** Temps de fluidité exigé avant la prochaine remontée (s), pour les tests et le banc. */
  get upDelay(): number {
    return this.upNeed;
  }

  private change(level: QualityLevel, dir: 'down' | 'up'): QualityChange {
    this.level = level;
    this.badFor = this.goodFor = 0;
    this.settleLeft = QUALITY.settle;
    if (dir === 'down') this.downs++;
    return { level, dir };
  }
}
