import { describe, expect, it } from 'vitest';
import { TEAM_COLORS } from '../src/config';
import { contrastRatio, emblemFor, emblemInkOnCamp, emblemPolygon, emblemSvg, EMBLEM_NAMES, inkOn, MIN_SHAPE_CONTRAST, TEAM_EMBLEMS } from '../src/core/emblems';
import { loadProgress, saveProgress } from '../src/core/save';

/** Aire signée d'un polygone (formule du lacet). */
function area(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

describe('emblèmes d’équipe (v5.19)', () => {
  it('une forme différente pour chacune des 8 couleurs, aucune n’est un symbole de carte', () => {
    expect(TEAM_EMBLEMS).toHaveLength(TEAM_COLORS.length);
    expect(new Set(TEAM_EMBLEMS).size).toBe(TEAM_COLORS.length);
    for (const e of TEAM_EMBLEMS) expect(['spade', 'club', 'heart', 'diamond', 'pique', 'trefle', 'coeur', 'carreau']).not.toContain(e);
    for (let c = 0; c < 8; c++) expect(emblemFor(c)).toBe(TEAM_EMBLEMS[c]);
    expect(emblemFor(9)).toBe(TEAM_EMBLEMS[1]);
    for (const e of TEAM_EMBLEMS) expect(EMBLEM_NAMES[e].length).toBeGreaterThan(2);
  });

  it('chaque contour tient dans le carré [-1, 1] et a une aire franche (lisible en petit)', () => {
    for (const e of TEAM_EMBLEMS) {
      const pts = emblemPolygon(e);
      expect(pts.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of pts) {
        expect(Math.abs(x)).toBeLessThanOrEqual(1.001);
        expect(Math.abs(y)).toBeLessThanOrEqual(1.1);
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      }
      expect(area(pts)).toBeGreaterThan(0.7);
    }
  });

  it('les formes se distinguent : aires et nombres de sommets ne se confondent pas deux à deux', () => {
    const sig = TEAM_EMBLEMS.map((e) => `${emblemPolygon(e).length}:${area(emblemPolygon(e)).toFixed(2)}`);
    expect(new Set(sig).size).toBe(TEAM_EMBLEMS.length);
  });

  it('icône SVG en ligne, sans ressource externe', () => {
    const svg = emblemSvg('etoile', '#123456', '#ffffff', 15);
    expect(svg).toMatch(/^<svg [^>]*width="15"/);
    expect(svg).toContain('<polygon points="');
    expect(svg).not.toMatch(/https?:/);
  });
});

describe('contrastes (v5.19)', () => {
  it('rapport de contraste WCAG : noir sur blanc 21, une couleur sur elle-même 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#3aa83a', '#3aa83a')).toBeCloseTo(1, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(contrastRatio('#000000', '#ffffff'), 8);
  });

  it('symboles des cases bonus : chaque équipe ressort sur le blanc (remplissage ou contour ≥ 3:1)', () => {
    let outlined = 0;
    for (const pal of TEAM_COLORS) {
      const ink = inkOn('#ffffff', pal);
      const best = Math.max(contrastRatio(ink.fill, '#ffffff'), ink.outline ? contrastRatio(ink.outline, '#ffffff') : 0);
      expect(best).toBeGreaterThanOrEqual(MIN_SHAPE_CONTRAST);
      if (ink.outline) outlined++;
    }
    // Jaune, Orange et Rose au moins avaient besoin d'un contour.
    expect(inkOn('#ffffff', TEAM_COLORS[2]).outline).toBe(TEAM_COLORS[2].dark);
    expect(inkOn('#ffffff', TEAM_COLORS[6]).outline).not.toBeNull();
    expect(inkOn('#ffffff', TEAM_COLORS[7]).outline).not.toBeNull();
    expect(inkOn('#ffffff', TEAM_COLORS[0]).outline).toBeNull();
    expect(outlined).toBeGreaterThanOrEqual(3);
  });

  it('emblème peint sur un camp : le plus contrasté des trois tons, toujours au moins 2,5:1', () => {
    for (const pal of TEAM_COLORS) {
      const ink = emblemInkOnCamp(pal);
      expect(contrastRatio(ink, pal.main)).toBeGreaterThanOrEqual(2.5);
    }
  });
});

describe('sauvegarde (v5.19)', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('ancienne sauvegarde sans le champ : motifs masqués, le reste intact', () => {
    const store = mem();
    store.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 4, wins: { 1: 1 }, muted: false, lastTeam: 3, lastDifficulty: 'normal', difficultyScale: 2, shake: false }));
    const p = loadProgress(store);
    expect(p.patterns).toBe(false);
    expect(p.unlocked).toBe(4);
    expect(p.lastTeam).toBe(3);
    expect(p.shake).toBe(false);
  });

  it('réglage mémorisé', () => {
    const store = mem();
    saveProgress({ ...loadProgress(store), patterns: true }, store);
    expect(loadProgress(store).patterns).toBe(true);
  });
});

describe('« Comment jouer » (v5.19)', () => {
  it('rubrique « Lisibilité » dans les bases, qui nomme la forme de chaque équipe', async () => {
    const { HOW_TO, HOW_TO_CHAPTERS } = await import('../src/ui/overlay');
    const { TEAM_PLURALS } = await import('../src/config');
    const text = HOW_TO.find(([k]) => k === 'Lisibilité')?.[1] ?? '';
    TEAM_EMBLEMS.forEach((e, c) => expect(text).toContain(`${TEAM_PLURALS[c]} ${EMBLEM_NAMES[e]}`));
    expect(HOW_TO_CHAPTERS.find((c) => c.id === 'bases')?.sections).toContain('Lisibilité');
  });
});
