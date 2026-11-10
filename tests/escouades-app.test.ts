// @vitest-environment jsdom
/**
 * v5.11 dans l’application complète (jsdom + canvas réel) : bouton « Conquérir », drapeau sur le
 * groupe en conquête, escouade qui prend une case seule, consigne levée au second toucher.
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

describe('consigne « Conquérir » dans l’application', () => {
  it('bouton, drapeau du groupe, case prise seule, puis consigne levée', async () => {
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
    const btn = document.getElementById('btn-conquer') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    // Sans sélection : bouton éteint, rien ne se passe.
    btn.click();
    expect(game.world.squads.size).toBe(0);

    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const mine = game.selected.size;
    expect(mine).toBeGreaterThan(0);
    const before = game.world.tiles.filter((t) => t.owner === 0).length;
    btn.click();
    expect(game.world.squads.size).toBe(1);
    expect(game.selectionConquers).toBe(true);
    expect(game.conquestLinks()).toHaveLength(1);
    // Enregistrée dans le groupe 1 : le bouton porte le drapeau.
    game.saveGroup(0);
    advance(0.3);
    await wait(300); // le HUD des contrôles se rafraîchit 4 fois par seconde
    expect(btn.classList.contains('on')).toBe(true);
    expect(document.getElementById('btn-group-1')!.classList.contains('conquering')).toBe(true);
    // L’escouade prend au moins une case sans autre ordre.
    advance(15);
    expect(game.world.tiles.filter((t) => t.owner === 0).length).toBeGreaterThan(before);
    // Second toucher : consigne levée.
    (document.getElementById('btn-group-1') as HTMLButtonElement).click();
    btn.click();
    advance(0.3);
    await wait(300);
    expect(game.selectionConquers).toBe(false);
    expect(btn.classList.contains('on')).toBe(false);
    expect(document.getElementById('btn-group-1')!.classList.contains('conquering')).toBe(false);
  }, 30000);
});
