// @vitest-environment jsdom
/**
 * Pouvoirs de récré dans l'application complète : bulle d'aide par appui long (valeurs réelles,
 * dans l'écran), glisser-déposer (zone qui suit le doigt, cible non valide, annulation sur le HUD,
 * défilement de la caméra au bord), refus motivé, ancien mode « tap puis tap ».
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('pouvoirs : aide et glisser-déposer', () => {
  it('appui long = aide ; glisser = lancer ; relâcher sur le HUD = annuler ; bord = défilement', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', tutorialSeen: true }));
    const main = await import('../src/main');
    const { POWERS } = await import('../src/core/powers');
    const { awardMerit } = await import('../src/core/merits');
    (document.querySelector('#menu .btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.2);
    const snow = document.getElementById('btn-power-neige')!;
    const press = (el: Element, type: string, x: number, y: number) => {
      const e = new (globalThis.PointerEvent ?? MouseEvent)(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
      if (!('pointerId' in e) || (e as PointerEvent).pointerId === undefined) Object.defineProperty(e, 'pointerId', { value: 5 });
      el.dispatchEvent(e);
    };
    const hint = () => document.getElementById('hint')!.textContent;
    const tip = document.querySelector<HTMLElement>('.power-tip')!;

    // Sans bons points : bouton grisé avec ce qu'il manque ; un glisser explique au lieu de lancer.
    advance(0.3);
    expect(snow.classList.contains('poor')).toBe(true);
    expect(snow.querySelector('.power-wait')!.textContent).toBe(`−${POWERS.neige.cost}`);
    press(snow, 'pointerdown', 450, 380);
    press(snow, 'pointermove', 450, 300);
    press(snow, 'pointerup', 450, 300);
    expect(game.powerDrag).toBeNull();
    expect(hint()).toMatch(/Pas assez de bons points : Boules de neige coûte 35/);

    // Aide : appui long sans bouger, la bulle reste tant que le doigt est posé, dans l'écran.
    press(snow, 'pointerdown', 450, 380);
    await wait(450);
    expect(tip.classList.contains('hidden')).toBe(false);
    expect(tip.textContent).toMatch(/Boules de neige/);
    expect(tip.textContent).toMatch(new RegExp(`${POWERS.neige.power} dégâts`));
    expect(tip.textContent).toMatch(/Rayon : 1,8 case/);
    expect(tip.textContent).toMatch(/Coût : 35\u00a0★ · Recharge : 50\u00a0s/);
    expect(tip.textContent).toMatch(/Il te manque 35\u00a0★/);
    expect(parseFloat(tip.style.left)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(tip.style.top)).toBeGreaterThanOrEqual(8);
    await wait(300);
    expect(tip.classList.contains('hidden')).toBe(false);
    press(snow, 'pointerup', 450, 380);
    expect(tip.classList.contains('hidden')).toBe(true);
    expect(game.powerDrag).toBeNull();
    expect(game.armedPower).toBeNull();

    // Glisser-déposer avec assez de bons points.
    awardMerit(game.world, 0, 500, 0, 0, 'hold');
    const foe = game.world.units.find((u) => u.team === 1)!;
    const fp = game.cam.gridToScreen(foe.x, foe.y);
    press(snow, 'pointerdown', 450, 380);
    press(snow, 'pointermove', 450, 360);
    expect(game.powerDrag?.id).toBe('neige');
    // Hors de la cour : cible non valide.
    press(snow, 'pointermove', 2, 2);
    expect(game.powerDragTarget()!.valid).toBe(false);
    // Au bord de l'écran, la caméra défile doucement.
    const cam0 = { x: game.cam.x, y: game.cam.y };
    advance(0.5);
    expect(Math.hypot(game.cam.x - cam0.x, game.cam.y - cam0.y)).toBeGreaterThan(20);
    // Relâcher hors de la cour : annulé, rien n'est dépensé.
    press(snow, 'pointerup', 2, 2);
    expect(game.powerDrag).toBeNull();
    expect(game.world.merits.points[0]).toBe(500);
    // Relâcher sur le HUD (le doigt revient sur un bouton) : annulé.
    const doc = document as Document & { elementsFromPoint?: (x: number, y: number) => Element[] };
    const before = doc.elementsFromPoint;
    doc.elementsFromPoint = () => [snow, document.getElementById('hud')!];
    press(snow, 'pointerdown', 450, 380);
    press(snow, 'pointermove', 450, 340);
    press(snow, 'pointerup', 450, 380);
    doc.elementsFromPoint = before;
    expect(game.world.merits.points[0]).toBe(500);
    // Relâcher sur la carte : lancé là, avec retour visuel sur le bouton.
    const fp2 = game.cam.gridToScreen(foe.x, foe.y);
    void fp;
    press(snow, 'pointerdown', 450, 380);
    press(snow, 'pointermove', 450, 340);
    press(snow, 'pointermove', fp2.x, fp2.y);
    expect(game.powerDragTarget()!.valid).toBe(true);
    press(snow, 'pointerup', fp2.x, fp2.y);
    expect(game.world.merits.points[0]).toBe(500 - POWERS.neige.cost);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(snow.classList.contains('fired')).toBe(true);
    // Pendant la recharge : compte à rebours, et un glisser donne la raison.
    advance(0.3);
    expect(snow.classList.contains('cooling')).toBe(true);
    expect(snow.querySelector('.power-wait')!.textContent).toMatch(/^\d+\u00a0s$/);
    press(snow, 'pointerdown', 450, 380);
    press(snow, 'pointermove', 450, 300);
    press(snow, 'pointerup', 450, 300);
    expect(hint()).toMatch(/se recharge encore \d+\u00a0s/);

    // L'ancien mode reste : tap sur le bouton, tap sur la carte, tap dans la zone.
    const cake = document.getElementById('btn-power-gouter')!;
    press(cake, 'pointerdown', 520, 380);
    press(cake, 'pointerup', 520, 380);
    expect(game.armedPower).toBe('gouter');
  }, 20_000);
});
