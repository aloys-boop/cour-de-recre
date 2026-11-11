// Escouades en défense (consigne « Défendre », v5.12) : le secteur, le poste et la case secourue.
import { TEAM_COLORS } from '../config';
import type { Tile } from '../core/tile';
import type { Vec2 } from '../core/types';
import type { Camera } from './camera';
import { drawGuardZone, shieldPath } from './garrison';

/** Ce qu'il faut montrer d'une escouade en défense du joueur. */
export interface DefenceView {
  zone: readonly Tile[];
  post: Tile | null;
  target: Tile | null;
  from: Vec2;
  selected: boolean;
}

/** Couleur de l'alerte (case secourue) : la même que le bouton « Défendre » allumé. */
export const DEFEND_COLOR = '#3f8cff';

/**
 * Au sol, sous les élèves : chaîne de tirets du poste vers chaque case du secteur (discrète, ou
 * franche si l'escouade est sélectionnée), et zone défendue de chaque case pour l'escouade sélectionnée.
 */
export function drawDefenceFloor(ctx: CanvasRenderingContext2D, cam: Camera, views: readonly DefenceView[], color: number, time: number): void {
  if (!views.length) return;
  const z = cam.zoom;
  const tc = TEAM_COLORS[color] ?? TEAM_COLORS[0];
  for (const v of views) {
    if (v.selected) for (const t of v.zone) drawGuardZone(ctx, cam, t, color, time);
    const p = v.post;
    if (!p) continue;
    const a = cam.gridToScreen(p.cx, p.cy);
    ctx.save();
    ctx.globalAlpha = v.selected ? 0.95 : 0.5;
    ctx.setLineDash([2 * z, 5 * z]);
    ctx.lineCap = 'round';
    for (const t of v.zone) {
      if (t === p) continue;
      const b = cam.gridToScreen(t.cx, t.cy);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(20,20,30,0.4)';
      ctx.lineWidth = Math.max(2.5, 3.4 * z);
      ctx.stroke();
      ctx.strokeStyle = v.selected ? tc.light : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.2, 1.6 * z);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Au-dessus des élèves : petit bouclier bleu planté sur le poste, et, quand l'escouade court au
 * secours d'une case, tirets bleus vers cette case et bouclier qui bat dessus.
 */
export function drawDefenceAir(ctx: CanvasRenderingContext2D, cam: Camera, views: readonly DefenceView[], color: number, time: number): void {
  if (!views.length) return;
  const z = cam.zoom;
  const tc = TEAM_COLORS[color] ?? TEAM_COLORS[0];
  for (const v of views) {
    const k = v.selected ? 1.1 : 0.85;
    if (v.target) {
      const a = cam.gridToScreen(v.from.x, v.from.y);
      const b = cam.gridToScreen(v.target.cx, v.target.cy);
      ctx.save();
      ctx.globalAlpha = v.selected ? 1 : 0.8;
      if (Math.hypot(b.x - a.x, b.y - a.y) > 24 * z) {
        ctx.setLineDash([3 * z, 5 * z]);
        ctx.lineDashOffset = -time * 22 * z;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(20,20,30,0.45)';
        ctx.lineWidth = Math.max(2.5, 3.6 * z);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = DEFEND_COLOR;
        ctx.lineWidth = Math.max(1.4, 2 * z);
        ctx.stroke();
      }
      ctx.restore();
      const beat = 1 + 0.12 * Math.max(0, Math.sin(time * 9));
      planted(ctx, b.x, b.y, z * k * beat, DEFEND_COLOR, '#ffffff', '!');
    }
    const p = v.post;
    if (p && p !== v.target) {
      // Sur le coin nord de la case : le piquet ne se plante pas au milieu des élèves.
      const s = cam.gridToScreen(p.x + 0.35, p.y + 0.35);
      planted(ctx, s.x, s.y, z * k, tc.ui, tc.text, '');
    }
  }
}

/** Bouclier planté sur un piquet en (x, y) (pied du piquet), avec un signe éventuel. */
function planted(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, fill: string, ink: string, sign: string): void {
  if (x < -40 || y < -60 || x > ctx.canvas.width + 40 || y > ctx.canvas.height + 60) return;
  const h = 22 * z;
  const w = 8 * z;
  const sh = 10 * z;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, 5 * z, 2.2 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = Math.max(2.5, 3.2 * z);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h + sh);
  ctx.stroke();
  shieldPath(ctx, x, y - h, w, sh);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2 * z);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  if (sign) {
    ctx.font = `900 ${Math.round(12 * z)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;
    ctx.fillText(sign, x, y - h - sh * 0.05);
  }
  ctx.restore();
}
