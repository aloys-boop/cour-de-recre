// @vitest-environment jsdom
/**
 * v5.22 dans l’application complète : boutons qui s’enfoncent, fondus entre menu et partie,
 * onde sous le doigt à chaque ordre (sélection, déplacement, attaque).
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

function pointer(el: Element, type: string, x: number, y: number): void {
  const Ctor = (globalThis as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const e = new Ctor(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  if (!('pointerId' in e) || (e as PointerEvent).pointerId === undefined) Object.defineProperty(e, 'pointerId', { value: 1 });
  el.dispatchEvent(e);
}
const tap = (el: Element, x: number, y: number) => (pointer(el, 'pointerdown', x, y), pointer(el, 'pointerup', x, y));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('interface b dans l’application', () => {
  it('boutons enfoncés, fondus, ondes sous le doigt', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    const veil = main.__veil();
    expect(veil.active).toBe(false);

    // Un bouton du menu s'enfonce au contact, et le reste au moins 110 ms après un tap éclair.
    const play = document.querySelector('#menu .btn-play') as HTMLButtonElement;
    pointer(play, 'pointerdown', 10, 10);
    expect(play.classList.contains('is-pressed')).toBe(true);
    pointer(play, 'pointerup', 10, 10);
    expect(play.classList.contains('is-pressed')).toBe(true);
    await wait(140);
    expect(play.classList.contains('is-pressed')).toBe(false);
    // Doigt qui glisse hors du bouton : il remonte.
    const team = document.querySelector('#menu .team-btn') as HTMLButtonElement;
    pointer(team, 'pointerdown', 10, 10);
    pointer(team, 'pointerout', 10, 10);
    await wait(140);
    expect(team.classList.contains('is-pressed')).toBe(false);

    // Menu → partie : la partie est là tout de suite, sous un voile qui se lève.
    play.click();
    const game = main.__game()!;
    game.stop();
    expect(veil.active).toBe(true);
    expect(veil.last?.kind).toBe('partie');
    expect(document.getElementById('hud')!.classList.contains('hidden')).toBe(false);
    expect(veil.el.style.pointerEvents).toBe('none');
    await wait(veil.last!.ms + 120);
    expect(veil.active).toBe(false);

    // Tap sur un de ses élèves : onde de sélection, sous le doigt.
    const canvas = document.getElementById('game')!;
    const w = game.world;
    const mine = w.units.find((u) => u.team === game.playerTeam && u.alive && !u.pion)!;
    game.cam.centerOnGrid(mine.x, mine.y);
    const p = game.cam.gridToScreen(mine.x, mine.y);
    tap(canvas, p.x, p.y - 12 * game.cam.zoom);
    expect(game.selected.size).toBeGreaterThan(0);
    expect(game.ripples[game.ripples.length - 1]).toMatchObject({ kind: 'select', x: p.x, y: p.y - 12 * game.cam.zoom });

    // Tap sur le sol libre : onde de déplacement, exactement là où le doigt s'est posé.
    const before = game.ripples.length;
    const gx = p.x + 120;
    const gy = p.y + 40;
    tap(canvas, gx, gy);
    const last = game.ripples[game.ripples.length - 1]!;
    expect(game.ripples.length).toBe(before + 1);
    expect(['move', 'charge', 'capture']).toContain(last.kind);
    expect(last.x).toBe(gx);
    expect(last.y).toBe(gy);

    // Tap sur un ennemi visible : onde d'attaque.
    const foe = w.units.find((u) => u.team !== game.playerTeam && u.alive)!;
    foe.x = mine.x + 0.6;
    foe.y = mine.y + 0.6;
    (game as unknown as { fogDirty?: boolean }).fogDirty = true;
    let now = performance.now();
    for (let i = 0; i < 3; i++) game.frame((now += 1000 / 60));
    const fp = game.cam.gridToScreen(foe.x, foe.y);
    tap(canvas, fp.x, fp.y - 12 * game.cam.zoom);
    expect(game.ripples[game.ripples.length - 1]!.kind).toBe('attack');

    // Les ondes se dessinent sans erreur, puis s'éteignent d'elles-mêmes (temps réel).
    expect(() => {
      for (let t = 0; t < 0.7; t += 1 / 60) game.frame((now += 1000 / 60));
    }).not.toThrow();
    expect(game.ripples).toHaveLength(0);

    // Pause : un tap ne fait plus d'onde.
    game.setPaused(true);
    tap(canvas, gx, gy);
    expect(game.ripples).toHaveLength(0);

    // Quitter : retour au menu sous un voile.
    const quit = [...document.querySelectorAll('#overlay button')].find((b) => b.textContent === 'Quitter') as HTMLButtonElement;
    quit.click();
    expect(veil.last?.kind).toBe('menu');
    expect(veil.active).toBe(true);
    expect(document.getElementById('menu')!.classList.contains('hidden')).toBe(false);
  }, 30000);
});
