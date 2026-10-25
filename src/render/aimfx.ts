import type { AimTile } from '../core/aim';
import type { Camera } from './camera';

/** Durée (s) du surlignage d'une case visée. */
export const TILE_FLASH_LIFE = 0.5;

/** Case surlignée : `t` = âge en secondes, ou -1 pour un surlignage tenu (flèche en cours). */
export interface TileFlash {
  tile: AimTile;
  t: number;
}

/** Liseré blanc épais autour d'une case visée, qui s'estompe en TILE_FLASH_LIFE secondes. */
export function drawTileFlash(ctx: CanvasRenderingContext2D, cam: Camera, f: TileFlash): void {
  const k = f.t < 0 ? 0 : Math.min(1, f.t / TILE_FLASH_LIFE);
  if (k >= 1) return;
  const z = cam.zoom;
  const s = f.tile.size / 2 + 0.04 + 0.08 * k;
  const pts = [
    cam.gridToScreen(f.tile.cx - s, f.tile.cy - s),
    cam.gridToScreen(f.tile.cx + s, f.tile.cy - s),
    cam.gridToScreen(f.tile.cx + s, f.tile.cy + s),
    cam.gridToScreen(f.tile.cx - s, f.tile.cy + s),
  ];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.globalAlpha = (f.t < 0 ? 0.85 : 1 - k) * 0.45;
  ctx.strokeStyle = '#1e1e28';
  ctx.lineWidth = Math.max(5, 7 * z);
  ctx.stroke();
  ctx.globalAlpha = f.t < 0 ? 0.85 : 1 - k;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, 4 * z);
  ctx.stroke();
  ctx.restore();
}
