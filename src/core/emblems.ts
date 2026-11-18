/**
 * Lisibilité (v5.19) : un emblème (une forme) par couleur d'uniforme, pour reconnaître les équipes
 * sans se fier aux seules couleurs (daltonisme, plein soleil, petit écran), et des contrastes
 * vérifiés pour les symboles des cases.
 *
 * Les formes sont choisies pour rester distinctes en très petit (6 px) : aucune n'est un symbole
 * de carte à jouer (pique, trèfle, cœur, carreau), déjà portés par les cases bonus.
 */

export type Emblem = 'rond' | 'triangle' | 'carre' | 'etoile' | 'croix' | 'hexagone' | 'lune' | 'eclair';

/** Emblème de chaque couleur d'uniforme (même ordre que `TEAM_COLORS` : Noir, Vert, Jaune…). */
export const TEAM_EMBLEMS: readonly Emblem[] = ['rond', 'triangle', 'carre', 'etoile', 'croix', 'hexagone', 'lune', 'eclair'];

/** Nom affiché de chaque emblème (« Comment jouer », aides vocales). */
export const EMBLEM_NAMES: Record<Emblem, string> = {
  rond: 'rond',
  triangle: 'triangle',
  carre: 'carré',
  etoile: 'étoile',
  croix: 'croix',
  hexagone: 'hexagone',
  lune: 'lune',
  eclair: 'éclair',
};

export function emblemFor(color: number): Emblem {
  return TEAM_EMBLEMS[((color % TEAM_EMBLEMS.length) + TEAM_EMBLEMS.length) % TEAM_EMBLEMS.length];
}

/**
 * Contour de chaque emblème, en polygone dans le carré [-1, 1] (y vers le bas). Le rond et la lune
 * sont approchés par des polygones réguliers assez fins pour paraître ronds.
 * Le rendu canvas comme l'icône SVG des puces partent de ces mêmes points.
 */
export function emblemPolygon(e: Emblem): Array<[number, number]> {
  const ring = (n: number, r: number, phase = -Math.PI / 2): Array<[number, number]> =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i / n) * Math.PI * 2;
      return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
    });
  switch (e) {
    case 'rond':
      return ring(20, 0.92);
    case 'triangle':
      return [[0, -1], [0.98, 0.78], [-0.98, 0.78]];
    case 'carre':
      return [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]];
    case 'etoile':
      return Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? 1 : 0.45;
        return [r * Math.cos(a), r * Math.sin(a) + 0.08] as [number, number];
      });
    case 'croix': {
      const a = 0.34;
      return [[-a, -0.95], [a, -0.95], [a, -a], [0.95, -a], [0.95, a], [a, a], [a, 0.95], [-a, 0.95], [-a, a], [-0.95, a], [-0.95, -a], [-a, -a]];
    }
    case 'hexagone':
      return ring(6, 0.96, 0);
    case 'lune': {
      // Croissant ouvert à droite : grand arc extérieur (centre 0, 0), puis arc intérieur
      // d'un cercle décalé vers la droite qui passe par les deux pointes.
      const pts: Array<[number, number]> = [];
      const n = 16;
      const t0 = (-70 * Math.PI) / 180;
      for (let i = 0; i <= n; i++) {
        const a = t0 - (i / n) * ((220 * Math.PI) / 180);
        pts.push([0.95 * Math.cos(a), 0.95 * Math.sin(a)]);
      }
      const cx = 0.45;
      const [bx, by] = pts[n];
      const r = Math.hypot(bx - cx, by);
      const p0 = Math.atan2(by, bx - cx);
      const p1 = Math.atan2(-by, bx - cx) + Math.PI * 2;
      for (let i = 1; i < n; i++) {
        const a = p0 + (i / n) * (p1 - p0);
        pts.push([cx + r * Math.cos(a), r * Math.sin(a)]);
      }
      return pts;
    }
    case 'eclair':
      return [[0.25, -1], [-0.62, 0.12], [-0.05, 0.12], [-0.3, 1], [0.66, -0.22], [0.08, -0.22], [0.42, -1]];
  }
}

/** Icône SVG d'un emblème (puces d'équipe du bandeau), en ligne, `size` pixels de côté. */
export function emblemSvg(e: Emblem, fill: string, stroke: string, size = 14): string {
  const pts = emblemPolygon(e)
    .map(([x, y]) => `${(x * 10 + 12).toFixed(1)},${(y * 10 + 12).toFixed(1)}`)
    .join(' ');
  return `<svg class="emblem emblem-${e}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}

// ------------------------------------------------------------------ contrastes

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminance relative d'une couleur « #rrggbb » (définition WCAG). */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Contraste minimal visé pour une forme graphique sur son fond (WCAG, éléments non textuels). */
export const MIN_SHAPE_CONTRAST = 3;

/**
 * Encre d'un symbole posé sur un fond clair (cases bonus blanches) : la couleur de l'équipe,
 * cernée de sa teinte sombre quand elle seule ne ressort pas assez (Jaune, Orange, Rose…).
 */
export function inkOn(background: string, palette: { main: string; dark: string }): { fill: string; outline: string | null } {
  if (contrastRatio(palette.main, background) >= MIN_SHAPE_CONTRAST) return { fill: palette.main, outline: null };
  return { fill: palette.main, outline: palette.dark };
}

/**
 * Teinte de l'emblème peint sur un camp : la plus contrastée, sur la couleur principale du camp,
 * entre la teinte claire de l'équipe, le blanc et l'encre sombre.
 */
export function emblemInkOnCamp(palette: { main: string; light: string; dark: string }): string {
  const options = [palette.light, '#ffffff', '#1d1d24'];
  let best = options[0];
  for (const o of options) if (contrastRatio(o, palette.main) > contrastRatio(best, palette.main)) best = o;
  return best;
}
