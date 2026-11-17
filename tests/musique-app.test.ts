// @vitest-environment jsdom
/**
 * v5.18 dans l’application complète (jsdom + canvas réel) : thème du menu, thème de partie qui
 * s’intensifie avec une vraie bagarre, musique coupée dans la pause (mémorisée), fanfare de
 * victoire, retour au thème du menu.
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('musique dans l’application', () => {
  it('menu, bagarre qui monte, pause « Musique : Coupée », victoire, retour au menu', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    const music = main.__music();
    expect(music.theme).toBe('menu');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    expect(music.theme).toBe('partie');
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.5);
    expect(game.mood.level).toBeLessThan(0.1);

    // Une mêlée au centre de l'écran : l'intensité monte, et la musique la reçoit.
    const w = game.world;
    const cx = w.map.w / 2;
    const cy = w.map.h / 2;
    for (let i = 0; i < 5; i++) {
      w.spawnUnit(0, cx + (i % 3) * 0.3, cy + i * 0.25);
      w.spawnUnit(1, cx + 0.4 + (i % 3) * 0.3, cy + i * 0.25);
    }
    game.cam.centerOnGrid(cx, cy);
    let peak = 0;
    for (let i = 0; i < 60 * 8; i++) {
      advance(1 / 60);
      peak = Math.max(peak, game.mood.level);
    }
    expect(peak).toBeGreaterThan(0.4);
    expect(music.level).toBeCloseTo(game.mood.level, 6);

    // Pause : la rubrique « Sensations » coupe la musique, mémorisé ; la pause apaise la musique.
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    const off = document.querySelector('.music-toggle .tempo-opt[data-value="off"]') as HTMLButtonElement;
    const on = document.querySelector('.music-toggle .tempo-opt[data-value="on"]') as HTMLButtonElement;
    expect(on.classList.contains('on')).toBe(true);
    off.click();
    expect(music.isEnabled).toBe(false);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).musicMuted).toBe(true);
    on.click();
    expect(music.isEnabled).toBe(true);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).musicMuted).toBe(false);
    const before = game.mood.level;
    advance(3);
    expect(game.mood.level).toBeLessThan(before);
    game.setPaused(false);

    // Victoire : fanfare, puis le menu retrouve son thème.
    for (const u of w.units) if (u.team !== 0) (u.hp = 0), (u.state = 'ko');
    for (const t of w.tiles) if (t.isCamp) t.owner = 0;
    advance(0.3);
    expect(game.over).toBe(true);
    await wait(1000);
    expect(music.theme).toBe('victoire');
    const overlay = document.getElementById('overlay')!;
    [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((b) => /Menu/.test(b.textContent ?? ''))!.click();
    expect(music.theme).toBe('menu');
  }, 30000);
});
