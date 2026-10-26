// @vitest-environment jsdom
/**
 * Tutoriel dans l'application complète (jsdom + canvas réel) : proposé au premier lancement,
 * chaque étape franchie par de vrais gestes, bouton « Passer », écran « Comment jouer »
 * depuis le menu et la pause.
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

describe('tutoriel dans l’application', () => {
  it('premier lancement, 11 étapes au doigt, victoire, « Comment jouer » et « Passer »', async () => {
    let seed = 777;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    localStorage.clear();
    const main = await import('../src/main');
    const overlay = document.getElementById('overlay')!;
    // Premier lancement : le tutoriel est proposé.
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(overlay.querySelector('h2')!.textContent).toMatch(/Bienvenue/);
    const startBtn = [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Faire le tutoriel')!;
    startBtn.click();
    let game = main.__game()!;
    expect(game.tutorial).not.toBeNull();
    game.stop();
    expect(overlay.classList.contains('hidden')).toBe(true);
    const bubble = document.querySelector('.tuto-bubble')!;
    const text = () => bubble.querySelector('.tuto-text')!.textContent;
    const stepId = () => game.tutorial!.step.id;
    expect(bubble.querySelector('.tuto-count')!.textContent).toBe('Étape 1 / 11');
    expect(document.getElementById('btn-tuto-skip')!.textContent).toBe('Passer');

    let now = performance.now();
    const advance = (seconds: number, until?: () => boolean) => {
      for (let t = 0; t < seconds; t += 1 / 60) {
        now += 1000 / 60;
        game.frame(now);
        if (until?.()) return;
      }
    };
    const tap = (x: number, y: number) => {
      pointer('pointerdown', x, y);
      pointer('pointerup', x, y);
    };
    const at = (gx: number, gy: number) => game.cam.gridToScreen(gx, gy);
    const mine = () => game.world.units.filter((u) => u.team === 0 && u.alive && !u.pion);
    advance(0.3);
    expect(text()).toMatch(/Touche un de tes élèves/);
    // La main montre un de tes élèves.
    expect(document.querySelector('.tuto-hand')!.classList.contains('hidden')).toBe(false);

    // 1. Sélectionner un élève.
    const me = mine()[0];
    const p = at(me.x, me.y);
    tap(p.x, p.y - 20);
    expect(stepId()).toBe('box');
    advance(0.1);
    expect(bubble.querySelector('.tuto-count')!.textContent).toBe('Étape 2 / 11');

    // 2. Sélection rectangle : appui long, puis glisser.
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();
    const c = game.world.tiles[0];
    const a0 = at(c.cx - 1.6, c.cy - 1.6);
    const a1 = at(c.cx + 1.6, c.cy + 1.6);
    pointer('pointerdown', a0.x - 30, a0.y - 60);
    await wait(380);
    pointer('pointermove', a1.x + 30, a1.y + 20);
    pointer('pointerup', a1.x + 30, a1.y + 20);
    expect(game.selected.size).toBeGreaterThan(1);
    expect(stepId()).toBe('move');

    // 3. Déplacer.
    const g1 = at(c.cx + 2.5, c.cy - 2.5);
    tap(g1.x, g1.y);
    expect(stepId()).toBe('capture');

    // 4. Capturer la case ♥ : ordre aimanté sur la case, puis on attend la jauge.
    const heart = game.world.tiles.find((t) => t.suit === 'heart' && t.x === 3)!;
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const h = at(heart.cx, heart.cy);
    tap(h.x, h.y);
    advance(12, () => stepId() !== 'capture');
    expect(heart.owner).toBe(0);
    expect(stepId()).toBe('attack');

    // 5. Attaquer un des Verts qui approchent.
    advance(1);
    const foe = game.world.units.find((u) => u.team === 1 && u.alive)!;
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const f = at(foe.x, foe.y);
    tap(f.x, f.y - 20);
    expect(stepId()).toBe('rally');

    // 6. Annuler, puis appui long sur le sol : point de ralliement.
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();
    const r = at(c.cx + 2, c.cy - 1);
    pointer('pointerdown', r.x, r.y);
    await wait(400);
    pointer('pointerup', r.x, r.y);
    expect(stepId()).toBe('camera');

    // 7. Caméra : toucher la mini-carte.
    const mini = document.getElementById('minimap')!;
    mini.dispatchEvent(new (globalThis.PointerEvent ?? MouseEvent)('pointerdown', { clientX: 60, clientY: 30, bubbles: true, cancelable: true }));
    expect(stepId()).toBe('merits');

    // 8. Prendre une autre case pour gagner des bons points.
    game.cam.fit();
    const club = game.world.tiles.find((t) => t.suit === 'club')!;
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const k = at(club.cx, club.cy);
    tap(k.x, k.y);
    advance(15, () => stepId() !== 'merits');
    expect(stepId()).toBe('upgrade');

    // 9. Sans sélection, toucher son camp puis améliorer la Production.
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();
    const home = game.world.tiles[0];
    const hc = at(home.cx + 0.7, home.cy + 0.7);
    tap(hc.x, hc.y + 6);
    const panel = document.getElementById('camp-panel')!;
    expect(panel.classList.contains('hidden')).toBe(false);
    panel.querySelector<HTMLButtonElement>('.camp-row[data-branch="prod"] .camp-buy')!.click();
    expect(home.upgrades.prod).toBe(1);
    expect(stepId()).toBe('power');
    advance(0.1);
    expect(panel.classList.contains('hidden')).toBe(true);

    // 10. Goûter : armer, viser ses élèves, toucher la zone.
    (document.getElementById('btn-power-gouter') as HTMLButtonElement).click();
    expect(game.armedPower).toBe('gouter');
    // La zone part du centre de l'écran : on la déplace d'abord au loin, puis sur ses élèves.
    const far = at(9.5, 1.5);
    tap(far.x, far.y);
    expect(game.armedPower).toBe('gouter');
    expect(Math.hypot(game.powerAim!.x - 9.5, game.powerAim!.y - 1.5)).toBeLessThan(0.3);
    const target = mine()[0];
    const tp = at(target.x, target.y);
    tap(tp.x, tp.y);
    expect(game.armedPower).toBe('gouter');
    tap(tp.x, tp.y);
    expect(game.armedPower).toBeNull();
    expect(stepId()).toBe('win');
    advance(0.05);
    expect(text()).toMatch(/prends le camp des Verts/);

    // 11. Victoire (on accélère : camp vert pris, Verts dispersés).
    for (const u of game.world.units) if (u.team === 1) u.takeDamage(1000, 0, 0);
    game.world.tiles[1].owner = 0;
    advance(0.5);
    expect(game.over).toBe(true);
    expect(game.tutorial!.done).toBe(true);
    await wait(1000);
    expect(overlay.querySelector('h2')!.textContent).toBe('Tutoriel réussi\u00a0!');
    expect(JSON.parse(localStorage.getItem('cour-de-recre.v2')!).tutorialDone).toBe(true);
    [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Menu')!.click();

    // Menu : tutoriel en tête de campagne (rejouable), « Comment jouer ».
    const menu = document.getElementById('menu')!;
    expect(menu.querySelector('.tuto-btn')!.textContent).toMatch(/Terminé/);
    (menu.querySelector('.btn-howto') as HTMLButtonElement).click();
    expect(overlay.querySelector('h2')!.textContent).toBe('Comment jouer');
    expect(overlay.querySelectorAll('.howto-body section').length).toBeGreaterThanOrEqual(8);
    [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Retour')!.click();
    expect(overlay.classList.contains('hidden')).toBe(true);

    // Rejouer le tutoriel depuis le menu, « Comment jouer » depuis la pause, puis « Passer ».
    (menu.querySelector('.tuto-btn') as HTMLButtonElement).click();
    (menu.querySelector('.btn-play') as HTMLButtonElement).click();
    game = main.__game()!;
    game.stop();
    expect(game.tutorial!.index).toBe(0);
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Comment jouer')!.click();
    expect(overlay.querySelector('h2')!.textContent).toBe('Comment jouer');
    [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Retour')!.click();
    expect(overlay.querySelector('h2')!.textContent).toBe('Pause');
    [...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Reprendre')!.click();
    (document.getElementById('btn-tuto-skip') as HTMLButtonElement).click();
    expect(main.__game()).toBeNull();
    expect(menu.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.tuto')!.classList.contains('hidden')).toBe(true);
  }, 30_000);
});
