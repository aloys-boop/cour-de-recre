// @vitest-environment jsdom
/**
 * Ralliement par camp dans l'application complète (jsdom + canvas réel) : glisser depuis un
 * camp, bouton « Ralliement » du panneau (placer, supprimer), appui long sur le sol.
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

function pointer(type: string, x: number, y: number, id = 1): void {
  const canvas = document.getElementById('game')!;
  const Ctor = (globalThis as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const e = new Ctor(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  if (!('pointerId' in e)) Object.defineProperty(e, 'pointerId', { value: id });
  canvas.dispatchEvent(e);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ralliement par camp dans l’application', () => {
  it('glisser depuis le camp, bouton du panneau, appui long', async () => {
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
    const at = (x: number, y: number) => game.cam.gridToScreen(x, y);

    // Glisser depuis le camp jusqu'à un point de la carte : ralliement de ce camp.
    const a = at(home.cx + 0.6, home.cy + 0.6);
    const b = at(home.cx + 3, home.cy - 3);
    pointer('pointerdown', a.x, a.y + 4);
    pointer('pointermove', (a.x + b.x) / 2, (a.y + b.y) / 2);
    expect(game.rallyDrag).toBe(home);
    pointer('pointermove', b.x, b.y);
    pointer('pointerup', b.x, b.y);
    const r = game.world.rallyFor(home)!;
    expect(r).not.toBeNull();
    expect(Math.hypot(r.x - (home.cx + 3), r.y - (home.cy - 3))).toBeLessThan(0.3);
    expect(document.getElementById('hint')!.textContent).toMatch(/Point de ralliement posé/);

    // Panneau du camp : la ligne de ralliement est visible, « Supprimer » puis « Placer ».
    (document.getElementById('merit-pill') as HTMLButtonElement).click();
    expect(game.panelCamp).toBe(home);
    const panel = document.getElementById('camp-panel')!;
    const clear = panel.querySelector<HTMLButtonElement>('.rally-clear')!;
    const place = panel.querySelector<HTMLButtonElement>('.rally-place')!;
    expect(place.textContent).toBe('Déplacer');
    clear.click();
    expect(game.world.rallyFor(home)).toBeNull();
    expect(panel.querySelector('.rally-section .pion-status')!.textContent).toMatch(/restent au camp/);
    place.click();
    expect(game.placingRally).toBe(home);
    const c = at(home.cx + 2, home.cy - 1);
    pointer('pointerdown', c.x, c.y);
    pointer('pointerup', c.x, c.y);
    expect(game.placingRally).toBeNull();
    const r2 = game.world.rallyFor(home)!;
    expect(Math.hypot(r2.x - (home.cx + 2), r2.y - (home.cy - 1))).toBeLessThan(0.3);
    panel.querySelector<HTMLButtonElement>('.camp-close')!.click();
    expect(game.panelCamp).toBeNull();

    // Appui long sur le sol (sans sélection) : camp le plus proche, comme avant.
    const d = at(home.cx + 1.5, home.cy - 4);
    pointer('pointerdown', d.x, d.y);
    await wait(400);
    pointer('pointerup', d.x, d.y);
    const r3 = game.world.rallyFor(home)!;
    expect(Math.hypot(r3.x - (home.cx + 1.5), r3.y - (home.cy - 4))).toBeLessThan(0.3);
    advance(0.2);
  }, 20_000);
});
