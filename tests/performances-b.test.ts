/** v5.25, saison 2 « Performances b » : voisinage sans allocation, fonds de cases en cache, barres groupées. */
import { describe, expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { SpatialHash } from '../src/core/spatial';
import { generateMap, LEVELS } from '../src/core/maps';
import { World } from '../src/core/world';
import { TileImages } from '../src/render/tile-images';
import { barBand, Renderer } from '../src/render/renderer';
import { Camera } from '../src/render/camera';
import { unitVisible } from '../src/core/fog';

const makeCanvas = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;

describe('hash spatial : near()', () => {
  it('mêmes candidats, dans le même ordre, que query()', () => {
    const h = new SpatialHash<{ x: number; y: number; id: number }>(1);
    const pts = Array.from({ length: 200 }, (_, i) => ({ x: ((i * 37) % 41) - 20.5, y: ((i * 53) % 43) - 21.3, id: i }));
    for (const p of pts) h.insert(p);
    const out: typeof pts = [];
    for (const [x, y, r] of [[0, 0, 3], [-20, -20, 2.5], [15.2, -7.7, 6], [100, 100, 1]] as const) {
      const viaQuery: number[] = [];
      h.query(x, y, r, (p) => viaQuery.push(p.id));
      const n = h.near(x, y, r, out);
      expect(out.slice(0, n).map((p) => p.id)).toEqual(viaQuery);
    }
  });

  it('écrit au début du tableau fourni et compte, sans le réallouer', () => {
    const h = new SpatialHash<{ x: number; y: number }>(1);
    const p = { x: 0.5, y: 0.5 };
    h.insert(p);
    const out = [{ x: 9, y: 9 }, { x: 8, y: 8 }];
    expect(h.near(0.5, 0.5, 0.4, out)).toBe(1);
    expect(out[0]).toBe(p);
    expect(out).toHaveLength(2);
    h.clear();
    expect(h.near(0.5, 0.5, 0.4, out)).toBe(0);
    // Après clear, la cellule resservie ne rend que les nouveaux occupants.
    const q = { x: 0.6, y: 0.6 };
    h.insert(q);
    expect(h.near(0.5, 0.5, 0.4, out)).toBe(1);
    expect(out[0]).toBe(q);
  });

  it('coordonnées négatives et lointaines : cellules distinctes', () => {
    const h = new SpatialHash<{ x: number; y: number }>(1);
    const a = { x: -3000.5, y: 4000.5 };
    const b = { x: 4000.5, y: -3000.5 };
    h.insert(a);
    h.insert(b);
    const out: Array<{ x: number; y: number }> = [];
    expect(h.near(a.x, a.y, 0.4, out)).toBe(1);
    expect(out[0]).toBe(a);
    expect(h.near(b.x, b.y, 0.4, out)).toBe(1);
    expect(out[0]).toBe(b);
  });
});

/** Contexte factice : transformation de l'écran ×2, compte des copies d'image. */
function fakeCtx(transform = true) {
  const images: Array<[number, number, number, number]> = [];
  const ctx = {
    getTransform: transform ? () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }) : undefined,
    drawImage: (_img: unknown, x: number, y: number, w: number, h: number) => images.push([x, y, w, h]),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, images };
}

describe('fonds de cases en cache', () => {
  const world = new World(generateMap(LEVELS[0], 3), 2, 3);
  const tile = world.tiles.find((t) => !t.isCamp)!;
  let painted = 0;
  const paint = (g: CanvasRenderingContext2D) => {
    painted++;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 10, 10);
  };

  it('pendant que le zoom change : dessin direct ; zoom stable : une image par combinaison', () => {
    const { ctx, images } = fakeCtx();
    const cache = new TileImages(ctx, makeCanvas as never);
    painted = 0;
    cache.begin(1.3); // premier zoom vu : pas encore stable
    expect(cache.draw(tile, 2, false, 100, 50, paint)).toBe(false);
    cache.begin(1.3);
    expect(cache.draw(tile, 2, false, 100, 50, paint)).toBe(true);
    expect(cache.draw(tile, 2, false, 300, 80, paint)).toBe(true);
    expect(painted).toBe(1);
    expect(cache.draw(tile, 3, false, 100, 50, paint)).toBe(true); // autre propriétaire
    expect(cache.draw(tile, 3, true, 100, 50, paint)).toBe(true); // motifs
    expect(painted).toBe(3);
    expect(cache.built).toBe(3);
    expect(images).toHaveLength(4);
    cache.begin(1.6); // pincement en cours
    expect(cache.draw(tile, 2, false, 100, 50, paint)).toBe(false);
    cache.begin(1.6); // stabilisé : cache refait
    expect(cache.draw(tile, 2, false, 100, 50, paint)).toBe(true);
    expect(painted).toBe(4);
  });

  it('image calée sur les pixels de l’appareil, à sa taille exacte', () => {
    const { ctx, images } = fakeCtx();
    const cache = new TileImages(ctx, makeCanvas as never);
    cache.begin(1);
    cache.begin(1);
    cache.draw(tile, 2, false, 100.37, 50.81, paint);
    const [x, y, w, h] = images[0];
    for (const v of [x, y, w, h]) expect(Number.isInteger(v * 2)).toBe(true);
    // Centre de la case à moins d'un demi-pixel de l'appareil de la position voulue.
    expect(Math.abs(x + w / 2 - 100.37)).toBeLessThan(0.76);
    expect(Math.abs(y + h / 2 - 50.81)).toBeLessThan(0.76);
  });

  it('contexte sans transformation lisible : jamais de cache', () => {
    const { ctx } = fakeCtx(false);
    const cache = new TileImages(ctx, makeCanvas as never);
    cache.begin(1);
    cache.begin(1);
    expect(cache.draw(tile, 2, false, 0, 0, paint)).toBe(false);
  });
});

