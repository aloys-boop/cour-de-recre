import type { WorldEvent } from '../core/world';
import type { Camera } from './camera';
import { COLORS } from './renderer';

/**
 * Effets de « ressenti » : tremblement d'écran et onomatopées pixel.
 * Pool fixe, aucune allocation lourde par image ; les mots sont pré-rendus une fois.
 */

const WORDS = ['Paf !', 'Bam !', 'Pif !', 'Aïe !', 'Boum !'] as const;
const W_PAF = 0;
const W_BAM = 1;
const W_PIF = 2;
const W_AIE = 3;
const W_BOUM = 4;
const WORD_COLORS = ['#ffe066', '#ff8a3d', '#ffffff', '#ff5a4a', '#ffd23f'];

const POOL = 12;
const POPUP_LIFE = 0.75;
/** Une onomatopée pour environ 1 coup sur 6 : lisible même dans une mêlée. */
const HIT_CHANCE = 1 / 6;
const MIN_GAP = 0.12;

interface Popup {
  active: boolean;
  word: number;
  x: number; // grille
  y: number;
  t: number;
  drift: number;
}

type WordSprite = { canvas: CanvasImageSource; w: number; h: number } | null;

export class Effects {
  /** Décalage courant de la vue (pixels CSS). */
  sx = 0;
  sy = 0;
  private shakeT = 0;
  private shakeDur = 0.15;
  private shakeAmp = 0;
  private sinceLast = 1;
  private popups: Popup[] = [];
  private sprites: WordSprite[] | null = null;
  private rand: () => number;

  constructor(rand: () => number = Math.random) {
    this.rand = rand;
    for (let i = 0; i < POOL; i++) this.popups.push({ active: false, word: 0, x: 0, y: 0, t: 0, drift: 0 });
  }

  get shaking(): boolean {
    return this.shakeT > 0;
  }

  /** Réagit à un événement du monde (à appeler pour chaque événement drainé). */
  onEvent(ev: WorldEvent, cam: Camera): void {
    switch (ev.kind) {
      case 'hit':
        if (this.rand() < HIT_CHANCE && this.visible(ev.x, ev.y, cam)) {
          const r = this.rand();
          this.spawn(r < 0.4 ? W_PAF : r < 0.75 ? W_BAM : W_PIF, ev.x, ev.y, false);
        }
        break;
      case 'ko':
        if (this.visible(ev.x, ev.y, cam)) {
          this.spawn(this.rand() < 0.7 ? W_AIE : W_BOUM, ev.x, ev.y, true);
          this.shake(2.5, 0.15);
        }
        break;
      case 'captured':
        if (ev.camp) this.shake(4, 0.18);
        break;
    }
  }

  update(dt: number): void {
    this.sinceLast += dt;
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const k = this.shakeT / this.shakeDur;
      const a = this.shakeAmp * k;
      this.sx = Math.round((this.rand() * 2 - 1) * a);
      this.sy = Math.round((this.rand() * 2 - 1) * a);
    } else {
      this.sx = this.sy = 0;
    }
    for (const p of this.popups) {
      if (!p.active) continue;
      p.t += dt;
      if (p.t >= POPUP_LIFE) p.active = false;
    }
  }

  /** Prépare le canvas pour l'image : transformation (avec tremblement) et fond si besoin. */
  begin(ctx: CanvasRenderingContext2D, dpr: number, pixelW: number, pixelH: number): void {
    if (this.sx !== 0 || this.sy !== 0) {
      // Le bord découvert par le décalage est repeint avec la couleur du vide.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = COLORS.void;
      ctx.fillRect(0, 0, pixelW, pixelH);
    }
    ctx.setTransform(dpr, 0, 0, dpr, this.sx * dpr, this.sy * dpr);
  }

  /** Dessine les onomatopées actives (après le rendu du monde). */
  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    let any = false;
    for (const p of this.popups) if (p.active) any = true;
    if (!any) return;
    const sprites = this.ensureSprites();
    if (!sprites) return;
    const z = cam.zoom;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    for (const p of this.popups) {
      if (!p.active) continue;
      const sp = sprites[p.word];
      if (!sp) continue;
      const k = p.t / POPUP_LIFE;
      const s = cam.gridToScreen(p.x, p.y);
      // Petit « pop » à l'apparition, puis montée et fondu.
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.4);
      const scale = Math.max(1, Math.round(2 * Math.max(0.7, z))) * pop;
      const w = sp.w * scale;
      const h = sp.h * scale;
      const x = s.x + p.drift * k * 14 * z - w / 2;
      const y = s.y - (46 + 26 * k) * z - h / 2;
      ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      ctx.drawImage(sp.canvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  // ---------------------------------------------------------------- interne

  private shake(amp: number, dur: number): void {
    if (reducedMotion()) return;
    // On ne relance pas un tremblement plus faible que celui en cours.
    if (this.shakeT > 0 && this.shakeAmp * (this.shakeT / this.shakeDur) >= amp) return;
    this.shakeAmp = amp;
    this.shakeDur = dur;
    this.shakeT = dur;
  }

  private spawn(word: number, x: number, y: number, force: boolean): void {
    if (!force && this.sinceLast < MIN_GAP) return;
    let slot: Popup | undefined;
    for (const p of this.popups) {
      if (!p.active) {
        slot = p;
        break;
      }
    }
    if (!slot) {
      if (!force) return;
      // Pool plein : on recycle la plus ancienne.
      slot = this.popups[0];
      for (const p of this.popups) if (p.t > slot.t) slot = p;
    }
    slot.active = true;
    slot.word = word;
    slot.x = x;
    slot.y = y;
    slot.t = 0;
    slot.drift = this.rand() * 2 - 1;
    this.sinceLast = 0;
  }

  private visible(x: number, y: number, cam: Camera): boolean {
    const p = cam.gridToScreen(x, y);
    const m = 30;
    return p.x > -m && p.y > -m && p.x < cam.viewW + m && p.y < cam.viewH + m;
  }

  /** Pré-rendu des mots en petite police, seuillé pour un rendu pixel net une fois agrandi. */
  private ensureSprites(): WordSprite[] | null {
    if (this.sprites) return this.sprites;
    this.sprites = WORDS.map((word, i) => renderWord(word, WORD_COLORS[i]));
    return this.sprites;
  }

  /** Nombre d'onomatopées actives (tests). */
  get activeCount(): number {
    let n = 0;
    for (const p of this.popups) if (p.active) n++;
    return n;
  }
}

function reducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function renderWord(word: string, color: string): WordSprite {
  try {
    if (typeof document === 'undefined') return null;
    const font = 'bold 10px "Trebuchet MS", Verdana, sans-serif';
    const c = document.createElement('canvas');
    let ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(word).width) || word.length * 6;
    const pad = 3;
    c.width = tw + pad * 2;
    c.height = 10 + pad * 2 + 2;
    ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e1e28';
    const cx = c.width / 2;
    const cy = c.height / 2;
    ctx.strokeText(word, cx, cy);
    ctx.fillStyle = color;
    ctx.fillText(word, cx, cy);
    // Seuillage de l'alpha : pixels francs, sans anticrénelage.
    try {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
      ctx.putImageData(img, 0, 0);
    } catch {
      /* lecture des pixels indisponible : on garde le rendu lissé */
    }
    return { canvas: c, w: c.width, h: c.height };
  } catch {
    return null;
  }
}
