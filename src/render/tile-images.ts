import { gridToScreen, TILE_H, TILE_W } from '../core/math';
import type { Tile } from '../core/tile';
import { Camera } from './camera';

type MakeCanvas = (w: number, h: number) => { width: number; height: number; getContext(id: '2d'): unknown };
type Paint<A, B> = (ctx: CanvasRenderingContext2D, cam: Camera, a: A, b: B) => void;

interface Entry {
  img: CanvasImageSource;
  /** Taille de l'image en pixels de l'appareil. */
  pw: number;
  ph: number;
  /** Position du centre de la case dans l'image, en points (pixels CSS). */
  hw: number;
  hh: number;
}

/**
 * Fonds de cases et obstacles en cache (v5.25). Le fond d'une case (losange, liserés, grand symbole,
 * emblème) coûtait plus des trois quarts du dessin de la vue d'ensemble : il est maintenant
 * dessiné une fois par combinaison (forme, symbole, propriétaire, motifs) au zoom courant, à la
 * résolution de l'écran, puis recopié au pixel près. Pendant un pincement (zoom qui change
 * d'une image à l'autre), les cases sont dessinées directement, comme avant ; le cache est
 * refait dès que le zoom se stabilise.
 */
export class TileImages {
  private cache = new Map<string, Entry>();
  private zoom = -1;
  private dpr = 0;
  private lastZoom = -1;
  private active = false;
  /** Translation du contexte (tremblement de caméra), en pixels de l'appareil. */
  private ox = 0;
  private oy = 0;
  /** Nombre d'images construites (tests, outils de performance). */
  built = 0;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private makeCanvas: MakeCanvas,
  ) {}

  /** À appeler au début de chaque image, avant les cases. */
  begin(zoom: number): void {
    const stable = zoom === this.lastZoom;
    this.lastZoom = zoom;
    const ctx = this.ctx;
    const tr = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    // Seulement pour une transformation simple (échelle de l'écran + translation) ; sinon, dessin direct.
    if (!tr || !(tr.a > 0) || tr.a !== tr.d || tr.b !== 0 || tr.c !== 0) {
      this.active = false;
      return;
    }
    if (zoom !== this.zoom || tr.a !== this.dpr) {
      if (!stable) {
        this.active = false;
        return;
      }
      this.cache.clear();
      this.zoom = zoom;
      this.dpr = tr.a;
    }
    this.ox = tr.e;
    this.oy = tr.f;
    this.active = true;
  }

  /**
   * Recopie le fond de la case `t` centré en (`cx`, `cy`) (points de l'écran) ; le construit
   * d'abord avec `paint` s'il n'est pas en cache. Retourne faux si le cache ne sert pas pour
   * cette image (l'appelant dessine alors la case directement).
   */
  draw(t: Tile, owner: number, patterns: boolean, cx: number, cy: number, paint: Paint<Tile, number>): boolean {
    const margin = 10 * this.zoom + 4;
    const hw = (t.size * TILE_W * this.zoom) / 2 + margin;
    const hh = (t.size * TILE_H * this.zoom) / 2 + margin;
    return this.stamp(`${t.isCamp ? 'c' : 'b'}${t.size}|${t.suit ?? ''}|${owner}|${patterns ? 1 : 0}`, cx, cy, t.cx, t.cy, hw, hh, paint, t, owner);
  }

  /**
   * Version générale : image `key` de demi-taille (`hw`, `hh`) points autour d'un point de la
   * grille (`gx`, `gy`) qui tombe à l'écran en (`cx`, `cy`). `paint` la dessine avec une caméra
   * locale qui place ce point au centre de l'image.
   */
  stamp<A, B>(key: string, cx: number, cy: number, gx: number, gy: number, hw: number, hh: number, paint: Paint<A, B>, a: A, b: B): boolean {
    if (!this.active) return false;
    let e = this.cache.get(key);
    if (!e) {
      e = this.build(gx, gy, hw, hh, paint, a, b) ?? undefined;
      if (!e) {
        this.active = false;
        return false;
      }
      if (this.cache.size > 160) this.cache.clear();
      this.cache.set(key, e);
    }
    const dpr = this.dpr;
    // Coin de l'image calé sur un pixel de l'appareil : recopie exacte, sans flou ni moirage.
    const dx = (Math.round((cx - e.hw) * dpr + this.ox) - this.ox) / dpr;
    const dy = (Math.round((cy - e.hh) * dpr + this.oy) - this.oy) / dpr;
    this.ctx.drawImage(e.img, dx, dy, e.pw / dpr, e.ph / dpr);
    return true;
  }

  private build<A, B>(gx: number, gy: number, hw: number, hh: number, paint: Paint<A, B>, a: A, b: B): Entry | null {
    const dpr = this.dpr;
    const pw = Math.ceil(hw * 2 * dpr);
    const ph = Math.ceil(hh * 2 * dpr);
    const c = this.makeCanvas(pw, ph);
    const g = c.getContext('2d') as CanvasRenderingContext2D | null;
    if (!g || typeof g.setTransform !== 'function') return null;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Caméra locale : le point (gx, gy) tombe en (hw, hh).
    const cam = new Camera();
    const w = gridToScreen(gx, gy);
    cam.x = w.x;
    cam.y = w.y;
    cam.zoom = this.zoom;
    cam.viewW = hw * 2;
    cam.viewH = hh * 2;
    paint(g, cam, a, b);
    this.built++;
    return { img: c as unknown as CanvasImageSource, pw, ph, hw, hh };
  }
}
