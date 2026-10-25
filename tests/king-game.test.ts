// @vitest-environment jsdom
/** Partie complète en mode Roi de la cour dans jsdom, avec un canvas réel (rendu, mini-carte, HUD). */
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import type { Sfx } from '../src/audio/sfx';
import { KING, withThrone } from '../src/core/king';
import { generateMap } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';
import { KingHud } from '../src/ui/king-hud';

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

describe('mode Roi de la cour : partie complète (rendu compris)', () => {
  it('trône au centre, annonces, HUD, mini-carte et victoire à 2 minutes de règne', () => {
    const map = generateMap(skirmishLevel({ teams: 4, size: 1, tiles: 18 }), 321);
    const announces: string[] = [];
    let ended: string | null = null;
    const hud = new KingHud(document.getElementById('hud')!);
    const game = new Game(
      document.getElementById('game') as HTMLCanvasElement,
      document.getElementById('minimap') as HTMLCanvasElement,
      sfx,
      { map, mapIndex: -1, playerColor: 1, difficulty: 'normal', seed: 321, rules: { mode: 'roi' } },
      {
        onEnd: (r) => (ended = r),
        onPauseChange: () => undefined,
        onHud: (w) => hud.update(w, 0),
        onAnnounce: (t) => announces.push(t),
      },
    );
    game.stop();
    expect(game.world.map).toEqual(withThrone(map));
    const throne = game.world.tiles.find((t) => t.kind === 'throne')!;
    expect([throne.cx, throne.cy]).toEqual([map.w / 2, map.h / 2]);
    let now = performance.now();
    const advance = (seconds: number) => {
      for (let t = 0; t < seconds; t += 1 / 60) {
        now += 1000 / 60;
        game.frame(now);
      }
    };
    advance(1);
    expect(document.querySelector('.king-hud')!.classList.contains('hidden')).toBe(false);
    // Le joueur prend le trône : annonce, puis règne jusqu'à la victoire.
    for (const u of game.world.units) if (u.team !== 0) u.x = u.y = 0.5; // personne au centre
    throne.owner = 0;
    advance(0.5);
    expect(announces).toContain('Tu prends le trône\u00a0!');
    game.world.king.reign[0] = KING.winSeconds - 21;
    advance(1.5);
    expect(announces).toContain('Plus que 20\u00a0s de règne pour toi\u00a0!');
    game.world.king.reign[0] = KING.winSeconds - 0.2;
    for (const u of game.world.units) if (u.team !== 0) u.x = u.y = 0.5;
    advance(0.5);
    expect(game.over).toBe(true);
    expect(game.victors).toEqual([0]);
    game.destroy();
    void ended;
  });

  it('mode classique : pas de trône', () => {
    const map = generateMap(skirmishLevel({ teams: 4, size: 1, tiles: 18 }), 321);
    const game = new Game(
      document.getElementById('game') as HTMLCanvasElement,
      document.getElementById('minimap') as HTMLCanvasElement,
      sfx,
      { map, mapIndex: -1, playerColor: 1, difficulty: 'normal', seed: 321 },
      { onEnd: () => undefined, onPauseChange: () => undefined, onHud: () => undefined },
    );
    game.stop();
    expect(game.world.map).toBe(map);
    expect(game.world.tiles.some((t) => t.kind === 'throne')).toBe(false);
    game.destroy();
  });
});
