// @vitest-environment jsdom
/**
 * v5.14 dans l’application complète (jsdom + canvas réel) : pause tactique (cour figée, ordres
 * possibles), vitesse lente réglée dans la pause et mémorisée.
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


describe('rythme réglable dans l’application', () => {
  it('pause tactique : la cour se fige, les ordres passent, puis la vitesse lente', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.5);
    const btn = document.getElementById('btn-tactical') as HTMLButtonElement;
    const badge = document.getElementById('tactical-badge') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.classList.contains('hidden')).toBe(false);
    // Entre « Fuir / Charger » et le son.
    expect(btn.nextElementSibling?.id).toBe('btn-sound');

    btn.click();
    expect(game.tactical.active).toBe(true);
    expect(btn.classList.contains('on')).toBe(true);
    expect(badge.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('hud')!.classList.contains('tactical')).toBe(true);
    const t0 = game.world.time;
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const units = [...game.selected].map((id) => game.world.unitById(id)!);
    expect(units.length).toBeGreaterThan(0);
    const pos = units.map((u) => ({ x: u.x, y: u.y }));
    // Ordre donné pendant la pause : enregistré, mais personne ne bouge.
    const dest = { x: game.world.map.w / 2, y: game.world.map.h / 2 };
    game.cam.centerOnGrid(dest.x, dest.y);
    const q = game.cam.gridToScreen(dest.x, dest.y);
    (game as unknown as { tap(x: number, y: number): void }).tap(q.x, q.y);
    advance(3);
    expect(game.world.time).toBe(t0);
    units.forEach((u, i) => expect(u.x === pos[i].x && u.y === pos[i].y).toBe(true));
    expect(units.some((u) => u.order.kind !== 'none')).toBe(true);
    expect(game.tactical.realSeconds).toBeGreaterThan(2.5);
    // Le bandeau relance la partie : l’ordre s’exécute.
    badge.click();
    expect(game.tactical.active).toBe(false);
    expect(badge.classList.contains('hidden')).toBe(true);
    advance(2);
    expect(game.world.time).toBeGreaterThan(t0 + 1.5);
    expect(units.some((u, i) => u.x !== pos[i].x || u.y !== pos[i].y)).toBe(true);

    // Vitesse lente choisie dans la pause : 0,75 s de jeu par seconde, mémorisée.
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    expect(game.paused).toBe(true);
    // Pas de pause tactique quand la partie est en pause.
    expect(game.setTactical(true)).toBe(false);
    const slow = document.querySelector('.tempo-speed .tempo-opt[data-value="lente"]') as HTMLButtonElement;
    expect(slow).not.toBeNull();
    slow.click();
    expect(slow.classList.contains('on')).toBe(true);
    expect(game.speed).toBe(0.75);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).speed).toBe('lente');
    // Bouton masqué depuis la pause.
    (document.querySelector('.tempo-button .tempo-opt[data-value="off"]') as HTMLButtonElement).click();
    expect(btn.classList.contains('hidden')).toBe(true);
    (document.querySelector('.tempo-button .tempo-opt[data-value="on"]') as HTMLButtonElement).click();
    expect(btn.classList.contains('hidden')).toBe(false);
    game.setPaused(false);
    const t1 = game.world.time;
    advance(4);
    expect(game.world.time - t1).toBeGreaterThan(2.8);
    expect(game.world.time - t1).toBeLessThan(3.2);
  }, 30000);
});
