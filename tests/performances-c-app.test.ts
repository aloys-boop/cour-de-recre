// @vitest-environment jsdom
/**
 * v5.26 dans l’application complète (jsdom + canvas réel) : des saccades durables allègent la
 * partie (effets, puis image ×1,5), une ligne l’annonce la première fois, la pause montre l’état
 * et « Allègement auto » se coupe, mémorisé ; en pause, rien n’est jugé.
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
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
});



describe('garde-fou de fluidité dans l’application', () => {
  it('saccades → effets allégés puis image ×1,5 ; « Allègement auto » coupé → tout revient', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    expect(game.autoQuality).toBe(true);
    expect(game.qualityLevel).toBe(0);
    expect(game.pixelRatio).toBe(2);
    const canvas = document.getElementById('game') as HTMLCanvasElement | null;
    let now = performance.now();
    // Une image sur quatre arrive en retard (50 ms) : un tiers d'images sautées.
    const jank = (s: number) => {
      for (let t = 0; t < s; t += 0.1) {
        for (let k = 0; k < 3; k++) game.frame((now += 1000 / 60));
        game.frame((now += 50));
      }
    };
    // En pause, les saccades (menu ouvert) ne comptent pas.
    game.setPaused(true);
    jank(6);
    expect(game.qualityLevel).toBe(0);
    game.setPaused(false);
    jank(3);
    expect(game.qualityLevel).toBe(1);
    expect(document.getElementById('hint')?.textContent).toBe('Fluidité\u00a0: effets allégés'.replace('\u00a0', ' '));
    jank(6);
    expect(game.qualityLevel).toBe(2);
    expect(game.pixelRatio).toBe(1.5);
    if (canvas) expect(canvas.width).toBe(Math.round((canvas.clientWidth || 900) * 1.5));

    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    expect(document.querySelector('.quality-state')?.textContent).toContain('effets allégés, image ×1,5');
    const off = document.querySelector('.quality-toggle .tempo-opt[data-value="off"]') as HTMLButtonElement;
    expect((document.querySelector('.quality-toggle .tempo-opt[data-value="on"]') as HTMLElement).classList.contains('on')).toBe(true);
    off.click();
    expect(game.autoQuality).toBe(false);
    expect(game.qualityLevel).toBe(0);
    expect(game.pixelRatio).toBe(2);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).autoQuality).toBe(false);
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    // Coupé : les saccades n'allègent plus rien.
    jank(8);
    expect(game.qualityLevel).toBe(0);
  });
});
