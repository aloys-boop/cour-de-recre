// Rendu du mode « Roi de la cour » : trône doré 2 × 2 avec couronne pixel, anneau de règne,
// repère sur la mini-carte.
import { TEAM_COLORS } from '../config';
import { KING } from '../core/king';
import type { Tile } from '../core/tile';
import { NO_TEAM } from '../core/types';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { GOLD } from './golden';

/** Couronne en pixels : # or, d or sombre, g gemme (couleur du propriétaire), r rubis, w perle. */
const CROWN = [
  'w...w...w',
  '#..###..#',
  '##.###.##',
  '#########',
  '#g##r##g#',
  '#########',
  'ddddddddd',
];

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

/** Dessine une couronne pixel centrée en (x, y) (bas de la couronne), de pixel `p`. */
export function drawPixelCrown(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, gem: string): void {
  const w = CROWN[0].length;
  const h = CROWN.length;
  const x0 = Math.round(x - (w * p) / 2);
  const y0 = Math.round(y - h * p);
  const color: Record<string, string> = { '#': GOLD.main, d: GOLD.dark, g: gem, r: '#e8483c', w: '#ffffff' };
  // Contour sombre : chaque pixel débordé d'un demi-pixel.
  ctx.fillStyle = '#3a2a00';
  const o = Math.max(1, p * 0.45);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (CROWN[r][c] !== '.') ctx.fillRect(x0 + c * p - o, y0 + r * p - o, p + 2 * o, p + 2 * o);
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const k = CROWN[r][c];
      if (k === '.') continue;
      ctx.fillStyle = color[k];
      ctx.fillRect(x0 + c * p, y0 + r * p, Math.ceil(p), Math.ceil(p));
    }
}

/** Trône au sol : dalle dorée, centre aux couleurs du propriétaire, anneau de règne et couronne. */
export function drawThroneTile(ctx: CanvasRenderingContext2D, world: World, t: Tile, cam: Camera, time: number): void {
  const z = cam.zoom;
  const owner = t.owner === NO_TEAM ? null : TEAM_COLORS[world.teamColors[t.owner]];
  const x1 = t.x + t.size;
  const y1 = t.y + t.size;
  ctx.save();
  // Dalle dorée.
  diamond(ctx, cam, t.x + 0.04, t.y + 0.04, x1 - 0.04, y1 - 0.04);
  ctx.fillStyle = GOLD.main;
  ctx.fill();
  ctx.strokeStyle = GOLD.dark;
  ctx.lineWidth = Math.max(1.5, 2.5 * z);
  ctx.stroke();
  // Marches : deux liserés concentriques.
  diamond(ctx, cam, t.x + 0.2, t.y + 0.2, x1 - 0.2, y1 - 0.2);
  ctx.strokeStyle = GOLD.light;
  ctx.lineWidth = Math.max(1, 1.5 * z);
  ctx.stroke();
  // Centre : couleur du propriétaire (crème si personne).
  diamond(ctx, cam, t.x + 0.42, t.y + 0.42, x1 - 0.42, y1 - 0.42);
  ctx.fillStyle = owner ? owner.main : '#fff6d0';
  ctx.fill();
  ctx.strokeStyle = owner ? owner.dark : GOLD.dark;
  ctx.lineWidth = Math.max(1, 1.5 * z);
  ctx.stroke();
  // Anneau de règne du propriétaire : arc au sol (ellipse iso) qui se remplit vers 2 minutes.
  const c = cam.gridToScreen(t.cx, t.cy);
  if (owner) {
    const k = Math.min(1, world.king.reignOf(t.owner) / KING.winSeconds);
    const rx = 34 * z;
    const ry = 17 * z;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(2, 4 * z);
    ctx.stroke();
    if (k > 0) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.strokeStyle = t.contested && Math.floor(time * 4) % 2 === 0 ? '#ffffff' : owner.light;
      ctx.lineWidth = Math.max(2, 4 * z);
      ctx.stroke();
    }
  }
  // Reflet qui balaie la dalle de temps en temps.
  const sweep = (time * 0.35) % 1;
  if (sweep < 0.3) {
    const s = t.x + (sweep / 0.3) * t.size;
    ctx.globalAlpha = 0.35 * Math.sin((sweep / 0.3) * Math.PI);
    diamond(ctx, cam, Math.max(t.x + 0.04, s - 0.15), t.y + 0.04, Math.min(x1 - 0.04, s + 0.15), y1 - 0.04);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Couronne pixel posée au centre, qui flotte légèrement.
  const bob = Math.sin(time * 2.2) * 1.5 * z;
  ctx.fillStyle = 'rgba(20,20,30,0.3)';
  ctx.beginPath();
  ctx.ellipse(c.x + 2 * z, c.y + 1 * z, 13 * z, 5 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPixelCrown(ctx, c.x, c.y - 3 * z + bob, Math.max(1.5, 3.2 * z), owner ? owner.light : '#5fb8ff');
  ctx.restore();
}

/** Repère du trône sur la mini-carte : losange doré (centre aux couleurs du propriétaire). */
export function drawKingMinimap(ctx: CanvasRenderingContext2D, world: World, toMini: (gx: number, gy: number) => { x: number; y: number }, size: number): void {
  const t = world.king.find(world);
  if (!t) return;
  const p = toMini(t.cx, t.cy);
  const shape = (s: number) => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s / 2);
    ctx.lineTo(p.x + s, p.y);
    ctx.lineTo(p.x, p.y + s / 2);
    ctx.lineTo(p.x - s, p.y);
    ctx.closePath();
  };
  ctx.save();
  shape(size * 2.2);
  ctx.fillStyle = GOLD.main;
  ctx.fill();
  ctx.strokeStyle = '#3a2a00';
  ctx.lineWidth = 1;
  ctx.stroke();
  shape(size * 1.1);
  ctx.fillStyle = t.owner === NO_TEAM ? '#fff6d0' : TEAM_COLORS[world.teamColors[t.owner]].ui;
  ctx.fill();
  // Petite couronne au-dessus.
  drawPixelCrown(ctx, p.x, p.y - size * 0.9, Math.max(0.8, size * 0.28), '#5fb8ff');
  ctx.restore();
}
