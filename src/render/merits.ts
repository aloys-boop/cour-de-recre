import type { Tile } from '../core/tile';
import { UPGRADE_BRANCHES, UPGRADES, type UpgradeBranch } from '../core/upgrades';
import type { Camera } from './camera';

/** Couleur dorée des bons points (étoile du HUD, gains flottants). */
export const MERIT_GOLD = '#ffd23f';
export const MERIT_GOLD_DARK = '#a8780c';

/** Trace une étoile à cinq branches centrée en (x, y), de rayon extérieur r. */
export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Étoile dorée cerclée de sombre. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  starPath(ctx, x, y, r);
  ctx.fillStyle = MERIT_GOLD;
  ctx.fill();
  ctx.strokeStyle = MERIT_GOLD_DARK;
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.stroke();
}

interface Gain {
  active: boolean;
  x: number;
  y: number;
  amount: number;
  t: number;
}

const GAIN_LIFE = 1.2;

/** Gains de bons points du joueur qui s'envolent au-dessus de l'endroit gagné (« +10 ★ »). */
export class MeritPopups {
  private pool: Gain[] = Array.from({ length: 8 }, () => ({ active: false, x: 0, y: 0, amount: 0, t: 0 }));

  add(x: number, y: number, amount: number): void {
    let slot = this.pool.find((g) => !g.active);
    if (!slot) slot = this.pool.reduce((a, b) => (a.t > b.t ? a : b));
    Object.assign(slot, { active: true, x, y, amount, t: 0 });
  }

  update(dt: number): void {
    for (const g of this.pool) {
      if (!g.active) continue;
      g.t += dt;
      if (g.t >= GAIN_LIFE) g.active = false;
    }
  }

  get activeCount(): number {
    return this.pool.filter((g) => g.active).length;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const z = Math.max(0.75, cam.zoom);
    for (const g of this.pool) {
      if (!g.active) continue;
      const k = g.t / GAIN_LIFE;
      const p = cam.gridToScreen(g.x, g.y);
      const y = p.y - (40 + 34 * k) * z;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const text = `+${g.amount}`;
      ctx.font = `900 ${Math.round(13 * z)}px "Trebuchet MS", Verdana, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e1e28';
      ctx.strokeText(text, p.x, y);
      ctx.fillStyle = MERIT_GOLD;
      ctx.fillText(text, p.x, y);
      drawStar(ctx, p.x + 8 * z, y, 6 * z);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Place du fanion de chaque branche sur le camp (cellules depuis son coin nord) : en rang le
 * long du bord avant (sud-ouest), toujours devant les élèves qui stationnent sur le camp.
 */
const PENNANT_SPOT: Record<UpgradeBranch, [number, number]> = {
  prod: [0.3, 1.92],
  hp: [0.75, 1.92],
  dmg: [1.2, 1.92],
  def: [1.65, 1.92],
};

/** Fanions plantés sur un camp : profondeur de tri (x + y) et dessin, pour chaque branche améliorée. */
export function campPennants(t: Tile): Array<{ depth: number; branch: UpgradeBranch; x: number; y: number; level: number }> {
  const out: Array<{ depth: number; branch: UpgradeBranch; x: number; y: number; level: number }> = [];
  for (const b of UPGRADE_BRANCHES) {
    // Seule la Défense est propre au camp ; les améliorations globales ne se plantent pas.
    const level = b === 'def' ? t.defense : 0;
    if (level <= 0) continue;
    const [fx, fy] = PENNANT_SPOT[b];
    out.push({ depth: t.x + fx + t.y + fy, branch: b, x: t.x + fx, y: t.y + fy, level });
  }
  return out;
}

/**
 * Fanion d'amélioration : mât, drapeau aux couleurs de la branche et une étoile dorée par niveau
 * (1 à 3), lisible même dézoomé.
 */
export function drawPennant(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, branch: UpgradeBranch, level: number): void {
  const z = cam.zoom;
  const p = cam.gridToScreen(x, y);
  const h = 30 * z;
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = Math.max(1.2, 2 * z);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - h);
  ctx.stroke();
  const fw = 17 * z;
  const fh = 11 * z;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - h);
  ctx.lineTo(p.x + fw, p.y - h + fh / 2);
  ctx.lineTo(p.x, p.y - h + fh);
  ctx.closePath();
  ctx.fillStyle = UPGRADES[branch].color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.2 * z);
  ctx.stroke();
  for (let i = 0; i < level; i++) drawStar(ctx, p.x - 5 * z, p.y - h + 3 * z + i * 7.5 * z, 3.6 * z);
}
