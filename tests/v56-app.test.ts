// @vitest-environment jsdom
/**
 * v5.6 dans l'application complète (jsdom + canvas réel) : tap hors de la carte, mode Équipes
 * choisi au menu, abandon depuis la pause avec écran de fin et statistiques.
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

describe('v5.6 dans l’application', () => {
  it('mode Équipes au menu, tap hors carte, puis abandon avec statistiques', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', tutorialSeen: true }));
    const main = await import('../src/main');
    const menu = document.getElementById('menu')!;
    // Escarmouche, 4 équipes, mode « Par 2 ».
    [...menu.querySelectorAll<HTMLButtonElement>('.mode-btn')].find((b) => b.textContent === 'Escarmouche')!.click();
    const teamRow = menu.querySelector('.team-mode')!;
    const btns = [...teamRow.querySelectorAll<HTMLButtonElement>('.opt-btn')];
    expect(btns.map((b) => b.textContent)).toEqual(['Libre', 'Par 2', 'Par 3', 'Par 4']);
    expect(btns[1].disabled).toBe(false);
    expect(btns[2].disabled).toBe(true); // 4 équipes ne se partagent pas par 3
    btns[1].click();
    expect(menu.querySelector('.team-mode-desc')!.textContent).toMatch(/2 contre 2/);
    // 5 équipes : « Par 2 » devient impossible, la ligne d'aide le dit.
    const teamsRow = menu.querySelector('.skirmish .opt-line')!;
    [...teamsRow.querySelectorAll<HTMLButtonElement>('.opt-btn')].find((b) => b.textContent === '5')!.click();
    expect(btns[1].disabled).toBe(true);
    expect(menu.querySelector('.team-mode-desc')!.textContent).toMatch(/Impossible avec 5/);
    [...teamsRow.querySelectorAll<HTMLButtonElement>('.opt-btn')].find((b) => b.textContent === '4')!.click();
    (menu.querySelector('.btn-play') as HTMLButtonElement).click();

    const game = main.__game()!;
    game.stop();
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.2);
    expect(game.teamGroups).not.toBeNull();
    const mate = game.teamGroups!.findIndex((g, t) => t > 0 && g === 0);
    expect(game.world.isAllied(0, mate)).toBe(true);
    // Puce du coéquipier : panneau sans bouton d'action.
    (document.querySelectorAll<HTMLButtonElement>('#team-chips .chip')[mate]).click();
    const panel = document.getElementById('diplo-panel')!;
    expect(panel.querySelector('.diplo-status')!.textContent).toMatch(/Coéquipiers/);
    expect(panel.querySelector('.diplo-action')!.classList.contains('hidden')).toBe(true);
    (panel.querySelector('.diplo-close') as HTMLButtonElement).click();

    // Tap hors de la carte avec une sélection : les élèves vont au bord le plus proche.
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    expect(game.selected.size).toBeGreaterThan(0);
    const out = game.cam.gridToScreen(-3, 4);
    pointer('pointerdown', out.x, out.y);
    pointer('pointerup', out.x, out.y);
    await wait(400);
    advance(0.1);
    const u = game.world.units.find((x) => game.selected.has(x.id))!;
    expect(u.order.kind).not.toBe('none');
    expect(u.order.target.x).toBeLessThan(1.5); // au bord ouest (formation autour du point)
    expect(u.order.target.y).toBeGreaterThan(2);
    expect(u.order.target.y).toBeLessThan(6);

    // Pause, Abandonner, confirmation dans la page, écran de fin « Abandon » avec statistiques.
    game.setPaused(true);
    const overlay = document.getElementById('overlay')!;
    const ab = [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Abandonner')!;
    expect(ab).toBeTruthy();
    ab.click();
    expect(overlay.querySelector('h2')!.textContent).toBe('Abandonner la partie ?');
    [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Non, je continue')!.click();
    expect(overlay.querySelector('h2')!.textContent).toBe('Pause');
    [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Abandonner')!.click();
    [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Oui, j’abandonne')!.click();
    expect(game.over).toBe(true);
    expect(overlay.querySelector('h2')!.textContent).toBe('Abandon');
    expect(overlay.querySelector('.end-stats table')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).unlocked).toBe(1);
  });
});
