// @vitest-environment jsdom
/**
 * v5.8 dans l’application complète (jsdom + canvas réel) : interrupteur « Auto » des renforts
 * dans le panneau du camp, « Partout », état affiché et pointillé dessiné.
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

describe('renforts automatiques dans l’application', () => {
  it('« Auto » dans le panneau du camp, état, « Partout », puis coupure', async () => {
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
    const home = game.world.tiles.find((t) => t.isCamp && t.owner === 0)!;

    (document.getElementById('merit-pill') as HTMLButtonElement).click();
    expect(game.panelCamp).toBe(home);
    const panel = document.getElementById('camp-panel')!;
    const toggle = panel.querySelector<HTMLButtonElement>('.reinforce-toggle')!;
    const all = panel.querySelector<HTMLButtonElement>('.reinforce-all')!;
    const status = panel.querySelector<HTMLElement>('.reinforce-section .pion-status')!;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(status.textContent).toMatch(/Coupés/);

    toggle.click();
    expect(game.world.reinforceOn(home)).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.classList.contains('on')).toBe(true);
    expect(document.getElementById('hint')!.textContent).toMatch(/Renforts automatiques/);
    // Un seul camp au départ : « Partout » n'a plus rien à faire.
    expect(all.disabled).toBe(true);

    // Une case du joueur attaquée : le camp la vise, l'état et le pointillé suivent.
    const bonus = game.world.tiles.filter((t) => t.kind === 'bonus').sort((a, b) => Math.hypot(a.cx - home.cx, a.cy - home.cy) - Math.hypot(b.cx - home.cx, b.cy - home.cy))[0];
    bonus.owner = 0;
    const foe = game.world.spawnUnit(1, bonus.cx + 1, bonus.cy, false);
    foe.frozenUntil = 1e9;
    advance(0.7);
    expect(game.world.reinforceTargetOf(home)).toBe(bonus);
    expect(game.reinforceLinks()).toEqual([{ from: home, to: bonus }]);
    expect(status.textContent).toMatch(/En route vers la case/);

    toggle.click();
    expect(game.world.reinforceOn(home)).toBe(false);
    expect(game.reinforceLinks()).toEqual([]);
    expect(status.textContent).toMatch(/Coupés/);
    advance(0.2);
  }, 20_000);
});
