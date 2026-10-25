/**
 * Dessin du brouillard de guerre : un calque hors écran de 1 pixel par cellule (plus une
 * bordure), dont l'opacité suit la visibilité (voir core/fog.ts), étiré sur le sol iso avec
 * lissage bilinéaire, ce qui adoucit les bords à très faible coût. L'opacité de chaque
 * cellule glisse vers sa cible à chaque image : le voile s'ouvre et se referme en douceur
 * même si la visibilité n'est recalculée que 10 fois par seconde.
 */
import { fogFor } from '../core/fog';
import { TILE_H, TILE_W } from '../core/math';
import type { World } from '../core/world';
import type { Camera } from './camera';
import type { SheetCanvas } from './sprites';

/** Opacité du voile : cellule visible, déjà vue, jamais vue. */
export const FOG_ALPHA = { visible: 0, seen: 0.5, unseen: 0.86 };
/** Couleur du voile (bleu nuit, proche du fond). */
const FOG_RGB = [14, 20, 46];
/** Vitesse de fondu de l'opacité (par seconde de jeu). */
const FADE_PER_SEC = 5;
/** Bordure (en cellules) autour de la cour, prolongeant le bord pour un lissage propre. */
const PAD = 1;

type MakeCanvas = (w: number, h: number) => SheetCanvas;

/** Calque de brouillard d'un monde, vu par une équipe. */
export class FogLayer {
  readonly canvas: SheetCanvas;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private alpha: Float32Array;
  private last = -Infinity;
  private readonly cw: number;
  private readonly ch: number;

  constructor(
    readonly world: World,
    readonly team: number,
    make: MakeCanvas,
  ) {
    this.cw = world.map.w + PAD * 2;
    this.ch = world.map.h + PAD * 2;
    this.canvas = make(this.cw, this.ch);
    this.ctx = (this.canvas as HTMLCanvasElement).getContext('2d')!;
    this.img = this.ctx.createImageData(this.cw, this.ch);
    this.alpha = new Float32Array(world.map.w * world.map.h).fill(FOG_ALPHA.unseen);
    const d = this.img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = FOG_RGB[0];
      d[i + 1] = FOG_RGB[1];
      d[i + 2] = FOG_RGB[2];
    }
  }

  /** Met le calque à jour (une fois par image au plus). Retourne faux sans brouillard. */
  sync(): boolean {
    const fog = fogFor(this.world, this.team);
    if (!fog) return false;
    const now = this.world.time;
    if (now === this.last) return true;
    const first = this.last === -Infinity;
    const dt = first ? 1 : Math.max(0, now - this.last);
    this.last = now;
    const k = first ? 1 : Math.min(1, dt * FADE_PER_SEC);
    const { w, h } = fog;
    const a = this.alpha;
    const d = this.img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const target = fog.visible[i] ? FOG_ALPHA.visible : fog.seen[i] ? FOG_ALPHA.seen : FOG_ALPHA.unseen;
        a[i] += (target - a[i]) * k;
      }
    }
    // Pixels : la bordure reprend la valeur de la cellule de bord la plus proche.
    const cw = this.cw;
    for (let py = 0; py < this.ch; py++) {
      const y = Math.min(h - 1, Math.max(0, py - PAD));
      for (let px = 0; px < cw; px++) {
        const x = Math.min(w - 1, Math.max(0, px - PAD));
        d[(py * cw + px) * 4 + 3] = Math.round(a[y * w + x] * 255);
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    return true;
  }

  /**
   * Étire le calque sur le losange de la cour, pour la projection
   * écran = (ox, oy) + échelle × gridToScreen(gx, gy).
   */
  drawAffine(ctx: CanvasRenderingContext2D, scale: number, ox: number, oy: number): void {
    const hw = (TILE_W / 2) * scale;
    const hh = (TILE_H / 2) * scale;
    ctx.save();
    // (gx, gy) → (ox + (gx − gy)·hw, oy + (gx + gy)·hh).
    ctx.transform(hw, hh, -hw, hh, ox, oy);
    ctx.imageSmoothingEnabled = true;
    // Seule la cour est couverte ; la bordure du calque sert au lissage des cellules du bord.
    ctx.drawImage(this.canvas as CanvasImageSource, PAD, PAD, this.world.map.w, this.world.map.h, 0, 0, this.world.map.w, this.world.map.h);
    ctx.restore();
  }

  /** Dessine le voile dans la vue de jeu. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const o = cam.gridToScreen(0, 0);
    this.drawAffine(ctx, cam.zoom, o.x, o.y);
  }
}

const layers = new WeakMap<World, FogLayer>();

function defaultCanvas(w: number, h: number): SheetCanvas {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Calque de brouillard (partagé entre la vue et la mini-carte) ; null sans l'option. */
export function fogLayer(world: World, team: number, make: MakeCanvas = defaultCanvas): FogLayer | null {
  if (!world.rules.fog) return null;
  let l = layers.get(world);
  if (!l || l.team !== team) {
    l = new FogLayer(world, team, make);
    layers.set(world, l);
  }
  l.sync();
  return l;
}

/** Voile de brouillard sur la vue de jeu (sans effet si l'option est inactive). */
export function drawFog(ctx: CanvasRenderingContext2D, world: World, cam: Camera, team: number, make?: MakeCanvas): void {
  fogLayer(world, team, make)?.draw(ctx, cam);
}

/** Voile de brouillard sur la mini-carte (écran = origine + échelle × gridToScreen). */
export function drawFogMini(ctx: CanvasRenderingContext2D, world: World, team: number, scale: number, ox: number, oy: number): void {
  fogLayer(world, team)?.drawAffine(ctx, scale, ox, oy);
}
