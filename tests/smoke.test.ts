// @vitest-environment jsdom
/**
 * Test d'intégration « fumée » : on charge l'application complète dans jsdom,
 * avec un canvas réel (@napi-rs/canvas) branché derrière getContext, puis on
 * joue quelques secondes : menu → partie → tap de sélection → ordre de déplacement.
 */
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'node:fs';
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

describe('application complète', () => {
  it('démarre une partie depuis le menu et répond aux gestes', async () => {
    const main = await import('../src/main');
    void main;
    // Le menu est affiché avec ses quatre équipes et ses cartes.
    const menu = document.getElementById('menu')!;
    expect(menu.classList.contains('hidden')).toBe(false);
    expect(menu.querySelectorAll('.team-btn').length).toBe(4);
    expect(menu.querySelectorAll('.map-btn').length).toBeGreaterThanOrEqual(5);
    expect(menu.querySelectorAll('.map-btn.locked').length).toBe(menu.querySelectorAll('.map-btn').length - 1);

    // On choisit l'équipe Violet et on lance.
    (menu.querySelectorAll('.team-btn')[3] as HTMLButtonElement).click();
    (menu.querySelector('.btn-play') as HTMLButtonElement).click();
    expect(menu.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('hud')!.classList.contains('hidden')).toBe(false);

    const { __game } = await import('../src/main');
    const game = __game();
    expect(game).not.toBeNull();
    if (!game) return;
    game.stop(); // on pilote la boucle à la main
    expect(game.world.teamColors[0]).toBe(3);

    let now = performance.now();
    const advance = (seconds: number) => {
      for (let t = 0; t < seconds; t += 1 / 60) {
        now += 1000 / 60;
        game.frame(now);
      }
    };
    advance(0.5);
    expect(game.world.time).toBeGreaterThan(0.3);

    // Tap sur un de nos élèves → sélection (lui et ses voisins).
    const me = game.world.units.find((u) => u.team === 0)!;
    const p = game.cam.gridToScreen(me.x, me.y);
    pointer('pointerdown', p.x, p.y - 20);
    pointer('pointerup', p.x, p.y - 20);
    expect(game.selected.size).toBeGreaterThan(0);
    expect(document.getElementById('sel-count')!.textContent).toMatch(/sélectionné/);

    // Tap sur le sol → ordre de déplacement, les élèves bougent.
    const target = game.cam.gridToScreen(me.x + 2, me.y - 2);
    const before = { x: me.x, y: me.y };
    pointer('pointerdown', target.x, target.y);
    pointer('pointerup', target.x, target.y);
    expect(me.order.kind).toBe('move');
    advance(1.5);
    expect(Math.hypot(me.x - before.x, me.y - before.y)).toBeGreaterThan(0.5);

    // Boutons HUD : tout sélectionner, annuler.
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    expect(game.selected.size).toBe(game.world.teamUnitCount(0));
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();
    expect(game.selected.size).toBe(0);

    // Glissé à un doigt → la caméra se déplace.
    const cx = game.cam.x;
    pointer('pointerdown', 300, 200);
    pointer('pointermove', 340, 200);
    pointer('pointermove', 380, 200);
    pointer('pointerup', 380, 200);
    expect(game.cam.x).not.toBe(cx);

    // Pause : l'overlay s'affiche et la simulation s'arrête.
    (document.getElementById('btn-pause') as HTMLButtonElement).click();
    expect(game.paused).toBe(true);
    const overlay = document.getElementById('overlay')!;
    expect(overlay.classList.contains('hidden')).toBe(false);
    const t0 = game.world.time;
    advance(0.5);
    expect(game.world.time).toBe(t0);
    (overlay.querySelector('button') as HTMLButtonElement).click(); // Reprendre
    expect(game.paused).toBe(false);

    // Mise en arrière-plan → pause automatique.
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(game.paused).toBe(true);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    (overlay.querySelector('button') as HTMLButtonElement).click();

    // On laisse la partie tourner un peu avec l'IA, puis on sauvegarde une image.
    advance(20);
    expect(game.over).toBe(false);
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const back = backing.get(canvas);
    expect(back).toBeDefined();
    if (process.env.SMOKE_PNG && back) writeFileSync(process.env.SMOKE_PNG, back.toBuffer('image/png'));
  });
});
