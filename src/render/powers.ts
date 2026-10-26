import { POWERS, type PowerId } from '../core/powers';
import type { Vec2 } from '../core/types';
import type { Unit } from '../core/unit';
import type { World } from '../core/world';
import type { Camera } from './camera';

/** Couleur de chaque pouvoir (boutons, aperçu, effets). */
export const POWER_COLORS: Record<PowerId, string> = { sonnerie: '#ffd23f', neige: '#bfe6ff', gouter: '#ff9ec7' };

/** Trace le disque d'une zone (cercle dans la grille, donc ellipse à l'écran). */
export function zonePath(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, r: number): void {
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = cam.gridToScreen(x + Math.cos(a) * r, y + Math.sin(a) * r);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** Aperçu de la zone d'un pouvoir armé : disque pointillé, élèves concernés entourés. */
export function drawPowerAim(ctx: CanvasRenderingContext2D, cam: Camera, world: World, id: PowerId, at: Vec2, team: number, time: number, confirmed: boolean, valid = true): void {
  const info = POWERS[id];
  // Cible non valide (hors de la cour, sur le HUD) : zone rouge, personne d'entouré.
  const color = valid ? POWER_COLORS[id] : '#ff4d3a';
  ctx.save();
  zonePath(ctx, cam, at.x, at.y, info.radius);
  ctx.globalAlpha = confirmed ? 0.3 : 0.18;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.setLineDash([7 * cam.zoom, 5 * cam.zoom]);
  ctx.lineDashOffset = -time * 30 * cam.zoom;
  ctx.lineWidth = Math.max(2, 3 * cam.zoom);
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.setLineDash([]);
  // Élèves qui seraient touchés.
  const heal = id === 'gouter';
  const r2 = info.radius * info.radius;
  ctx.lineWidth = Math.max(1.5, 2 * cam.zoom);
  for (const u of valid ? world.units : []) {
    if (!u.alive || heal !== world.isFriend(u.team, team)) continue;
    if ((u.x - at.x) ** 2 + (u.y - at.y) ** 2 > r2) continue;
    const p = cam.gridToScreen(u.x, u.y);
    ctx.strokeStyle = heal ? '#7dff9a' : '#ff5a4a';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 14 * cam.zoom, 7 * cam.zoom, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Centre : petite croix de visée.
  const c = cam.gridToScreen(at.x, at.y);
  ctx.strokeStyle = '#1e1e28';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x - 8, c.y);
  ctx.lineTo(c.x + 8, c.y);
  ctx.moveTo(c.x, c.y - 5);
  ctx.lineTo(c.x, c.y + 5);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

interface Fx {
  id: PowerId;
  x: number;
  y: number;
  r: number;
  t: number;
  team: number;
  /** Points d'impact (boules de neige, gâteaux), en grille. */
  drops: Vec2[];
}

const FX_LIFE: Record<PowerId, number> = { sonnerie: 1.1, neige: 1.2, gouter: 1.4 };

/** Effets des pouvoirs lancés : ondes de sonnerie, boules de neige qui tombent, goûter qui pleut. */
export class PowerEffects {
  private list: Fx[] = [];

  add(id: PowerId, x: number, y: number, r: number, team: number, rand: () => number = Math.random): void {
    const drops: Vec2[] = [];
    const n = id === 'sonnerie' ? 0 : 10;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      drops.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
    }
    this.list.push({ id, x, y, r, t: 0, team, drops });
  }

  update(dt: number): void {
    for (const f of this.list) f.t += dt;
    this.list = this.list.filter((f) => f.t < FX_LIFE[f.id]);
  }

  get activeCount(): number {
    return this.list.length;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const z = cam.zoom;
    for (const f of this.list) {
      const k = f.t / FX_LIFE[f.id];
      ctx.save();
      if (f.id === 'sonnerie') {
        // Trois ondes sonores qui s'élargissent jusqu'au bord de la zone.
        for (let i = 0; i < 3; i++) {
          const kk = k * 1.4 - i * 0.2;
          if (kk <= 0 || kk >= 1) continue;
          zonePath(ctx, cam, f.x, f.y, f.r * kk);
          ctx.globalAlpha = 1 - kk;
          ctx.strokeStyle = POWER_COLORS.sonnerie;
          ctx.lineWidth = Math.max(2, 4 * z);
          ctx.stroke();
        }
        const c = cam.gridToScreen(f.x, f.y);
        ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
        drawBell(ctx, c.x, c.y - (50 + 20 * k) * z, 12 * z, Math.sin(f.t * 40) * 0.35);
      } else {
        // Projectiles qui tombent du ciel puis éclatent au sol.
        f.drops.forEach((d, i) => {
          const start = (i / f.drops.length) * 0.4;
          const kk = (k * FX_LIFE[f.id] - start) / 0.35;
          if (kk < 0) return;
          const p = cam.gridToScreen(d.x, d.y);
          if (kk < 1) {
            const h = (1 - kk) * 120 * z;
            ctx.globalAlpha = 1;
            if (f.id === 'neige') drawSnowball(ctx, p.x, p.y - h, 5 * z);
            else drawCake(ctx, p.x, p.y - h, 6 * z);
          } else {
            const s = kk - 1;
            if (s > 1.2) return;
            ctx.globalAlpha = Math.max(0, 1 - s / 1.2);
            if (f.id === 'neige') {
              ctx.fillStyle = '#ffffff';
              for (let j = 0; j < 5; j++) {
                const a = (j / 5) * Math.PI * 2;
                ctx.fillRect(p.x + Math.cos(a) * (4 + 10 * s) * z - 2 * z, p.y + Math.sin(a) * (2 + 5 * s) * z - 2 * z, 4 * z, 4 * z);
              }
            } else {
              ctx.fillStyle = '#7dff9a';
              ctx.font = `900 ${Math.round(12 * z)}px "Trebuchet MS", Verdana, sans-serif`;
              ctx.textAlign = 'center';
              ctx.fillText('+', p.x, p.y - (10 + 26 * s) * z);
            }
          }
        });
      }
      ctx.restore();
    }
  }
}

/** Petite note de musique au-dessus d'un élève figé par une sonnerie. */
export function drawFrozenMark(ctx: CanvasRenderingContext2D, u: Unit, p: Vec2, z: number, time: number): void {
  const y = p.y - (64 + Math.sin(time * 6 + u.id) * 2) * z;
  ctx.save();
  ctx.strokeStyle = '#1e1e28';
  ctx.lineWidth = Math.max(1, 1.2 * z);
  ctx.fillStyle = POWER_COLORS.sonnerie;
  drawBell(ctx, p.x + 10 * z, y, 6 * z, Math.sin(time * 30 + u.id) * 0.4);
  // Pieds pris dans un anneau bleu pâle.
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = Math.max(1.5, 2 * z);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 12 * z, 6 * z, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#bfe6ff';
  ctx.stroke();
  ctx.restore();
}

/** Cloche d'école (sonnerie), inclinée de `tilt` radians. */
export function drawBell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tilt = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.7);
  ctx.quadraticCurveTo(-s * 0.9, -s, 0, -s);
  ctx.quadraticCurveTo(s * 0.9, -s, s, s * 0.7);
  ctx.closePath();
  ctx.fillStyle = POWER_COLORS.sonnerie;
  ctx.fill();
  ctx.strokeStyle = '#7a5a08';
  ctx.lineWidth = Math.max(1, s * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, s * 0.85, s * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#7a5a08';
  ctx.fill();
  ctx.restore();
}

function drawSnowball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#7fa6c4';
  ctx.lineWidth = Math.max(1, r * 0.3);
  ctx.stroke();
}

function drawCake(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // Part de gâteau : génoise, crème rose, cerise.
  ctx.fillStyle = '#c98a4a';
  ctx.fillRect(x - s, y - s * 0.3, s * 2, s);
  ctx.fillStyle = POWER_COLORS.gouter;
  ctx.fillRect(x - s, y - s * 0.7, s * 2, s * 0.45);
  ctx.fillStyle = '#e5302a';
  ctx.fillRect(x - s * 0.25, y - s * 1.1, s * 0.5, s * 0.45);
  ctx.strokeStyle = '#1e1e28';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - s, y - s * 0.7, s * 2, s * 1.4);
}
