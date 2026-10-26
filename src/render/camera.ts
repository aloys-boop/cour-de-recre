import { clamp, gridToScreen, screenToGrid, TILE_H, TILE_W } from '../core/math';
import type { Vec2 } from '../core/types';

/** Caméra 2D : centre en coordonnées « monde » (pixels à zoom 1) et facteur de zoom. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  viewW = 1;
  viewH = 1;
  minZoom = 0.5;
  maxZoom = 2.6;
  private mapW = 1;
  private mapH = 1;

  setMap(w: number, h: number): void {
    this.mapW = w;
    this.mapH = h;
  }

  setView(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  /** Cadre toute la carte dans la vue. */
  fit(): void {
    const pw = (this.mapW + this.mapH) * (TILE_W / 2) + 40;
    const ph = (this.mapW + this.mapH) * (TILE_H / 2) + 90;
    this.zoom = clamp(Math.min(this.viewW / pw, this.viewH / ph), this.minZoom, this.maxZoom);
    const c = gridToScreen(this.mapW / 2, this.mapH / 2);
    this.x = c.x;
    this.y = c.y;
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    return { x: (wx - this.x) * this.zoom + this.viewW / 2, y: (wy - this.y) * this.zoom + this.viewH / 2 };
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return { x: (sx - this.viewW / 2) / this.zoom + this.x, y: (sy - this.viewH / 2) / this.zoom + this.y };
  }

  screenToGrid(sx: number, sy: number): Vec2 {
    const w = this.screenToWorld(sx, sy);
    return screenToGrid(w.x, w.y);
  }

  gridToScreen(gx: number, gy: number): Vec2 {
    const w = gridToScreen(gx, gy);
    return this.worldToScreen(w.x, w.y);
  }

  /** Glissement en cours vers un point (centre de la vue), ou null. */
  private glide: { fx: number; fy: number; tx: number; ty: number; t: number; dur: number } | null = null;

  /** La caméra glisse en douceur jusqu'à centrer ce point de la grille. */
  glideTo(gx: number, gy: number, dur = 0.4): void {
    const p = gridToScreen(gx, gy);
    this.glide = { fx: this.x, fy: this.y, tx: p.x, ty: p.y, t: 0, dur };
  }

  get gliding(): boolean {
    return this.glide !== null;
  }

  /** Avance le glissement (appelé à chaque image). */
  update(dt: number): void {
    const g = this.glide;
    if (!g) return;
    g.t += dt;
    const k = Math.min(1, g.t / g.dur);
    const e = k * k * (3 - 2 * k);
    this.x = g.fx + (g.tx - g.fx) * e;
    this.y = g.fy + (g.ty - g.fy) * e;
    this.clampToMap();
    if (k >= 1) this.glide = null;
  }

  pan(dxScreen: number, dyScreen: number): void {
    this.glide = null;
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this.clampToMap();
  }

  /** Zoom autour d'un point écran (le point reste fixe sous le doigt). */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clampToMap();
  }

  centerOnGrid(gx: number, gy: number): void {
    const p = gridToScreen(gx, gy);
    this.x = p.x;
    this.y = p.y;
    this.clampToMap();
  }

  private clampToMap(): void {
    const halfW = (this.mapW + this.mapH) * (TILE_W / 4);
    const halfH = (this.mapW + this.mapH) * (TILE_H / 4);
    const c = gridToScreen(this.mapW / 2, this.mapH / 2);
    const slackX = this.viewW / this.zoom / 2;
    const slackY = this.viewH / this.zoom / 2;
    this.x = clamp(this.x, c.x - halfW - slackX * 0.3, c.x + halfW + slackX * 0.3);
    this.y = clamp(this.y, c.y - halfH - slackY * 0.3, c.y + halfH + slackY * 0.3);
  }
}
