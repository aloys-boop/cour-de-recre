import { TEAM_COLORS } from '../config';
import { BRAWL, type Brawl } from '../core/brawls';
import { pointVisible } from '../core/fog';
import type { World } from '../core/world';
import type { Camera } from './camera';

/** Largeur de la barre (px écran, indépendante du zoom pour rester lisible) et hauteur. */
export const BAR_W = 54;
export const BAR_H = 7;

/**
 * Barres de bagarre : au-dessus de chaque bagarre visible, une barre partagée en segments aux
 * couleurs des équipes, proportionnels à leur force ; un chevron montre l'équipe qui gagne du
 * terrain ; fondu à la fin. Les parts affichées glissent en douceur d'une détection à l'autre.
 */
export class BrawlBars {
  private shown = new Map<number, Map<number, number>>();

  /** Parts affichées (lissées) d'une bagarre, dans l'ordre de b.teams. */
  displayed(b: Brawl, dt: number): number[] {
    let m = this.shown.get(b.id);
    if (!m) this.shown.set(b.id, (m = new Map(b.teams.map((t, i) => [t, b.shares[i]]))));
    const k = Math.min(1, dt * 6);
    const out = b.teams.map((t, i) => {
      const v = (m!.get(t) ?? b.shares[i]) + (b.shares[i] - (m!.get(t) ?? b.shares[i])) * k;
      m!.set(t, v);
      return v;
    });
    const sum = out.reduce((a, c) => a + c, 0) || 1;
    return out.map((v) => v / sum);
  }

  draw(ctx: CanvasRenderingContext2D, world: World, cam: Camera, playerTeam: number, time: number, dt: number): void {
    const keep = new Set<number>();
    for (const b of world.brawls.list) {
      keep.add(b.id);
      if (!pointVisible(world, playerTeam, b.x, b.y)) continue; // bagarre cachée par le brouillard
      const shares = this.displayed(b, dt);
      const alpha = b.endedAt === null ? 1 : Math.max(0, 1 - (world.time - b.endedAt) / BRAWL.fade);
      if (alpha <= 0) continue;
      const head = cam.gridToScreen(b.top.x, b.top.y);
      const c = cam.gridToScreen(b.x, b.y);
      // Au-dessus des têtes (et de leurs barres de vie), jamais sur les élèves.
      const x = Math.round(c.x - BAR_W / 2);
      const y = Math.round(Math.min(c.y, head.y) - 80 * cam.zoom - BAR_H);
      if (x + BAR_W < 0 || x > cam.viewW || y + BAR_H < 0 || y > cam.viewH) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawBar(ctx, x, y, BAR_W, BAR_H, b.teams.map((t) => world.teamColors[t]), shares);
      drawTrend(ctx, b, shares, x, y, time);
      ctx.restore();
    }
    for (const id of this.shown.keys()) if (!keep.has(id)) this.shown.delete(id);
  }
}

/** Barre segmentée : fond sombre, un segment par équipe, séparations fines. */
export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colors: number[], shares: number[]): void {
  ctx.fillStyle = 'rgba(15,15,25,0.85)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  let cx = x;
  shares.forEach((s, i) => {
    const sw = i === shares.length - 1 ? x + w - cx : Math.round(s * w);
    ctx.fillStyle = TEAM_COLORS[colors[i]]?.ui ?? '#888';
    ctx.fillRect(cx, y, sw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx, y, sw, 2);
    if (i > 0) {
      ctx.fillStyle = 'rgba(15,15,25,0.9)';
      ctx.fillRect(cx - 1, y, 1, h);
    }
    cx += sw;
  });
}

/** Chevron animé au-dessus du segment de l'équipe qui gagne du terrain. */
function drawTrend(ctx: CanvasRenderingContext2D, b: Brawl, shares: number[], x: number, y: number, time: number): void {
  const i = b.teams.indexOf(b.trendTeam);
  if (i < 0) return;
  let start = 0;
  for (let k = 0; k < i; k++) start += shares[k];
  const mid = x + (start + shares[i] / 2) * BAR_W;
  const bob = Math.sin(time * 8) * 1.5;
  const ty = y - 4 + bob;
  ctx.beginPath();
  ctx.moveTo(mid - 5, ty);
  ctx.lineTo(mid + 5, ty);
  ctx.lineTo(mid, ty - 6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,15,25,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
