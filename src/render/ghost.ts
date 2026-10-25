// Rendu des camps fantômes neutres (option d'escarmouche) : camp gris pâle translucide,
// liseré pointillé et petit fantôme pixel qui flotte au centre.
import type { Tile } from '../core/tile';
import type { Vec2 } from '../core/types';
import type { Camera } from './camera';
import { COLORS } from './renderer';

/** Fantôme 7 × 8 pixels : X = corps, o = œil. */
const GHOST_PIXELS = ['..XXX..', '.XXXXX.', 'XXXXXXX', 'XoXXoXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'X.XX.XX'];

function diamond(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, y0: number, x1: number, y1: number): void {
  const a = cam.gridToScreen(x0, y0);
  const b = cam.gridToScreen(x1, y0);
  const c = cam.gridToScreen(x1, y1);
  const d = cam.gridToScreen(x0, y1);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

/** Petit fantôme pixel centré sur (x, y) ; `px` = taille d'un pixel à l'écran. */
export function drawGhostSprite(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, alpha = 1): void {
  const cols = GHOST_PIXELS[0].length;
  const rows = GHOST_PIXELS.length;
  const ox = Math.round(x - (cols * px) / 2);
  const oy = Math.round(y - (rows * px) / 2);
  ctx.save();
  ctx.globalAlpha *= alpha;
  // Contour sombre d'un pixel autour du corps.
  ctx.fillStyle = 'rgba(40,44,70,0.55)';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (GHOST_PIXELS[r][c] !== '.') ctx.fillRect(ox + (c - 0.5) * px, oy + (r - 0.5) * px, px * 2, px * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = GHOST_PIXELS[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === 'o' ? '#2a2f4a' : '#f6f7ff';
      ctx.fillRect(ox + c * px, oy + r * px, Math.ceil(px), Math.ceil(px));
    }
  }
  ctx.restore();
}

/**
 * Camp fantôme neutre, dessiné par-dessus le camp gris standard : le sol réapparaît sous
 * un voile pâle translucide, avec un liseré pointillé qui tourne lentement et un fantôme qui flotte.
 */
export function drawGhostCamp(ctx: CanvasRenderingContext2D, cam: Camera, t: Tile, time: number): void {
  const z = cam.zoom;
  const inset = 0.06;
  ctx.save();
  diamond(ctx, cam, t.x + inset, t.y + inset, t.x + t.size - inset, t.y + t.size - inset);
  ctx.fillStyle = COLORS.floor;
  ctx.fill();
  ctx.fillStyle = 'rgba(236,238,248,0.62)';
  ctx.fill();
  ctx.setLineDash([6 * z, 4 * z]);
  ctx.lineDashOffset = -time * 8 * z;
  ctx.strokeStyle = 'rgba(120,124,150,0.9)';
  ctx.lineWidth = Math.max(1, 2 * z);
  ctx.stroke();
  diamond(ctx, cam, t.x + 0.22, t.y + 0.22, t.x + t.size - 0.22, t.y + t.size - 0.22);
  ctx.setLineDash([3 * z, 4 * z]);
  ctx.lineDashOffset = time * 6 * z;
  ctx.strokeStyle = 'rgba(160,164,190,0.7)';
  ctx.lineWidth = Math.max(1, 1.1 * z);
  ctx.stroke();
  ctx.restore();
  // Fantôme : flotte doucement au-dessus du centre, avec une ombre au sol.
  const c = cam.gridToScreen(t.cx, t.cy);
  const bob = Math.sin(time * 2.2 + t.x) * 2.5 * z;
  ctx.save();
  ctx.fillStyle = 'rgba(40,44,70,0.18)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 2 * z, 10 * z, 4.5 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawGhostSprite(ctx, c.x, c.y - 14 * z + bob, Math.max(1, Math.round(2.4 * z)), 0.88);
}

/** Camp fantôme neutre sur la mini-carte : losange pâle à contour pointillé. */
export function drawGhostMinimap(ctx: CanvasRenderingContext2D, p: Vec2, s: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - s / 2);
  ctx.lineTo(p.x + s, p.y);
  ctx.lineTo(p.x, p.y + s / 2);
  ctx.lineTo(p.x - s, p.y);
  ctx.closePath();
  ctx.fillStyle = '#eef0f8';
  ctx.fill();
  ctx.setLineDash([1.5, 1.5]);
  ctx.strokeStyle = '#6e7290';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
