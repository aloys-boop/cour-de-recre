import type { Vec2 } from './types';

/** Grille de navigation : chaque cellule est franchissable ou non. */
export class Grid {
  readonly w: number;
  readonly h: number;
  private blocked: Uint8Array;

  constructor(w: number, h: number, obstacles: Vec2[] = []) {
    this.w = w;
    this.h = h;
    this.blocked = new Uint8Array(w * h);
    for (const o of obstacles) this.setBlocked(o.x, o.y, true);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.blocked[y * this.w + x] === 1;
  }

  setBlocked(x: number, y: number, v: boolean): void {
    if (this.inBounds(x, y)) this.blocked[y * this.w + x] = v ? 1 : 0;
  }

  /** Une position continue est-elle franchissable (bords de la cour compris) ? */
  walkable(px: number, py: number): boolean {
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return false;
    return !this.isBlocked(Math.floor(px), Math.floor(py));
  }

  /** Ramène une position continue dans la cour. */
  clampPos(p: Vec2, margin = 0.2): Vec2 {
    return {
      x: Math.min(this.w - margin, Math.max(margin, p.x)),
      y: Math.min(this.h - margin, Math.max(margin, p.y)),
    };
  }

  /** Cellule libre la plus proche (recherche en anneaux). */
  nearestFree(x: number, y: number): Vec2 {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (!this.isBlocked(cx, cy)) return { x: cx, y: cy };
    for (let r = 1; r < Math.max(this.w, this.h); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (!this.isBlocked(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return { x: 0, y: 0 };
  }
}
