// @vitest-environment jsdom
/**
 * v5.20 dans l’application complète : bouton « Motifs d’équipe » de l’accueil, mémorisé, qui
 * survit au rafraîchissement du menu et s’applique à la partie (cour et mini-carte).
 */
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const backing = new WeakMap<HTMLCanvasElement, Canvas>();

beforeAll(() => {
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
      const unwrap = (v: unknown) => (v instanceof HTMLCanvasElement ? (v.getContext('2d'), backing.get(v)) : v);
      const drawImage = ctx.drawImage;
      ctx.drawImage = ((...args: unknown[]) => (drawImage as Function).apply(ctx, [unwrap(args[0]), ...args.slice(1)])) as typeof ctx.drawImage;
      const createPattern = ctx.createPattern;
      ctx.createPattern = ((img: unknown, rep: string | null) => (createPattern as Function).call(ctx, unwrap(img), rep)) as typeof ctx.createPattern;
      ctx.__patched = true;
    }
    return ctx;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const app = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script'));
  document.body.innerHTML = app;
  Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 420, configurable: true });
});

describe('lisibilité b dans l’application', () => {
  it('« Motifs d’équipe » se règle dès l’accueil et s’applique à la partie', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    const btn = () => document.querySelector('#menu .btn-patterns') as HTMLButtonElement;
    expect(btn().textContent).toContain('masqués');
    expect(btn().getAttribute('aria-pressed')).toBe('false');
    btn().click();
    expect(btn().textContent).toContain('affichés');
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).patterns).toBe(true);
    // Le menu se redessine (choix d'une équipe) : le réglage reste affiché.
    (document.querySelectorAll('#menu .team-btn')[1] as HTMLButtonElement).click();
    expect(btn().textContent).toContain('affichés');
    expect(btn().getBoundingClientRect).toBeTypeOf('function');

    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    expect(game.patternsShown).toBe(true);
    expect((game as unknown as { minimap: { patterns: boolean } }).minimap.patterns).toBe(true);

    // Une mêlée serrée de deux équipes et une case prise : rendu sans erreur.
    const w = game.world;
    const camp = w.tiles.find((t) => t.isCamp && t.owner === 0)!;
    for (let i = 0; i < 6; i++) w.spawnUnit(i % 2, camp.cx + 0.15 * i, camp.cy + 0.1);
    const bonus = w.tiles.find((t) => !t.isCamp && t.suit)!;
    bonus.owner = 1;
    game.cam.centerOnGrid(camp.cx, camp.cy);
    let now = performance.now();
    expect(() => {
      for (let t = 0; t < 0.5; t += 1 / 60) game.frame((now += 1000 / 60));
    }).not.toThrow();

    // Masqués depuis la pause : cour et mini-carte suivent.
    game.setPatterns(false);
    expect((game as unknown as { minimap: { patterns: boolean } }).minimap.patterns).toBe(false);
  }, 30000);
});
