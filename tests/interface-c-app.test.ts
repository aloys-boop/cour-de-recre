// @vitest-environment jsdom
/**
 * v5.23 dans l’application complète : bande animée de l’accueil, carte d’équipe qui se retourne,
 * jauges qui se remplissent, son à chaque choix, bande arrêtée pendant la partie.
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


const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('interface c dans l’application', () => {
  it('accueil vivant, retournement, jauges, bande arrêtée en partie', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', difficultyScale: 2, tutorialSeen: true }));
    const main = await import('../src/main');
    const menu = main.__menu();
    const root = document.getElementById('menu')!;
    const canvas = root.querySelector('canvas.menu-backdrop') as HTMLCanvasElement;
    // La bande est en tête du menu, sous le contenu, jamais sous le doigt.
    expect(canvas).not.toBeNull();
    expect(root.firstElementChild).toBe(canvas);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.style.pointerEvents).toBe('none');
    expect(canvas.width).toBeGreaterThan(0);
    // Elle s'anime : des images sont dessinées et les élèves bougent.
    const f0 = menu.backdrop.frames;
    const xs = menu.backdrop.scene.kids.map((k) => k.x).join();
    await wait(1600);
    expect(menu.backdrop.frames).toBeGreaterThan(f0 + 5);
    expect(menu.backdrop.scene.kids.map((k) => k.x).join()).not.toBe(xs);
    // Un pixel au moins est peint (sol, élèves).
    const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 0) painted++;
    expect(painted).toBeGreaterThan(500);

    // Carte d'équipe : liseré et emblème à la couleur, jauges décalées.
    const card = root.querySelector('.team-profile') as HTMLElement;
    expect(card.dataset.team).toBe('0');
    expect(card.querySelector('.team-card-mark svg')).not.toBeNull();
    const on = [...card.querySelectorAll('.stat i.on')] as HTMLElement[];
    expect(on.length).toBe(12); // budget de 12 points
    expect(new Set(on.map((i) => i.style.animationDelay)).size).toBeGreaterThan(3);

    // Choisir les Verts : la carte se retourne (contenu changé à mi-course), l'élève vert saute.
    const green = [...root.querySelectorAll('.team-btn')].find((b) => b.textContent === 'Vert') as HTMLButtonElement;
    const kid = menu.backdrop.scene.kids.find((k) => k.team === 1);
    green.click();
    // Le contenu change tout de suite (rien n'attend l'animation), la carte arrive de la tranche.
    expect(card.dataset.team).toBe('1');
    expect(card.classList.contains('flip-in')).toBe(true);
    if (kid) expect(kid.hop).toBeGreaterThan(0);
    await wait(320);
    expect(card.classList.contains('flip-in')).toBe(false);
    expect(menu.state.team).toBe(1);
    // Retoucher la même équipe ne retourne rien.
    green.click();
    expect(card.classList.contains('flip-in')).toBe(false);

    // Deux choix rapides : seule la dernière équipe compte.
    const red = [...root.querySelectorAll('.team-btn')].find((b) => b.textContent === 'Rouge') as HTMLButtonElement;
    const blue = [...root.querySelectorAll('.team-btn')].find((b) => b.textContent === 'Bleu') as HTMLButtonElement;
    red.click();
    blue.click();
    expect(card.dataset.team).toBe('5');
    await wait(400);

    // Onglet Escarmouche : la carte des modes se retourne aussi.
    const skir = [...root.querySelectorAll('.mode-btn')].find((b) => b.textContent === 'Escarmouche') as HTMLButtonElement;
    skir.click();
    expect(menu.state.mode).toBe('escarmouche');
    expect(skir.classList.contains('active')).toBe(true);
    expect(skir.closest('.menu-section')!.querySelector(':scope > .flip-in:not(.hidden)')).not.toBeNull();
    expect(skir.classList.contains('flip-in')).toBe(false);
    await wait(400);

    // En partie, la bande s'arrête ; de retour au menu, elle repart.
    (root.querySelector('.btn-play') as HTMLButtonElement).click();
    expect(root.classList.contains('hidden')).toBe(true);
    const f1 = menu.backdrop.frames;
    await wait(300);
    expect(menu.backdrop.frames).toBe(f1);
    main.__game()?.destroy();
  }, 20000);
});
