// Placement de la bulle du tutoriel (v5.9) : elle ne doit cacher ni ce que montre la main, ni la
// main, ni le bouton utile d'un panneau ouvert. Logique pure (rectangles en px), testée à part.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ce que la bulle doit éviter, avec son importance (10 = la cible de l'étape, 1 = un panneau). */
export interface Avoid extends Rect {
  weight: number;
}

/** Une place possible, dans l'ordre de préférence. */
export interface Spot {
  id: string;
  x: number;
  y: number;
}

export function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Gêne d'une place : surface recouverte, pondérée, rapportée à la taille de la bulle. */
export function spotCost(spot: Spot, size: { w: number; h: number }, avoid: readonly Avoid[], rank = 0): number {
  const r = { x: spot.x, y: spot.y, w: size.w, h: size.h };
  const area = Math.max(1, size.w * size.h);
  let cost = rank * 0.02; // à gêne égale, la place préférée (en haut au centre) gagne
  for (const a of avoid) cost += (a.weight * overlap(r, a)) / area;
  return cost;
}

/**
 * Places candidates : en haut (centre, droite, gauche), en bas (centre, droite, gauche), au milieu
 * (droite, gauche). `top` est la hauteur sous la barre du haut, `margin` les bords (encoches comprises).
 */
export function candidateSpots(view: { w: number; h: number }, size: { w: number; h: number }, top: number, margin: { l: number; r: number; b: number }): Spot[] {
  const cx = Math.round((view.w - size.w) / 2);
  const left = Math.round(margin.l);
  const right = Math.round(view.w - size.w - margin.r);
  const bottom = Math.round(view.h - size.h - margin.b);
  const mid = Math.round((view.h - size.h) / 2);
  const ys: [string, number][] = [
    ['haut', Math.round(top)],
    ['bas', bottom],
    ['milieu', mid],
  ];
  const out: Spot[] = [];
  for (const [yn, y] of ys) {
    const xs: [string, number][] = yn === 'milieu' ? [['droite', right], ['gauche', left]] : [['centre', cx], ['droite', right], ['gauche', left]];
    for (const [xn, x] of xs) out.push({ id: `${yn}-${xn}`, x: Math.max(left, Math.min(x, right)), y: Math.max(0, y) });
  }
  return out;
}

/**
 * Meilleure place. `current` : place actuelle, gardée tant qu'elle n'est pas nettement pire
 * (la bulle ne doit pas sautiller quand la main bouge un peu).
 */
export function pickSpot(spots: readonly Spot[], size: { w: number; h: number }, avoid: readonly Avoid[], current?: string | null): Spot {
  let best = spots[0];
  let bestCost = Infinity;
  spots.forEach((s, i) => {
    const c = spotCost(s, size, avoid, i);
    if (c < bestCost) {
      best = s;
      bestCost = c;
    }
  });
  // Hystérésis sur la seule gêne (sans la préférence d'ordre) : on ne bouge que pour nettement mieux.
  const cur = current ? spots.find((s) => s.id === current) : undefined;
  if (cur && cur !== best && spotCost(cur, size, avoid) <= spotCost(best, size, avoid) + 0.05) return cur;
  return best;
}
