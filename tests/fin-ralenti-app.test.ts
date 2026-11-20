// @vitest-environment jsdom
/** Fin de partie au ralenti (v5.21) dans jsdom, avec un canvas réel. */
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import type { Sfx } from '../src/audio/sfx';
import { generateMap } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';

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


const sfx = { play: () => undefined, unlock: () => undefined } as unknown as Sfx;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function newGame(onEnd: (r: string) => void): Game {
  const map = generateMap(skirmishLevel({ teams: 2, size: 1, tiles: 10 }), 77);
  const game = new Game(
    document.getElementById('game') as HTMLCanvasElement,
    document.getElementById('minimap') as HTMLCanvasElement,
    sfx,
    { map, mapIndex: -1, playerColor: 3, difficulty: 'normal', seed: 77 },
    { onEnd, onPauseChange: () => undefined, onHud: () => undefined },
  );
  game.stop();
  return game;
}

/** Les adversaires tombent tous ; le dernier KO a lieu en (x, y). */
function finishOff(game: Game): { x: number; y: number } {
  const w = game.world;
  const victims = w.units.filter((u) => u.team !== 0 && u.alive);
  const last = victims[victims.length - 1];
  const at = { x: last.x, y: last.y };
  for (const u of victims) (u.hp = 0), (u.state = 'ko');
  for (const t of w.tiles) if (t.isCamp) t.owner = 0;
  w.events.push({ kind: 'ko', x: at.x, y: at.y, team: 1, by: 0 });
  return at;
}

describe('fin de partie au ralenti (v5.21)', () => {
  it('la caméra glisse et zoome vers le dernier coup, le temps ralentit, un tap ouvre l’écran de fin', () => {
    const ended: string[] = [];
    const game = newGame((r) => ended.push(r));
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.5);
    const z0 = game.cam.zoom;
    const at = finishOff(game);
    advance(1 / 30);
    expect(game.over).toBe(true);
    expect(game.ending).not.toBeNull();
    expect(game.finalBlow).toMatchObject({ kind: 'ko', team: 1, by: 0 });
    expect(game.finalBlow!.x).toBeCloseTo(at.x);
    const endTime = game.endTime;
    expect(endTime).toBeGreaterThan(0);
    // Ralenti : 0,6 s réelles = environ 0,12 s de jeu, et la cour vit encore.
    const t0 = game.world.time;
    advance(0.6);
    const played = game.world.time - t0;
    expect(played).toBeGreaterThan(0.06);
    expect(played).toBeLessThan(0.2);
    expect(game.endTime).toBe(endTime);
    expect(ended).toEqual([]);
    // Caméra centrée sur le coup, plus près.
    expect(game.cam.zoom).toBeGreaterThan(z0 * 1.15);
    const p = game.cam.gridToScreen(at.x, at.y);
    expect(Math.abs(p.x - game.cam.viewW / 2)).toBeLessThan(game.cam.viewW * 0.2);
    expect(Math.abs(p.y - game.cam.viewH / 2)).toBeLessThan(game.cam.viewH * 0.25);
    // Un tap ouvre tout de suite l'écran de fin, une seule fois.
    (game as unknown as { tap(x: number, y: number): void }).tap(100, 100);
    expect(ended).toEqual(['victoire']);
    game.finishEnding();
    advance(0.5);
    expect(ended).toEqual(['victoire']);
    game.destroy();
  });

  it('sans images ni tap, l’écran de fin s’ouvre quand même après le ralenti', async () => {
    const ended: string[] = [];
    const game = newGame((r) => ended.push(r));
    let now = performance.now();
    for (let t = 0; t < 0.3; t += 1 / 60) game.frame((now += 1000 / 60));
    for (const u of game.world.units) if (u.team === 0) (u.hp = 0), (u.state = 'ko');
    for (const t of game.world.tiles) if (t.isCamp) t.owner = 1;
    game.frame((now += 1000 / 60));
    game.frame((now += 1000 / 60));
    expect(game.over).toBe(true);
    await wait(1000);
    expect(ended).toEqual([]);
    await wait(1000);
    expect(ended).toEqual(['defaite']);
    game.destroy();
  });

  it('l’abandon ouvre l’écran de fin sans ralenti', () => {
    const ended: string[] = [];
    const game = newGame((r) => ended.push(r));
    game.surrender();
    expect(ended).toEqual(['abandon']);
    expect(game.ending).toBeNull();
    game.destroy();
  });
});
