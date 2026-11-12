// Escortes (consigne « Suivre », v5.13) : le lien entre l'escorte et son protégé.
import { TEAM_COLORS } from '../config';
import type { Vec2 } from '../core/types';
import type { Camera } from './camera';
import { FEET_Y } from './sprites';

/** Couleur de la consigne « Suivre » : la même que le bouton allumé. */
export const FOLLOW_COLOR = '#22b573';

/** Ce qu'il faut montrer d'une escorte du joueur. */
export interface EscortLink {
  from: Vec2;
  to: Vec2;
  selected: boolean;
}

/**
 * Au-dessus des élèves : tirets de l'escorte vers son protégé (quand elle est à la traîne), et petit
 * écusson vert à double chevron qui flotte au-dessus du protégé. L'escorte sélectionnée est mise en
 * avant (trait de couleur, écusson plus grand) ; les autres restent discrètes.
 */
export function drawEscorts(ctx: CanvasRenderingContext2D, cam: Camera, links: readonly EscortLink[], colorIndex: number, time: number): void {
  if (!links.length) return;
  const z = cam.zoom;
  const color = TEAM_COLORS[colorIndex] ?? TEAM_COLORS[0];
  for (const { from, to, selected } of links) {
    const a = cam.gridToScreen(from.x, from.y);
    const b = cam.gridToScreen(to.x, to.y);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save();
    ctx.globalAlpha = selected ? 1 : 0.7;
    if (len > 30 * z) {
      ctx.setLineDash([2 * z, 4 * z]);
      ctx.lineDashOffset = -time * 20 * z;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(20,20,30,0.45)';
      ctx.lineWidth = Math.max(2.5, 3.6 * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = selected ? color.light : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(1.2, 1.8 * z);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Écusson au-dessus des têtes du protégé : rond vert, double chevron blanc, léger rebond.
    const k = selected ? 1.15 : 0.9;
    const r = 8 * z * k;
    const x = b.x;
    const y = b.y - (FEET_Y + 14) * z - Math.abs(Math.sin(time * 3)) * 2 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(x, y + 1.5 * z, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FOLLOW_COLOR;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.2, 1.5 * z);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.4, 1.9 * z * k);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const c = r * 0.42;
    for (const dx of [-c * 0.75, c * 0.55]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - c * 0.5, y - c);
      ctx.lineTo(x + dx + c * 0.5, y);
      ctx.lineTo(x + dx - c * 0.5, y + c);
      ctx.stroke();
    }
    ctx.restore();
  }
}
