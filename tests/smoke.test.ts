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

function press(el: Element, type: string): void {
  const Ctor = (globalThis as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const e = new Ctor(type, { bubbles: true, cancelable: true });
  if (!('pointerId' in e)) Object.defineProperty(e, 'pointerId', { value: 7 });
  el.dispatchEvent(e);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    // Groupes mémorisés : appui long sur « 1 » = enregistrer, tap = rappeler.
    const g1 = document.getElementById('btn-group-1')!;
    expect(g1).not.toBeNull();
    expect(document.getElementById('btn-group-3')).not.toBeNull();
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const all = game.selected.size;
    press(g1, 'pointerdown');
    await wait(460);
    press(g1, 'pointerup');
    expect(game.groupSize(0)).toBe(all);
    expect(g1.querySelector('.ctl-count')!.textContent).toBe(String(all));
    expect(document.getElementById('hint')!.textContent).toMatch(/Groupe 1 enregistré/);
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();
    press(g1, 'pointerdown');
    press(g1, 'pointerup');
    expect(game.selected.size).toBe(all);
    // Second tap rapide : la caméra se centre sur le groupe.
    game.cam.pan(400, 200);
    const camBefore = { x: game.cam.x, y: game.cam.y };
    press(g1, 'pointerdown');
    press(g1, 'pointerup');
    expect(Math.hypot(game.cam.x - camBefore.x, game.cam.y - camBefore.y)).toBeGreaterThan(1);
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();

    // Double-tap sur un de nos élèves : tous ceux visibles à l'écran sont sélectionnés.
    const sp = game.cam.gridToScreen(me.x, me.y);
    pointer('pointerdown', sp.x, sp.y - 20);
    pointer('pointerup', sp.x, sp.y - 20);
    const neighbours = game.selected.size;
    pointer('pointerdown', sp.x, sp.y - 20);
    pointer('pointerup', sp.x, sp.y - 20);
    const visible = game.world.units.filter((u) => {
      if (u.team !== 0 || !u.alive) return false;
      const q = game.cam.gridToScreen(u.x, u.y);
      const y = q.y - 20 * game.cam.zoom;
      return q.x >= 0 && q.x <= game.cam.viewW && y >= 0 && y <= game.cam.viewH;
    }).length;
    expect(game.selected.size).toBe(visible);
    expect(game.selected.size).toBeGreaterThanOrEqual(neighbours);
    expect(game.selected.has(me.id)).toBe(true);

    // Glisser depuis un élève sélectionné : flèche d'ordre, la caméra ne bouge pas.
    const camX = game.cam.x;
    const dest = game.cam.gridToScreen(me.x - 2, me.y + 2);
    pointer('pointerdown', sp.x, sp.y - 20);
    pointer('pointermove', (sp.x + dest.x) / 2, (sp.y - 20 + dest.y) / 2);
    pointer('pointermove', dest.x, dest.y);
    advance(1 / 60); // la flèche est dessinée
    pointer('pointerup', dest.x, dest.y);
    expect(game.cam.x).toBe(camX);
    expect(me.order.kind).toBe('move');
    expect(Math.hypot(me.order.target.x - (me.x - 2), me.order.target.y - (me.y + 2))).toBeLessThan(2);

    // Bouton « Camp » : repli (sans combat) de la sélection vers notre camp.
    advance(1);
    (document.getElementById('btn-camp') as HTMLButtonElement).click();
    const home = game.world.tiles.find((t) => t.isCamp && t.owner === 0)!;
    expect(me.order.kind).toBe('move');
    expect(me.order.engage).toBeFalsy();
    expect(Math.hypot(me.order.target.x - home.cx, me.order.target.y - home.cy)).toBeLessThan(2);
    // Le repli au camp répartit les élèves dans le camp.
    for (const id of game.selected) {
      const u = game.world.unitById(id)!;
      expect(home.contains(u.order.target.x, u.order.target.y)).toBe(true);
    }
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();

    // Tap à côté d'une case bonus (dans son losange agrandi) : l'ordre est aimanté,
    // les élèves se répartissent sur la case et y arrivent.
    (document.getElementById('btn-select-all') as HTMLButtonElement).click();
    const squad = [...game.selected].map((id) => game.world.unitById(id)!);
    const bonus = game.world.tiles
      .filter((t) => !t.isCamp)
      .sort((a, b) => Math.hypot(a.cx - home.cx, a.cy - home.cy) - Math.hypot(b.cx - home.cx, b.cy - home.cy))[0];
    game.cam.centerOnGrid(bonus.cx, bonus.cy);
    const near = game.cam.gridToScreen(bonus.cx + 0.6, bonus.cy - 0.25);
    pointer('pointerdown', near.x, near.y);
    pointer('pointerup', near.x, near.y);
    for (const u of squad) {
      expect(u.order.kind).toBe('move');
      expect(bonus.contains(u.order.target.x, u.order.target.y)).toBe(true);
    }
    advance(12);
    const onTile = squad.filter((u) => u.alive && bonus.contains(u.x, u.y)).length;
    expect(onTile).toBeGreaterThanOrEqual(Math.min(4, squad.filter((u) => u.alive).length));
    (document.getElementById('btn-cancel') as HTMLButtonElement).click();

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
