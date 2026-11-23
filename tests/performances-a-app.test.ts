// @vitest-environment jsdom
/**
 * v5.24 dans l’application complète (jsdom + canvas réel) : le compteur d’images mesure chaque
 * image, « Compteur d’images » s’affiche ou se masque dans la pause, mémorisé, dessiné sans erreur.
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


describe('compteur d’images dans l’application', () => {
  it('mesure toujours, s’affiche depuis la pause, mémorisé', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    expect(game.meterVisible).toBe(false);
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(1);
    // Masqué, il mesure quand même : 60 images, environ 60 i/s, simulation et dessin chronométrés.
    const s = game.meter.stats();
    expect(s.frames).toBeGreaterThanOrEqual(55);
    expect(Math.round(s.fps)).toBe(60);
    expect(s.dropped).toBe(0);
    expect(s.render).toBeGreaterThan(0);

    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    expect(document.querySelector('.performance-block')?.textContent).toContain('Performances');
    const on = document.querySelector('.meter-toggle .tempo-opt[data-value="on"]') as HTMLButtonElement;
    const off = document.querySelector('.meter-toggle .tempo-opt[data-value="off"]') as HTMLButtonElement;
    expect(off.classList.contains('on')).toBe(true);
    on.click();
    expect(game.meterVisible).toBe(true);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).meter).toBe(true);
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    // Dessiné sans erreur, images sautées comprises (une image de 50 ms).
    advance(0.5);
    game.frame((now += 50));
    advance(0.6);
    expect(game.meter.stats().dropped).toBeGreaterThanOrEqual(2);

    // Partie suivante : le réglage est repris.
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    off.click();
    expect(game.meterVisible).toBe(false);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).meter).toBe(false);
  });
});
