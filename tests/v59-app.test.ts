// @vitest-environment jsdom
/**
 * v5.7 dans l'application complète (jsdom + canvas réel) : une case attaquée fait apparaître
 * le bandeau d'alerte ; le toucher emmène la caméra sur la case.
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

describe('v5.9 dans l’application', () => {
  it('puce du joueur « élèves/plafond » ; la toucher ouvre les effectifs de chaque équipe', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 4, lastDifficulty: 'normal', tutorialSeen: true }));
    const main = await import('../src/main');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.5);
    const chips = [...document.querySelectorAll<HTMLButtonElement>('#team-chips .chip')];
    const mine = chips[game.playerTeam];
    const count = game.world.teamUnitCount(game.playerTeam);
    expect(mine.querySelector('.chip-count')!.textContent).toBe(`${count}/${game.world.map.unitCap}`);
    expect(mine.getAttribute('aria-label')).toMatch(/Toucher pour les effectifs/);
    const panel = document.getElementById('count-panel')!;
    expect(panel.classList.contains('hidden')).toBe(true);
    mine.click();
    advance(0.1);
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(mine.classList.contains('open')).toBe(true);
    const rows = panel.querySelectorAll('tbody tr');
    expect(rows.length).toBe(game.world.numTeams);
    expect(rows[game.playerTeam].querySelector('th')!.textContent).toBe('Toi');
    expect(rows[game.playerTeam].classList.contains('me')).toBe(true);
    expect(panel.querySelector('.counts-cap')!.textContent).toMatch(/\d+\/\d+/);
    // Une puce adverse ferme les effectifs et ouvre la diplomatie.
    chips[(game.playerTeam + 1) % chips.length].click();
    expect(panel.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('diplo-panel')!.classList.contains('hidden')).toBe(false);
    // Retour aux effectifs, puis « Fermer ».
    mine.click();
    expect(document.getElementById('diplo-panel')!.classList.contains('hidden')).toBe(true);
    (panel.querySelector('.diplo-close') as HTMLButtonElement).click();
    expect(panel.classList.contains('hidden')).toBe(true);
    // La pause referme le détail.
    mine.click();
    game.setPaused(true);
    expect(panel.classList.contains('hidden')).toBe(true);
  });
});
