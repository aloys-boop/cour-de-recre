/**
 * Gestion des gestes tactiles (et souris) sur le canvas :
 *  - tap court : sélection / ordre ;
 *  - glissé à un doigt : déplacement de la caméra ;
 *  - appui long puis glissé : rectangle de sélection ;
 *  - deux doigts : pincer pour zoomer, glisser pour déplacer ;
 *  - molette : zoom (ordinateur).
 */
export interface TouchCallbacks {
  onTap(x: number, y: number): void;
  onBoxStart(x: number, y: number): void;
  onBoxMove(x0: number, y0: number, x1: number, y1: number): void;
  onBoxEnd(x0: number, y0: number, x1: number, y1: number): void;
  onPan(dx: number, dy: number): void;
  onPinch(factor: number, cx: number, cy: number): void;
  /** Appui long sans bouger puis relâché (sinon, le rectangle de sélection est utilisé). */
  onLongPress?(x: number, y: number): void;
}

interface P {
  x: number;
  y: number;
  sx: number;
  sy: number;
}

const TAP_MAX_MS = 320;
const TAP_MAX_DIST = 10;
const LONG_PRESS_MS = 340;

export class TouchInput {
  private pointers = new Map<number, P>();
  private mode: 'none' | 'pan' | 'box' | 'pinch' | 'dead' = 'none';
  private downTime = 0;
  private longTimer: number | null = null;
  private boxStart = { x: 0, y: 0 };
  private lastMid = { x: 0, y: 0 };
  private lastDist = 0;
  private ac = new AbortController();

  constructor(
    private el: HTMLElement,
    private cb: TouchCallbacks,
  ) {
    el.style.touchAction = 'none';
    const s = this.ac.signal;
    el.addEventListener('pointerdown', this.onDown, { signal: s });
    el.addEventListener('pointermove', this.onMove, { signal: s });
    el.addEventListener('pointerup', this.onUp, { signal: s });
    el.addEventListener('pointercancel', this.onUp, { signal: s });
    el.addEventListener('contextmenu', (e) => e.preventDefault(), { signal: s });
    el.addEventListener('wheel', this.onWheel, { passive: false, signal: s });
    // Safari : on coupe les gestes natifs (double-tap zoom, pincement de page).
    const block = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', block, { passive: false, signal: s });
    el.addEventListener('touchmove', block, { passive: false, signal: s });
    el.addEventListener('gesturestart', block, { signal: s });
  }

  destroy(): void {
    this.clearLong();
    this.ac.abort();
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private clearLong(): void {
    if (this.longTimer !== null) {
      clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y });
    if (this.pointers.size === 1) {
      this.mode = 'none';
      this.downTime = performance.now();
      this.clearLong();
      this.longTimer = window.setTimeout(() => {
        this.longTimer = null;
        if (this.mode === 'none' && this.pointers.size === 1) {
          this.mode = 'box';
          this.boxStart = { x: p.x, y: p.y };
          navigator.vibrate?.(12);
          this.cb.onBoxStart(p.x, p.y);
        }
      }, LONG_PRESS_MS);
    } else if (this.pointers.size === 2) {
      this.clearLong();
      this.mode = 'pinch';
      const [a, b] = [...this.pointers.values()];
      this.lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.lastDist = Math.hypot(a.x - b.x, a.y - b.y);
    } else {
      this.clearLong();
      this.mode = 'dead';
    }
  };

  private onMove = (e: PointerEvent): void => {
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    const p = this.local(e);
    const prevX = rec.x;
    const prevY = rec.y;
    rec.x = p.x;
    rec.y = p.y;

    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastDist > 0 && d > 0) this.cb.onPinch(d / this.lastDist, mid.x, mid.y);
      this.cb.onPan(mid.x - this.lastMid.x, mid.y - this.lastMid.y);
      this.lastMid = mid;
      this.lastDist = d;
      return;
    }
    if (this.mode === 'box') {
      this.cb.onBoxMove(this.boxStart.x, this.boxStart.y, p.x, p.y);
      return;
    }
    if (this.mode === 'none') {
      const moved = Math.hypot(p.x - rec.sx, p.y - rec.sy);
      if (moved > TAP_MAX_DIST) {
        this.clearLong();
        this.mode = 'pan';
      }
    }
    if (this.mode === 'pan') this.cb.onPan(p.x - prevX, p.y - prevY);
  };

  private onUp = (e: PointerEvent): void => {
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    this.pointers.delete(e.pointerId);
    this.el.releasePointerCapture?.(e.pointerId);
    const p = this.local(e);
    if (this.mode === 'box') {
      if (this.cb.onLongPress && Math.hypot(p.x - this.boxStart.x, p.y - this.boxStart.y) <= TAP_MAX_DIST) this.cb.onLongPress(p.x, p.y);
      else this.cb.onBoxEnd(this.boxStart.x, this.boxStart.y, p.x, p.y);
      this.mode = 'dead';
    } else if (this.mode === 'none') {
      this.clearLong();
      const dt = performance.now() - this.downTime;
      const moved = Math.hypot(p.x - rec.sx, p.y - rec.sy);
      if (dt < TAP_MAX_MS && moved <= TAP_MAX_DIST) this.cb.onTap(p.x, p.y);
      this.mode = 'dead';
    } else if (this.mode === 'pinch') {
      // Il reste un doigt : on continue en déplacement simple, sans tap possible.
      this.mode = 'dead';
      if (this.pointers.size === 1) this.mode = 'pan';
    }
    if (this.pointers.size === 0) {
      this.clearLong();
      this.mode = 'none';
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = { x: e.offsetX, y: e.offsetY };
    const f = Math.exp(-e.deltaY * 0.0015);
    this.cb.onPinch(f, p.x, p.y);
  };
}