describe('dessin de la cour (v5.25)', () => {
  function setup() {
    const map = generateMap(LEVELS[5], 55);
    const world = new World({ ...map, startUnits: 20 }, 8, 55);
    const cv = createCanvas(844 * 2, 390 * 2);
    const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
    const r = new Renderer(ctx, makeCanvas as never);
    const cam = new Camera();
    cam.setMap(map.w, map.h);
    cam.setView(844, 390);
    cam.fit();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const opts = { selected: new Set<number>(), markers: [], box: null, playerTeam: 0, time: 1 };
    return { world, ctx, r, cam, opts };
  }

  it('les fonds de cases se construisent une fois, puis sont recopiés', () => {
    const { world, r, cam, opts } = setup();
    r.draw(world, cam, opts);
    expect(r.tileImages.built).toBe(0); // premier zoom : dessin direct
    r.draw(world, cam, opts);
    const built = r.tileImages.built;
    expect(built).toBeGreaterThan(3);
    // Bien moins d'images que de cases : les cases semblables partagent la leur.
    expect(built).toBeLessThan(world.tiles.length + 1);
    for (let i = 0; i < 3; i++) r.draw(world, cam, opts);
    expect(r.tileImages.built).toBe(built);
  });

  it('barres de vie : groupées en quelques remplissages, toutes au-dessus des élèves', () => {
    const { world, ctx, r, cam, opts } = setup();
    r.draw(world, cam, opts);
    r.draw(world, cam, opts);
    const mine = world.units.filter((u) => {
      const p = cam.gridToScreen(u.x, u.y);
      return unitVisible(world, 0, u) && p.x > 0 && p.y > 0 && p.x < cam.viewW && p.y < cam.viewH;
    });
    mine[3].hp = mine[3].maxHp * 0.4; // une barre jaune
    mine[4].hp = mine[4].maxHp * 0.1; // une rouge
    const calls: string[] = [];
    const c = ctx as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const k of ['fill', 'drawImage', 'rect']) {
      const f = c[k].bind(ctx);
      c[k] = (...a: unknown[]) => {
        calls.push(k === 'fill' ? 'fill ' + String((ctx as unknown as { fillStyle: string }).fillStyle).toLowerCase() : k);
        return f(...a);
      };
    }
    r.draw(world, cam, opts);
    const firstRect = calls.indexOf('rect');
    // Un seul remplissage par couleur de barre pour toute la cour.
    for (const color of ['#3ee05a', '#f2c22e', '#e5453c']) expect(calls.filter((k) => k === 'fill ' + color)).toHaveLength(1);
    // Les barres viennent après tous les corps (ombre + élève : au moins deux copies d'image par barre).
    const bars = calls.slice(firstRect, calls.indexOf('fill ' + '#3ee05a')).filter((k) => k === 'rect').length / 2;
    expect(bars).toBeGreaterThan(20);
    expect(calls.slice(0, firstRect).filter((k) => k === 'drawImage').length).toBeGreaterThanOrEqual(bars * 2);
    expect(calls.indexOf('fill #3ee05a')).toBeGreaterThan(firstRect);
  });

  it('tranches de couleur des barres : inchangées', () => {
    expect(barBand(1)).toBe(0);
    expect(barBand(0.51)).toBe(0);
    expect(barBand(0.5)).toBe(1);
    expect(barBand(0.26)).toBe(1);
    expect(barBand(0.25)).toBe(2);
    expect(barBand(0.01)).toBe(2);
  });
});
