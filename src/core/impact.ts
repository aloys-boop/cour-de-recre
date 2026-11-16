/**
 * Coups qui « claquent » (v5.17, saison 2) : tout ce qui rend un coup lisible et ressenti,
 * sans toucher à la simulation. Le monde note seulement l'instant et la direction du dernier
 * coup reçu par chaque élève (`Unit.hitAt`, `hitDx`, `hitDy`) ; ce module en tire la pose
 * de l'élève touché (éclair blanc, petit recul, écrasement), les étoiles des KO et la
 * « chaleur » des bagarres qui dose le tremblement de la caméra.
 *
 * Tout est pur et déterministe : les tests le vérifient sans navigateur.
 */

export const IMPACT = {
  /** Durée de l'éclair blanc sur l'élève touché (secondes). */
  flash: 0.11,
  /** Durée du recul visuel (secondes). */
  recoil: 0.16,
  /** Amplitude du recul, en pixels à zoom 1 (coup normal / coup de KO). */
  recoilPx: 3.5,
  koRecoilPx: 9,
  /** Écrasement au moment de l'impact (fraction de la taille). */
  squash: 0.14,
  /** Nombre d'étoiles qui tournent au-dessus d'un élève KO. */
  stars: 3,
  /** Les étoiles apparaissent un court instant après la chute et s'éteignent avant la disparition. */
  starsIn: 0.08,
  starsOut: 0.35,
  /** Tours par seconde des étoiles. */
  starsSpin: 1.6,
  /** Chaleur des bagarres : un coup visible ajoute `heatHit`, un KO `heatKo` ; elle retombe de `heatDecay` par seconde. */
  heatHit: 0.035,
  heatKo: 0.22,
  heatDecay: 0.55,
  /** Tremblement d'un KO : de `shakeMin` (bagarre isolée) à `shakeMax` (grosse mêlée), en pixels. */
  shakeMin: 1.2,
  shakeMax: 5,
  shakeDur: 0.14,
  shakeBigDur: 0.24,
  /** Au-delà de cette chaleur, la bagarre est « grosse » : tremblement plus long. */
  bigHeat: 0.6,
} as const;

export interface ImpactPose {
  /** Opacité de l'éclair blanc (0 : aucun). */
  flash: number;
  /** Décalage du sprite, en pixels à zoom 1 (à multiplier par le zoom). */
  ox: number;
  oy: number;
  /** Facteurs d'échelle horizontale et verticale (écrasement). */
  sx: number;
  sy: number;
}

const REST: ImpactPose = { flash: 0, ox: 0, oy: 0, sx: 1, sy: 1 };

/**
 * Pose d'un élève touché à l'instant `now` (temps du monde), d'après l'instant `hitAt` et la
 * direction (`dx`, `dy`, en grille, normalisée) du dernier coup. Hors de la fenêtre d'impact,
 * pose de repos. Le recul suit la direction du coup projetée à l'écran (vue isométrique).
 */
export function impactPose(now: number, hitAt: number, dx: number, dy: number, ko = false): ImpactPose {
  if (hitAt < 0) return REST;
  const age = now - hitAt;
  if (age < 0 || age >= IMPACT.recoil) return REST;
  const k = age / IMPACT.recoil; // 0 → 1
  // Recul : part vite, revient en douceur (cloche asymétrique).
  const push = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
  const amp = (ko ? IMPACT.koRecoilPx : IMPACT.recoilPx) * push;
  // Projection isométrique : x écran = x − y, y écran = (x + y) / 2.
  let ex = dx - dy;
  let ey = (dx + dy) / 2;
  const n = Math.hypot(ex, ey);
  if (n > 1e-6) {
    ex /= n;
    ey /= n;
  } else {
    ex = 0;
    ey = 0;
  }
  const flash = age < IMPACT.flash ? 1 - age / IMPACT.flash : 0;
  const sq = IMPACT.squash * push;
  return { flash, ox: ex * amp, oy: ey * amp * 0.6, sx: 1 + sq, sy: 1 - sq };
}

export interface KoStar {
  /** Position relative au-dessus de la tête, en pixels à zoom 1. */
  dx: number;
  dy: number;
  /** Opacité. */
  alpha: number;
  /** Devant la tête (dessinée après le sprite) ou derrière. */
  front: boolean;
}

/**
 * Étoiles qui tournent au-dessus d'un élève KO, `elapsed` secondes après sa chute, pour une
 * durée de KO `koSeconds`. Tableau vide avant l'apparition et après l'extinction.
 */
export function koStars(elapsed: number, koSeconds: number, seed = 0): KoStar[] {
  if (elapsed < IMPACT.starsIn || elapsed >= koSeconds - IMPACT.starsOut * 0.2) return [];
  const fadeIn = Math.min(1, (elapsed - IMPACT.starsIn) / 0.12);
  const end = koSeconds - IMPACT.starsOut;
  const fadeOut = elapsed > end ? Math.max(0, 1 - (elapsed - end) / (IMPACT.starsOut * 0.8)) : 1;
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return [];
  const out: KoStar[] = [];
  const base = elapsed * IMPACT.starsSpin * Math.PI * 2 + seed;
  for (let i = 0; i < IMPACT.stars; i++) {
    const a = base + (i / IMPACT.stars) * Math.PI * 2;
    out.push({ dx: Math.cos(a) * 9, dy: Math.sin(a) * 3.5, alpha, front: Math.sin(a) > 0 });
  }
  return out;
}

/**
 * Chaleur des bagarres visibles : monte avec les coups et les KO à l'écran, retombe seule.
 * Elle dose le tremblement : un KO isolé fait à peine vibrer la cour, une grosse mêlée la secoue.
 * Le tremblement se coupe dans la pause (« Sensations ») et respecte « réduire les animations ».
 */
export class BrawlHeat {
  heat = 0;
  /** Tremblement autorisé (réglage du joueur). */
  shakeEnabled = true;

  /** Un coup visible. */
  hit(): void {
    this.heat = Math.min(1, this.heat + IMPACT.heatHit);
  }

  /**
   * Un KO visible : renvoie le tremblement à jouer (amplitude en pixels, durée), ou null s'il
   * est désactivé. La chaleur compte le KO avant de doser : le cinquième KO d'une mêlée secoue
   * plus que le premier.
   */
  ko(): { amp: number; dur: number } | null {
    this.heat = Math.min(1, this.heat + IMPACT.heatKo);
    if (!this.shakeEnabled) return null;
    const amp = IMPACT.shakeMin + (IMPACT.shakeMax - IMPACT.shakeMin) * this.heat;
    return { amp, dur: this.big ? IMPACT.shakeBigDur : IMPACT.shakeDur };
  }

  /** Tremblement d'un autre événement (camp pris…), ou null s'il est désactivé. */
  shake(amp: number, dur: number): { amp: number; dur: number } | null {
    return this.shakeEnabled ? { amp, dur } : null;
  }

  get big(): boolean {
    return this.heat >= IMPACT.bigHeat;
  }

  update(dt: number): void {
    this.heat = Math.max(0, this.heat - IMPACT.heatDecay * dt);
  }
}

/** Note le coup reçu par un élève (instant et direction depuis l'attaquant), pour l'affichage. */
export function noteImpact(target: { x: number; y: number; hitAt: number; hitDx: number; hitDy: number }, now: number, fromX: number, fromY: number): void {
  const dx = target.x - fromX;
  const dy = target.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  target.hitAt = now;
  target.hitDx = dx / d;
  target.hitDy = dy / d;
}
