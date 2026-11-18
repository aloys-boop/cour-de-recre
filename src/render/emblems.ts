import { TEAM_COLORS } from '../config';
import { emblemFor, emblemInkOnCamp, emblemPolygon, type Emblem } from '../core/emblems';
import type { Tile } from '../core/tile';
import type { Camera } from './camera';

const polyCache = new Map<Emblem, Array<[number, number]>>();

function poly(e: Emblem): Array<[number, number]> {
  let p = polyCache.get(e);
  if (!p) {
    p = emblemPolygon(e);
    polyCache.set(e, p);
  }
  return p;
}

/**
 * Trace un emblème centré en (cx, cy), de demi-côté `r`, écrasé verticalement de `squash`
 * (0,5 pour le peindre à plat sur le sol isométrique).
 */
export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  e: Emblem,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  stroke: string | null,
  lineWidth = 1,
  squash = 1,
): void {
  const pts = poly(e);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = cx + pts[i][0] * r;
    const y = cy + pts[i][1] * r * squash;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Grand emblème peint à plat au centre d'un camp possédé (motifs d'équipe activés). */
export function drawCampEmblem(ctx: CanvasRenderingContext2D, cam: Camera, t: Tile, color: number): void {
  const pal = TEAM_COLORS[color];
  const c = cam.gridToScreen(t.cx, t.cy);
  const r = t.size * 12 * cam.zoom;
  ctx.save();
  ctx.globalAlpha = 0.85;
  drawEmblem(ctx, emblemFor(color), c.x, c.y, r, emblemInkOnCamp(pal), pal.dark, Math.max(1, 1.6 * cam.zoom), 0.5);
  ctx.restore();
}

/** Petit emblème au coin est (droit) d'une case bonus possédée, à côté du symbole. */
export function drawTileEmblem(ctx: CanvasRenderingContext2D, cam: Camera, t: Tile, color: number): void {
  const pal = TEAM_COLORS[color];
  const p = cam.gridToScreen(t.x + t.size * 0.85, t.y + t.size * 0.15);
  const r = 6 * cam.zoom;
  drawEmblem(ctx, emblemFor(color), p.x, p.y, r, pal.main, pal.dark, Math.max(1, 1.4 * cam.zoom), 0.6);
}

/**
 * Emblèmes des élèves, en petites images mises en cache par couleur et par zoom (arrondi au
 * dixième) : 240 barres de vie se dessinent alors en simples copies d'image.
 */
export class UnitEmblems {
  private cache = new Map<string, { img: CanvasImageSource; half: number }>();

  constructor(private makeCanvas: (w: number, h: number) => { width: number; height: number; getContext(id: '2d'): unknown }) {}

  draw(ctx: CanvasRenderingContext2D, color: number, x: number, y: number, z: number): void {
    const zq = Math.round(z * 10) / 10;
    const key = `${color}:${zq}`;
    let e = this.cache.get(key);
    if (!e) {
      const pal = TEAM_COLORS[color];
      const r = Math.max(2.6, 3.6 * zq);
      const lw = Math.max(1, 1.2 * zq);
      // Rendu à 3× pour rester net sur les écrans Retina.
      const k = 3;
      const half = Math.ceil(r + lw + 1);
      const c = this.makeCanvas(half * 2 * k, half * 2 * k);
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.scale(k, k);
      drawEmblem(g, emblemFor(color), half, half, r, pal.light, pal.dark, lw);
      e = { img: c as unknown as CanvasImageSource, half };
      if (this.cache.size > 64) this.cache.clear();
      this.cache.set(key, e);
    }
    ctx.drawImage(e.img, x - e.half, y - e.half, e.half * 2, e.half * 2);
  }
}
