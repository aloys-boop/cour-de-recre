/**
 * Hash spatial uniforme : les unités sont rangées par cellule de taille `cell`,
 * ce qui permet des requêtes de voisinage en O(k) plutôt qu'en O(n).
 */
export interface HasPos {
  x: number;
  y: number;
}

export class SpatialHash<T extends HasPos> {
  private cells = new Map<number, T[]>();
  /** Cellules remplies depuis le dernier `clear` (leurs tableaux sont vidés et réutilisés, sans allocation). */
  private used: T[][] = [];
  constructor(private cell = 1) {}

  private key(x: number, y: number): number {
    const cx = Math.floor(x / this.cell) + 32768;
    const cy = Math.floor(y / this.cell) + 32768;
    return cx * 65536 + cy;
  }

  clear(): void {
    for (const arr of this.used) arr.length = 0;
    this.used.length = 0;
  }

  insert(item: T): void {
    const k = this.key(item.x, item.y);
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    if (arr.length === 0) this.used.push(arr);
    arr.push(item);
  }

  /** Parcourt les candidats dans un rayon donné (filtrage grossier par cellule). */
  query(x: number, y: number, r: number, cb: (item: T) => void): void {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c);
    const x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c);
    const y1 = Math.floor((y + r) / c);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const arr = this.cells.get((cx + 32768) * 65536 + (cy + 32768));
        if (!arr || arr.length === 0) continue;
        for (let i = 0; i < arr.length; i++) cb(arr[i]);
      }
    }
  }
}
