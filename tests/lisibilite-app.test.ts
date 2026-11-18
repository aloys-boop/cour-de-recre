// @vitest-environment jsdom
/**
 * v5.19 dans l’application complète (jsdom + canvas réel) : les puces portent l’emblème de leur
 * équipe, et « Motifs d’équipe » s’affiche ou se masque dans la pause, mémorisé, rendu sans erreur.
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


describe('lisibilité dans l’application', () => {
  it('puces en emblèmes, « Motifs d’équipe : Affichés » dans la pause, mémorisé', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 2, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    expect(game.patternsShown).toBe(false);
    // Une puce par équipe, chacune avec une forme différente.
    const marks = [...document.querySelectorAll('.chip .team-mark svg')].map((s) => s.getAttribute('class'));
    expect(marks.length).toBe(game.world.numTeams);
    expect(new Set(marks).size).toBe(marks.length);
    expect(marks[0]).toContain('emblem-carre'); // le joueur joue les Jaunes

    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.5);

    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    expect(document.querySelector('.readability-block')?.textContent).toContain('Lisibilité');
    const on = document.querySelector('.patterns-toggle .tempo-opt[data-value="on"]') as HTMLButtonElement;
    const off = document.querySelector('.patterns-toggle .tempo-opt[data-value="off"]') as HTMLButtonElement;
    expect(off.classList.contains('on')).toBe(true);
    on.click();
    expect(game.patternsShown).toBe(true);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).patterns).toBe(true);

    // Rendu avec motifs : élèves, camp possédé, case bonus prise, jauge de capture.
    const w = game.world;
    const camp = w.tiles.find((t) => t.isCamp && t.owner === 0)!;
    for (let i = 0; i < 4; i++) w.spawnUnit(0, camp.cx + 0.2 * i, camp.cy);
    const bonus = w.tiles.find((t) => !t.isCamp && t.suit)!;
    bonus.owner = 0;
    bonus.cap = 0.5;
    bonus.capTeam = 0;
    game.cam.centerOnGrid(camp.cx, camp.cy);
    (document.getElementById('btn-pause') as HTMLButtonElement).click(); // reprise
    expect(() => advance(0.5)).not.toThrow();

    // Masqués à nouveau.
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    (document.querySelector('.patterns-toggle .tempo-opt[data-value="off"]') as HTMLButtonElement).click();
    expect(game.patternsShown).toBe(false);
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).patterns).toBe(false);
  }, 30000);
});
