// @vitest-environment jsdom
/**
 * v5.12 dans l’application complète (jsdom + canvas réel) : bouton « Défendre », bouclier sur le
 * groupe en défense, passage de la conquête à la défense, consigne levée au second toucher.
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

describe('consigne « Défendre » dans l’application', () => {
  it('bouton, bouclier du groupe, secteur dessiné, passage depuis la conquête, puis consigne levée', async () => {
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
    const btn = document.getElementById('btn-defend') as HTMLButtonElement;
    const conquer = document.getElementById('btn-conquer') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    // Les deux consignes d’escouade partagent une rangée.
    expect(btn.parentElement).toBe(conquer.parentElement);
    // Sans sélection : rien.
    btn.click();
    expect(game.world.squads.size).toBe(0);

    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    expect(game.selected.size).toBeGreaterThan(0);
    // D’abord en conquête, puis « Défendre » : la même sélection change de consigne.
    conquer.click();
    expect(game.selectionConquers).toBe(true);
    btn.click();
    expect(game.selectionConquers).toBe(false);
    expect(game.selectionDefends).toBe(true);
    const views = game.defenceViews();
    expect(views).toHaveLength(1);
    expect(views[0].zone.length).toBeGreaterThan(0);
    expect(views[0].post).not.toBeNull();
    expect(game.conquestLinks()).toHaveLength(0);
    game.saveGroup(0);
    advance(2); // le rendu du secteur ne plante pas
    await wait(300);
    expect(btn.classList.contains('on')).toBe(true);
    expect(conquer.classList.contains('on')).toBe(false);
    const g1 = document.getElementById('btn-group-1')!;
    expect(g1.classList.contains('defending')).toBe(true);
    expect(g1.classList.contains('conquering')).toBe(false);
    // L’escouade reste sur son secteur.
    advance(6);
    const post = game.defenceViews()[0].post!;
    const mine = [...game.selected].map((id) => game.world.unitById(id)!).filter((u) => u && u.alive);
    expect(mine.every((u) => Math.hypot(u.x - post.cx, u.y - post.cy) < 5)).toBe(true);
    // Second toucher : consigne levée.
    btn.click();
    advance(0.3);
    await wait(300);
    expect(game.selectionDefends).toBe(false);
    expect(btn.classList.contains('on')).toBe(false);
    expect(g1.classList.contains('defending')).toBe(false);
  }, 30000);
});
