import { TEAM_COLORS, TEAM_TILE_COLORS } from '../config';
import { gridToScreen, TILE_H, TILE_W } from '../core/math';
import { NO_TEAM, type Vec2 } from '../core/types';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { COLORS } from './renderer';

/** Mini-carte : vue d'ensemble de la cour, des cases et des élèves, plus le cadre de la caméra. */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private w: number;
  private h: number;

  constructor(
    private canvas: HTMLCanvasElement,
    cssW: number,
    cssH: number,
  ) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = cssW;
    this.h = cssH;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  setMap(mw: number, mh: number): void {
    const pw = (mw + mh) * (TILE_W / 2);
    const ph = (mw + mh) * (TILE_H / 2);
    this.scale = Math.min((this.w - 8) / pw, (this.h - 8) / ph);
    const c = gridToScreen(mw / 2, mh / 2);
    this.ox = this.w / 2 - c.x * this.scale;
    this.oy = this.h / 2 - c.y * this.scale;
  }

  private toMini(gx: number, gy: number): Vec2 {
    const p = gridToScreen(gx, gy);
    return { x: this.ox + p.x * this.scale, y: this.oy + p.y * this.scale };
  }

  /** Point de la mini-carte (px CSS) → coordonnées grille. */
  toGrid(mx: number, my: number): Vec2 {
    const wx = (mx - this.ox) / this.scale;
    const wy = (my - this.oy) / this.scale;
    const a = wx / (TILE_W / 2);
    const b = wy / (TILE_H / 2);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }

  draw(world: World, cam: Camera): void {
    const ctx = this.ctx;
    const mw = world.map.w;
    const mh = world.map.h;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = 'rgba(10, 16, 40, 0.85)';
    ctx.fillRect(0, 0, this.w, this.h);
    // Sol.
    const a = this.toMini(0, 0);
    const b = this.toMini(mw, 0);
    const c = this.toMini(mw, mh);
    const d = this.toMini(0, mh);
    ctx.fillStyle = COLORS.floor;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    // Cases.
    for (const t of world.tiles) {
      const p = this.toMini(t.cx, t.cy);
      const s = Math.max(2.5, (TILE_W / 2) * this.scale * 0.9);
      ctx.fillStyle = t.owner === NO_TEAM ? '#ffffff' : TEAM_TILE_COLORS[world.teamColors[t.owner]];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s / 2);
      ctx.lineTo(p.x + s, p.y);
      ctx.lineTo(p.x, p.y + s / 2);
      ctx.lineTo(p.x - s, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // Élèves.
    for (const u of world.units) {
      if (!u.alive) continue;
      const p = this.toMini(u.x, u.y);
      ctx.fillStyle = TEAM_COLORS[world.teamColors[u.team]].ui;
      ctx.fillRect(p.x - 1, p.y - 1, 2.5, 2.5);
    }
    // Cadre de la caméra.
    const tl = cam.screenToWorld(0, 0);
    const br = cam.screenToWorld(cam.viewW, cam.viewH);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.ox + tl.x * this.scale, this.oy + tl.y * this.scale, (br.x - tl.x) * this.scale, (br.y - tl.y) * this.scale);
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }
}
