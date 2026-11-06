// @vitest-environment jsdom
/**
 * v5.7 dans l'application complète (jsdom + canvas réel) : une case attaquée fait apparaître
 * le bandeau d'alerte ; le toucher emmène la caméra sur la case.
 */
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const backing = new WeakMap<HTMLCanvasElement, Canvas>();

beforeAll(() => {
  // Canvas réel derrière chaque <canvas> jsdom.
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let c = backing.get(this);
    const w = Math.max(1, this.width || 300);
    const h = Math.max(1, this.height || 150);
    if (!c) {
      c = createCanvas(w, h);
      backing.set(this, c);
    } else if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D & { __patched?: boolean };
    if (!ctx.__patched) {
      // Les <canvas> jsdom passés à drawImage/createPattern sont remplacés par leur canvas réel.
      const unwrap = (v: unknown) => (v instanceof HTMLCanvasElement ? (v.getContext('2d'), backing.get(v)) : v);
      const drawImage = ctx.drawImage;
      ctx.drawImage = ((...args: unknown[]) => (drawImage as Function).apply(ctx, [unwrap(args[0]), ...args.slice(1)])) as typeof ctx.drawImage;
      const createPattern = ctx.createPattern;
      ctx.createPattern = ((img: unknown, rep: string | null) => (createPattern as Function).call(ctx, unwrap(img), rep)) as typeof ctx.createPattern;
      ctx.__patched = true;
    }
    return ctx;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // Gabarit HTML de l'application.
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const app = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script'));
  document.body.innerHTML = app;
  Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 420, configurable: true });
});



describe('alertes dans l’application', () => {
  it('bandeau « Case attaquée », tap pour y aller, puis disparition', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', tutorialSeen: true }));
    const main = await import('../src/main');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.2);
    const banner = document.getElementById('alert-banner')!;
    expect(banner.classList.contains('hidden')).toBe(true);
    // Une case bonus au joueur, loin de son camp, et un intrus qui s'y installe.
    const tile = game.world.tiles.find((t) => t.kind === 'bonus')!;
    tile.owner = 0;
    const enemy = game.world.spawnUnit(1, tile.cx, tile.cy, false);
    enemy.order = { kind: 'move', target: { x: tile.cx, y: tile.cy } };
    advance(3);
    expect(banner.classList.contains('hidden')).toBe(false);
    expect(banner.textContent).toMatch(/attaquée/);
    expect(banner.getAttribute('aria-label')).toMatch(/Toucher pour y aller/);
    expect(game.lastAlert).toMatchObject({ x: tile.cx, y: tile.cy });
    banner.click();
    expect(banner.classList.contains('hidden')).toBe(true);
    advance(0.6);
    const p = game.cam.gridToScreen(tile.cx, tile.cy);
    expect(Math.abs(p.x - game.cam.viewW / 2)).toBeLessThan(40);
    expect(Math.abs(p.y - game.cam.viewH / 2)).toBeLessThan(40);
  });
});
