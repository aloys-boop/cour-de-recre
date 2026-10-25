// @vitest-environment jsdom
/** Option « Surveillants » dans une vraie partie (jsdom + canvas réel) : tap, flèche, KO, annonce, HUD, brouillard. */
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import type { Sfx } from '../src/audio/sfx';
import { pointVisible } from '../src/core/fog';
import { generateMap } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';
import { supervisorsOf, type Supervisor } from '../src/core/supervisors';
import type { GameRules } from '../src/core/rules';
import { Hud } from '../src/ui/hud';

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

interface Inputs {
  tap(x: number, y: number): void;
  arrowEnd(x: number, y: number): void;
}

function makeGame(rules: GameRules, announces: string[] = []) {
  const map = generateMap(skirmishLevel({ teams: 2, size: 1, tiles: 10 }), 99);
  const game = new Game(
    document.getElementById('game') as HTMLCanvasElement,
    document.getElementById('minimap') as HTMLCanvasElement,
    sfx,
    { map, mapIndex: -1, playerColor: 1, difficulty: 'normal', seed: 99, rules },
    { onEnd: () => undefined, onPauseChange: () => undefined, onHud: () => undefined, onAnnounce: (t) => announces.push(t) },
  );
  game.stop();
  let now = performance.now();
  const advance = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      now += 1000 / 60;
      game.frame(now);
    }
  };
  advance(0.05);
  return { game, advance };
}

function park(s: Supervisor, x: number, y: number) {
  s.x = x;
  s.y = y;
  s.mode = 'wait';
  s.timer = 1e6;
  s.path.length = 0;
  s.goal = null;
}

/** Point de l'écran sur la silhouette du surveillant (centré par la caméra). */
function aimAt(game: Game, s: Supervisor) {
  game.cam.centerOnGrid(s.x, s.y);
  const p = game.cam.gridToScreen(s.x, s.y);
  return { x: p.x, y: p.y - 24 * game.cam.zoom };
}

describe('option « Surveillants » : partie complète', () => {
  it('tap et flèche sur un surveillant donnent un ordre d’attaque ; KO annoncé et bonus affiché dans le HUD', () => {
    const announces: string[] = [];
    const { game, advance } = makeGame({ mode: 'classique', supervisors: true }, announces);
    const w = game.world;
    const sups = supervisorsOf(w);
    expect(sups.length).toBeGreaterThanOrEqual(2);
    const s = sups[0];
    for (const o of sups.slice(1)) park(o, 0.5, w.map.h - 0.5);
    const mine = w.units.filter((u) => u.team === 0);
    expect(mine.length).toBeGreaterThan(0);
    const c = w.grid.nearestFree(w.map.w / 2, w.map.h / 2);
    park(s, c.x + 0.5, c.y + 0.5);
    for (const u of w.units) if (u.team !== 0) w.orderMove([u], { x: w.map.w - 1, y: w.map.h - 1 });
    mine.forEach((u, i) => {
      u.x = s.x - 4 + (i % 3) * 0.4;
      u.y = s.y + Math.floor(i / 3) * 0.4;
      u.clearOrder();
    });
    for (const u of mine) game.selected.add(u.id);
    const inputs = game as unknown as Inputs;
    // Tap.
    let at = aimAt(game, s);
    inputs.tap(at.x, at.y);
    for (const u of mine) {
      expect(u.order.kind).toBe('attack');
      expect(u.supId).toBe(s.id);
    }
    // Flèche relâchée sur le surveillant.
    for (const u of mine) u.clearOrder(), (u.supId = 0);
    at = aimAt(game, s);
    inputs.arrowEnd(at.x, at.y);
    for (const u of mine) expect(u.supId).toBe(s.id);
    // Ils l'achèvent : annonce et bonus.
    s.hp = 1;
    advance(6);
    expect(s.mode === 'ko' || s.mode === 'away').toBe(true);
    expect(announces.some((t) => t.startsWith('Tu as mis KO un surveillant'))).toBe(true);
    expect(game.stats.teams[0].supKo).toBe(1);
    const hud = new Hud(document.getElementById('hud')!, { onSelectAll: () => undefined, onCancel: () => undefined, onPause: () => undefined, onToggleSound: () => true }, true);
    hud.update(w, 0, 0);
    expect(document.getElementById('bonus-line')!.textContent).toMatch(/Surveillant KO\u00a0: dégâts \+25\u00a0% \(\d+\u00a0s\)/);
    game.destroy();
  });

  it('brouillard : un surveillant caché ne se cible pas au doigt', () => {
    const { game } = makeGame({ mode: 'classique', supervisors: true, fog: true });
    const w = game.world;
    const sups = supervisorsOf(w);
    const s = sups[0];
    const c = w.grid.nearestFree(w.map.w / 2, w.map.h / 2);
    park(s, c.x + 0.5, c.y + 0.5);
    for (const o of sups.slice(1)) park(o, 0.5, w.map.h - 0.5);
    const mine = w.units.filter((u) => u.team === 0);
    for (const u of mine) game.selected.add(u.id);
    expect(pointVisible(w, 0, s.x, s.y)).toBe(false);
    const at = aimAt(game, s);
    (game as unknown as Inputs).tap(at.x, at.y);
    for (const u of mine) expect(u.supId).toBe(0);
    game.destroy();
  });
});
