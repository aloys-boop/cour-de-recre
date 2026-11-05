// Garnisons à l'écran : écusson numéroté sur chaque case gardée, et zone défendue en pointillés.

import { TEAM_COLORS } from '../config';
import { GARRISON } from '../core/garrison';
import type { Tile } from '../core/tile';
import type { Camera } from './camera';

/**
 * Zone défendue (rayon GARRISON.radius autour de la case), au sol : cercle en perspective,
 * liseré à la couleur de l'équipe et tirets blancs qui tournent lentement.
 */
export function drawGuardZone(ctx: CanvasRenderingContext2D, cam: Camera, t: Tile, color: number, time: number): void {
  const c = cam.gridToScreen(t.cx, t.cy);
  const ex = cam.gridToScreen(t.cx + GARRISON.radius, t.cy);
  // Vue isométrique : un cercle de la grille devient une ellipse (demi-axes √2 × le décalage écran d'un axe).
  const rx = Math.abs(ex.x - c.x) * Math.SQRT2;
  const ry = Math.abs(ex.y - c.y) * Math.SQRT2;
  if (c.x + rx < 0 || c.x - rx > cam.viewW || c.y + ry < 0 || c.y - ry > cam.viewH) return;
  const z = cam.zoom;
  const tc = TEAM_COLORS[color] ?? TEAM_COLORS[0];
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = hexAlpha(tc.main, 0.1);
  ctx.fill();
  ctx.strokeStyle = tc.dark;
  ctx.lineWidth = Math.max(2, 3 * z);
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([7 * z, 6 * z]);
  ctx.lineDashOffset = -time * 10 * z;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.2, 1.6 * z);
  ctx.stroke();
  ctx.restore();
}

/**
 * Écusson des gardes, contre le coin est (droit) de la case, juste à l'extérieur, pour ne pas
 * couvrir les élèves ni la pastille de classe des camps (coin ouest) : bouclier à la couleur
 * de l'équipe, nombre de gardes en blanc.
 */
export function drawGuardBadge(ctx: CanvasRenderingContext2D, cam: Camera, t: Tile, count: number, color: number): void {
  const right = cam.gridToScreen(t.x + t.size, t.y);
  if (right.x < -40 || right.y < -40 || right.x > cam.viewW + 60 || right.y > cam.viewH + 40) return;
  const z = Math.max(0.75, cam.zoom);
  const tc = TEAM_COLORS[color] ?? TEAM_COLORS[0];
  const w = 11 * z;
  const h = 13 * z;
  const x = right.x + w + 2 * z;
  const y = right.y - h * 0.15;
  ctx.save();
  shieldPath(ctx, x, y, w, h);
  ctx.fillStyle = tc.ui;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2 * z);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.font = `900 ${Math.round(12 * z)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = tc.text;
  ctx.fillText(String(count), x, y - h * 0.1);
  ctx.restore();
}

/** Bouclier centré en (x, y), largeur 2w, hauteur 2h : haut plat, pointe en bas. */
export function shieldPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y - h * 0.8);
  ctx.quadraticCurveTo(x, y - h * 1.05, x + w, y - h * 0.8);
  ctx.lineTo(x + w, y - h * 0.05);
  ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.65, x, y + h);
  ctx.quadraticCurveTo(x - w * 0.85, y + h * 0.65, x - w, y - h * 0.05);
  ctx.closePath();
}

function hexAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
