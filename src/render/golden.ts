// Effets visuels du rythme de partie : case dorée (liseré animé, scintillement) et
// barre de vie clignotante des équipes sans camp.
import { RHYTHM } from '../config';
import type { Tile } from '../core/tile';
import type { World } from '../core/world';
import type { Camera } from './camera';

export const GOLD = { main: '#ffc928', light: '#fff2a8', dark: '#c98a00' };

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

/** Liseré doré animé et scintillement sur la case dorée (dessiné au sol, sous les élèves). */
export function drawGoldenTile(ctx: CanvasRenderingContext2D, world: World, t: Tile, cam: Camera, time: number): void {
  if (world.rhythm.golden !== t) return;
  const z = cam.zoom;
  const left = world.rhythm.goldenLeft;
  // Les 5 dernières secondes, le liseré clignote pour annoncer la fin.
  const ending = left < 5 && Math.floor(time * 4) % 2 === 0;
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.save();
  // Voile doré léger sur la case.
  diamond(ctx, cam, t.x + 0.1, t.y + 0.1, t.x + t.size - 0.1, t.y + t.size - 0.1);
  ctx.fillStyle = `rgba(255, 205, 40, ${0.12 + 0.1 * pulse})`;
  ctx.fill();
  // Halo extérieur.
  diamond(ctx, cam, t.x - 0.02, t.y - 0.02, t.x + t.size + 0.02, t.y + t.size + 0.02);
  ctx.strokeStyle = `rgba(255, 220, 90, ${ending ? 0.15 : 0.35 + 0.25 * pulse})`;
  ctx.lineWidth = Math.max(2, 6 * z);
  ctx.stroke();
  // Liseré pointillé qui tourne.
  diamond(ctx, cam, t.x + 0.06, t.y + 0.06, t.x + t.size - 0.06, t.y + t.size - 0.06);
  ctx.setLineDash([8 * z, 5 * z]);
  ctx.lineDashOffset = -time * 30 * z;
  ctx.strokeStyle = ending ? GOLD.light : GOLD.main;
  ctx.lineWidth = Math.max(1.5, 3 * z);
  ctx.stroke();
  ctx.setLineDash([]);
  // Scintillement : quelques étincelles en croix qui apparaissent et s'éteignent.
  for (let i = 0; i < 4; i++) {
    const ph = (time * 0.9 + i * 0.37) % 1;
    const a = Math.max(0, Math.sin(ph * Math.PI));
    if (a < 0.05) continue;
    const seed = Math.floor(time * 0.9 + i * 0.37) * 7 + i * 13;
    const gx = t.x + 0.2 + ((seed * 0.618) % 1) * (t.size - 0.4);
    const gy = t.y + 0.2 + ((seed * 0.382 + 0.5) % 1) * (t.size - 0.4);
    const p = cam.gridToScreen(gx, gy);
    const s = (2 + 4 * a) * z;
    ctx.globalAlpha = a;
    ctx.strokeStyle = GOLD.light;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.beginPath();
    ctx.moveTo(p.x - s, p.y - 6 * z);
    ctx.lineTo(p.x + s, p.y - 6 * z);
    ctx.moveTo(p.x, p.y - 6 * z - s);
    ctx.lineTo(p.x, p.y - 6 * z + s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Minuterie : petit arc doré qui se vide.
  const c = cam.gridToScreen(t.cx, t.cy);
  const k = Math.max(0, Math.min(1, left / RHYTHM.goldenDuration));
  ctx.beginPath();
  ctx.arc(c.x, c.y - 20 * z, 5 * z, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
  ctx.strokeStyle = GOLD.main;
  ctx.lineWidth = Math.max(1.5, 2 * z);
  ctx.stroke();
  ctx.restore();
}

/** Barre de vie qui clignote doucement en rouge pour une équipe sans camp. */
export function drawStarvingBar(ctx: CanvasRenderingContext2D, world: World, team: number, bx: number, by: number, bw: number, bh: number): void {
  if (!world.rhythm.starving[team]) return;
  const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(world.time * 6));
  ctx.save();
  ctx.strokeStyle = `rgba(255, 70, 50, ${a})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
  ctx.restore();
}

/** Repère de la case dorée sur la mini-carte (losange doré pulsant). */
export function drawGoldenMinimap(ctx: CanvasRenderingContext2D, world: World, toMini: (gx: number, gy: number) => { x: number; y: number }, size: number): void {
  const t = world.rhythm.golden;
  if (!t) return;
  const p = toMini(t.cx, t.cy);
  const s = size * (1.6 + 0.5 * (0.5 + 0.5 * Math.sin(world.time * 5)));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - s / 2);
  ctx.lineTo(p.x + s, p.y);
  ctx.lineTo(p.x, p.y + s / 2);
  ctx.lineTo(p.x - s, p.y);
  ctx.closePath();
  ctx.strokeStyle = GOLD.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
