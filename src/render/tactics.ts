import { campsOf } from '../core/camps';
import type { Tile } from '../core/tile';
import { TEAM_COLORS } from '../config';
import type { Vec2 } from '../core/types';
import type { Unit } from '../core/unit';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { FEET_Y } from './sprites';
import { drawSuit } from './suits';

/** Couleur du marqueur d'ordre en mode charge. */
export const CHARGE_COLOR = '#ff9a2e';

/** Durée (s) pendant laquelle un élève est considéré « en soin » après le dernier point rendu. */
const HEAL_WINDOW = 0.15;
/** Période (s) d'un cœur qui monte. */
const HEART_PERIOD = 1.1;

const auraBuf: boolean[] = [false, false, false, false];

/** Équipes qui possèdent au moins un pique (aura de dégâts sous leurs élèves). */
export function spadeAuraTeams(world: World): boolean[] {
  for (let t = 0; t < auraBuf.length; t++) auraBuf[t] = t < world.numTeams && world.mods[t].suits.spade > 0;
  return auraBuf;
}

/** Aura rougeâtre discrète au sol, sous un élève (équipe avec un pique). */
export function drawSpadeAura(ctx: CanvasRenderingContext2D, p: Vec2, z: number): void {
  ctx.fillStyle = 'rgba(232,58,40,0.24)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 17 * z, 8.5 * z, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Petit cœur qui monte au-dessus d'un élève en train de se soigner. */
export function drawHealHeart(ctx: CanvasRenderingContext2D, u: Unit, p: Vec2, z: number, time: number): void {
  if (!u.alive || u.healedAt < 0 || time - u.healedAt > HEAL_WINDOW) return;
  const k = ((time + u.phase * HEART_PERIOD) % HEART_PERIOD) / HEART_PERIOD;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
  const x = p.x + Math.sin(k * Math.PI * 2 + u.phase * 6) * 2.5 * z;
  const y = p.y - (FEET_Y + 12 + 16 * k) * z;
  drawSuit(ctx, 'heart', x, y, 9 * z, '#ff4f6d');
  ctx.globalAlpha = prev;
}

/** Drapeaux des points de ralliement des camps du joueur, reliés à leur camp par un pointillé. */
export function drawRallies(
  ctx: CanvasRenderingContext2D,
  world: World,
  cam: Camera,
  playerTeam: number,
  time: number,
  showLine: (camp: Tile) => boolean = () => true,
): void {
  if (world.rallies.size === 0) return;
  const z = cam.zoom;
  const color = TEAM_COLORS[world.teamColors[playerTeam]] ?? TEAM_COLORS[0];
  const mine = campsOf(world, playerTeam);
  for (const camp of mine) {
    const r = world.rallyFor(camp);
    if (!r) continue;
    const a = cam.gridToScreen(camp.cx, camp.cy);
    const p = cam.gridToScreen(r.x, r.y);
    // Pointillé du camp vers le drapeau : seulement pour le camp affiché (panneau) ou en cours de réglage.
    if (showLine(camp)) {
      ctx.save();
      ctx.setLineDash([4 * z, 5 * z]);
      ctx.lineDashOffset = -time * 14 * z;
      ctx.strokeStyle = 'rgba(20,20,30,0.45)';
      ctx.lineWidth = Math.max(2.5, 3.5 * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.strokeStyle = color.light;
      ctx.lineWidth = Math.max(1.2, 1.8 * z);
      ctx.stroke();
      ctx.restore();
    }
    // Socle.
    ctx.fillStyle = 'rgba(20,20,30,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2 * z, p.y, 7 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mât.
    const h = 34 * z;
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = Math.max(1.5, 2 * z);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - h);
    ctx.stroke();
    // Drapeau aux couleurs de l'équipe, qui ondule légèrement, avec le numéro du camp.
    const wave = Math.sin(time * 5 + camp.x) * 2 * z;
    const fw = 20 * z;
    const fh = 14 * z;
    ctx.fillStyle = color.main;
    ctx.strokeStyle = color.dark;
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.quadraticCurveTo(p.x + fw / 2, p.y - h + 2 * z + wave, p.x + fw, p.y - h + 1 * z);
    ctx.lineTo(p.x + fw, p.y - h + fh);
    ctx.quadraticCurveTo(p.x + fw / 2, p.y - h + fh + 2 * z + wave, p.x, p.y - h + fh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const n = mine.indexOf(camp) + 1;
    ctx.font = `900 ${Math.max(9, Math.round(10 * z))}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEAM_COLORS[world.teamColors[playerTeam]]?.text ?? '#fff';
    ctx.fillText(String(n), p.x + fw / 2, p.y - h + fh / 2 + 1 * z + wave / 2);
  }
}

/**
 * Renforts automatiques : pointillé animé du camp vers la case qu'il secourt, avec des chevrons
 * qui avancent (sens du renfort) et un petit « + » cerclé au-dessus de la case secourue.
 */
export function drawReinforcements(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  links: readonly { from: Tile; to: Tile }[],
  colorIndex: number,
  time: number,
): void {
  if (!links.length) return;
  const z = cam.zoom;
  const color = TEAM_COLORS[colorIndex] ?? TEAM_COLORS[0];
  for (const { from, to } of links) {
    const a = cam.gridToScreen(from.cx, from.cy);
    const b = cam.gridToScreen(to.cx, to.cy);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 4) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    ctx.save();
    ctx.setLineDash([7 * z, 6 * z]);
    ctx.lineDashOffset = -time * 22 * z;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(20,20,30,0.5)';
    ctx.lineWidth = Math.max(3, 4.5 * z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = color.light;
    ctx.lineWidth = Math.max(1.5, 2.4 * z);
    ctx.stroke();
    ctx.setLineDash([]);
    // Chevrons qui glissent du camp vers la case.
    const step = 46 * z;
    const off = (time * 30 * z) % step;
    const s = 5 * z;
    ctx.fillStyle = color.main;
    ctx.strokeStyle = color.dark;
    ctx.lineWidth = Math.max(1, 1.2 * z);
    for (let d = step * 0.6 + off; d < len - 18 * z; d += step) {
      const x = a.x + ux * d;
      const y = a.y + uy * d;
      ctx.beginPath();
      ctx.moveTo(x + ux * s, y + uy * s);
      ctx.lineTo(x - ux * s - uy * s, y - uy * s + ux * s);
      ctx.lineTo(x - ux * s * 0.3, y - uy * s * 0.3);
      ctx.lineTo(x - ux * s + uy * s, y - uy * s - ux * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // « + » cerclé qui pulse au-dessus de la case secourue.
    const r = (8 + Math.sin(time * 6) * 1.2) * z;
    const cy = b.y - 30 * z;
    ctx.fillStyle = color.main;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.5, 2 * z);
    ctx.beginPath();
    ctx.arc(b.x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = color.text ?? '#fff';
    ctx.lineWidth = Math.max(2, 2.6 * z);
    ctx.beginPath();
    ctx.moveTo(b.x - r * 0.5, cy);
    ctx.lineTo(b.x + r * 0.5, cy);
    ctx.moveTo(b.x, cy - r * 0.5);
    ctx.lineTo(b.x, cy + r * 0.5);
    ctx.stroke();
    ctx.restore();
  }
}
