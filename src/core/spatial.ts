/**
 * Hash spatial uniforme : les unités sont rangées par cellule de taille `cell`,
 * ce qui permet des requêtes de voisinage en O(k) plutôt qu'en O(n).
 *
 * Sans allocation en régime établi (v5.25) : chaque cellule garde son tableau et un compteur.
 * Vider un tableau (`length = 0`) rend sa mémoire à V8, qui la réallouait au remplissage
 * suivant, soixante fois par seconde et pour chaque cellule ; on remet seulement le compteur
 * à zéro. Les clés de cellules restent de petits entiers (pas de nombre alloué par calcul).
 */
export interface HasPos {
  x: number;
  y: number;
}

interface Cell<T> {
  items: T[];
  n: number;
}

export class SpatialHash<T extends HasPos> {
  private cells = new Map<number, Cell<T>>();
  /** Cellules remplies depuis le dernier `clear`. */
  private used: Cell<T>[] = [];
  private usedN = 0;
  constructor(private cell = 1) {}

  private key(x: number, y: number): number {
    return cellKey(Math.floor(x / this.cell), Math.floor(y / this.cell));
  }

  clear(): void {
    const used = this.used;
    for (let i = 0; i < this.usedN; i++) used[i].n = 0;
    this.usedN = 0;
  }

  insert(item: T): void {
    const k = this.key(item.x, item.y);
    let c = this.cells.get(k);
    if (!c) {
      c = { items: [], n: 0 };
      this.cells.set(k, c);
    }
    if (c.n === 0) this.used[this.usedN++] = c;
    c.items[c.n++] = item;
  }

  /** Parcourt les candidats dans un rayon donné (filtrage grossier par cellule). */
  query(x: number, y: number, r: number, cb: (item: T) => void): void {
    const s = this.cell;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cells.get(cellKey(cx, cy));
        if (!c) continue;
        const items = c.items;
        for (let i = 0; i < c.n; i++) cb(items[i]);
      }
    }
  }

  /**
   * Même parcours que `query`, sans fonction de rappel : les candidats sont écrits au début de
   * `out`, dans le même ordre, et leur nombre est retourné (les cases suivantes de `out` sont
   * d'anciennes valeurs, à ignorer). Pour les boucles chaudes du monde (v5.25) : ni fermeture,
   * ni variable capturée, ni tableau réalloué.
   */
  near(x: number, y: number, r: number, out: T[]): number {
    const s = this.cell;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cells.get(cellKey(cx, cy));
        if (!c) continue;
        const items = c.items;
        for (let i = 0; i < c.n; i++) out[n++] = items[i];
      }
    }
    return n;
  }
}

/** Clé d'une cellule : décalage de 8 192 cellules dans chaque sens, produit sous 2^28 (petit entier). */
function cellKey(cx: number, cy: number): number {
  return (cx + 8192) * 16384 + (cy + 8192);
}
