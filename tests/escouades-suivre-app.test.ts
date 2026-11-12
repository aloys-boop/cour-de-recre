// @vitest-environment jsdom
/**
 * v5.13 dans l’application complète (jsdom + canvas réel) : bouton « Suivre » armé, protégé
 * désigné par un bouton de groupe puis par un tap sur un élève, écusson du groupe en escorte,
 * consigne levée au second toucher.
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

describe('consigne « Suivre » dans l’application', () => {
  it('armement, protégé par groupe ou par tap, écusson du groupe, puis consigne levée', async () => {
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
    const btn = document.getElementById('btn-follow') as HTMLButtonElement;
    const guard = document.getElementById('btn-guard') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    // « Suivre » partage la rangée de « Camp » et « Garder ».
    expect(btn.parentElement).toBe(guard.parentElement);
    // Sans sélection : rien n’est armé.
    btn.click();
    expect(game.followArmed).toBe(false);

    // Deux moitiés : la seconde devient le groupe 1 (le protégé), la première l’escorte.
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const all = [...game.selected];
    expect(all.length).toBeGreaterThanOrEqual(2);
    const half = Math.floor(all.length / 2);
    game.selected.clear();
    for (const id of all.slice(half)) game.selected.add(id);
    game.saveGroup(0);
    game.selected.clear();
    for (const id of all.slice(0, half)) game.selected.add(id);
    btn.click();
    expect(game.followArmed).toBe(true);
    await wait(300);
    expect(btn.classList.contains('armed')).toBe(true);
    const g1 = document.getElementById('btn-group-1')!;
    expect(g1.classList.contains('pick')).toBe(true);
    // Retoucher désarme, puis on réarme.
    btn.click();
    expect(game.followArmed).toBe(false);
    btn.click();
    // Toucher le groupe 1 : il devient le protégé, la sélection ne change pas.
    g1.dispatchEvent(new MouseEvent('click', { detail: 0 }));
    expect(game.followArmed).toBe(false);
    expect(game.selected.size).toBe(half);
    expect(game.selectionFollows).toBe(true);
    expect(game.escortLinks()).toHaveLength(1);
    game.saveGroup(1);
    advance(2); // le rendu de l’escorte ne plante pas
    await wait(300);
    expect(btn.classList.contains('on')).toBe(true);
    const g2 = document.getElementById('btn-group-2')!;
    expect(g2.classList.contains('following')).toBe(true);
    expect(g1.classList.contains('following')).toBe(false);
    // Le protégé part : l’escorte suit.
    const ward = all.slice(half).map((id) => game.world.unitById(id)!);
    const esc = all.slice(0, half).map((id) => game.world.unitById(id)!);
    const c = (us: { x: number; y: number }[]) => ({ x: us.reduce((s, u) => s + u.x, 0) / us.length, y: us.reduce((s, u) => s + u.y, 0) / us.length });
    const dest = { x: game.world.map.w / 2, y: game.world.map.h / 2 };
    game.world.orderMove(ward, dest);
    advance(10);
    const cw = c(ward.filter((u) => u.alive));
    const ce = c(esc.filter((u) => u.alive));
    expect(Math.hypot(cw.x - ce.x, cw.y - ce.y)).toBeLessThan(4);
    // Second toucher : consigne levée.
    btn.click();
    advance(0.3);
    await wait(300);
    expect(game.selectionFollows).toBe(false);
    expect(btn.classList.contains('on')).toBe(false);
    // Armé puis tap sur un élève du protégé à l’écran : nouvelle escorte.
    btn.click();
    const w0 = ward.find((u) => u.alive)!;
    game.cam.centerOnGrid(w0.x, w0.y);
    const p = game.cam.gridToScreen(w0.x, w0.y);
    (game as unknown as { tap(x: number, y: number): void }).tap(p.x, p.y - 20 * game.cam.zoom);
    expect(game.selectionFollows).toBe(true);
    expect(game.escortLinks()).toHaveLength(1);
  }, 30000);
});
