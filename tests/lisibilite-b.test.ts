import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { TEAM_COLORS } from '../src/config';
import {
  BONUS_TILE_TINT,
  bonusTileFill,
  contrastRatio,
  MIN_SHAPE_CONTRAST,
  minimapEmblemRadius,
  mixHex,
  ringInk,
  suitContrast,
  TEAM_RING,
} from '../src/core/emblems';
import { TeamRings } from '../src/render/emblems';
import { COLORS } from '../src/render/renderer';

describe('lisibilité b : cases teintées, liserés, mini-carte (v5.20)', () => {
  it('mixHex mélange deux couleurs et borne la proportion', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#102030', 0.3)).toBe('#102030');
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000');
  });

  it('une case prise se distingue de la case neutre, sans devenir un camp', () => {
    expect(BONUS_TILE_TINT).toBeGreaterThan(0.1);
    expect(BONUS_TILE_TINT).toBeLessThan(0.3);
    const fills = TEAM_COLORS.map((p) => bonusTileFill(p, COLORS.tile));
    expect(new Set(fills).size).toBe(TEAM_COLORS.length);
    for (let c = 0; c < TEAM_COLORS.length; c++) {
      expect(fills[c]).not.toBe(COLORS.tile);
      // Reste nettement plus clair que la couleur pleine d'un camp de la même équipe.
      expect(contrastRatio(fills[c], TEAM_COLORS[c].main)).toBeGreaterThan(1.3);
      // Toujours mis en cache : même chaîne au second appel.
      expect(bonusTileFill(TEAM_COLORS[c], COLORS.tile)).toBe(fills[c]);
    }
  });

  it('le symbole d’une case teintée garde un contraste d’au moins 3:1 pour chaque équipe', () => {
    for (const p of TEAM_COLORS) {
      expect(suitContrast(bonusTileFill(p, COLORS.tile), p)).toBeGreaterThanOrEqual(MIN_SHAPE_CONTRAST);
      expect(suitContrast(COLORS.tile, p)).toBeGreaterThanOrEqual(MIN_SHAPE_CONTRAST);
    }
  });

  it('le liseré d’équipe ressort sur le sol gris grâce à son contour sombre', () => {
    expect(TEAM_RING.rx).toBeGreaterThan(TEAM_RING.ry);
    expect(TEAM_RING.rx).toBeLessThan(15); // reste à l'intérieur du cercle de sélection (15 px)
    for (const p of TEAM_COLORS) {
      const ink = ringInk(p);
      expect(ink.ring).toBe(p.main);
      expect(Math.max(contrastRatio(ink.ring, COLORS.floor), contrastRatio(ink.outline, COLORS.floor))).toBeGreaterThanOrEqual(2.5);
    }
  });

  it('les liserés en cache dessinent un anneau de la couleur de l’équipe, creux au centre', () => {
    const rings = new TeamRings((w, h) => createCanvas(w, h) as never);
    const out = createCanvas(80, 40);
    const ctx = out.getContext('2d') as unknown as CanvasRenderingContext2D;
    rings.draw(ctx, 1, 40, 20, 2); // Verts, zoom ×2
    const at = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    // Centre transparent (l'élève reste visible), bord gauche teinté de vert.
    expect(at(40, 20)[3]).toBe(0);
    let green = false;
    for (let x = 10; x < 24; x++) {
      const [r, g, b, a] = at(x, 20);
      if (a > 200 && g > r + 30 && g > b + 30) green = true;
    }
    expect(green).toBe(true);
  });

  it('l’emblème d’un camp sur la mini-carte reste lisible et ne déborde pas d’un grand camp', () => {
    expect(minimapEmblemRadius(1)).toBe(3);
    expect(minimapEmblemRadius(2.5)).toBe(3);
    for (const h of [5, 8, 12]) {
      expect(minimapEmblemRadius(h)).toBeLessThanOrEqual(h);
      expect(minimapEmblemRadius(h)).toBeGreaterThanOrEqual(3);
    }
  });
});
