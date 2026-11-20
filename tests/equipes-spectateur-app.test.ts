// @vitest-environment jsdom
/**
 * v5.16 dans l’application complète (jsdom + canvas réel) : mode Équipes, joueur KO qui reste
 * spectateur, accélère, regarde ses coéquipiers, puis partage leur victoire (ou quitte).
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


type G = NonNullable<ReturnType<typeof import('../src/main')['__game']>>;

function ko(u: { hp: number; state: string }): void {
  u.hp = 0;
  u.state = 'ko';
}

/** Le joueur (équipe 0) perd tous ses élèves et ses camps. */
function knockOutPlayer(game: G, foe: number): void {
  for (const u of game.world.units) if (u.team === 0) ko(u);
  for (const t of game.world.tiles) if (t.owner === 0) t.owner = foe;
}

describe('Mode Équipes, suite, dans l’application', () => {
  it('KO : spectateur, ×2, Regarder, puis victoire de l’équipe ; Rejouer, KO, Terminer', async () => {
    localStorage.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 1, wins: {}, muted: true, lastTeam: 0, lastDifficulty: 'normal', tutorialSeen: true }));
    const main = await import('../src/main');
    const menu = document.getElementById('menu')!;
    [...menu.querySelectorAll<HTMLButtonElement>('.mode-btn')].find((b) => b.textContent === 'Escarmouche')!.click();
    const teamRow = menu.querySelector('.team-mode')!;
    [...teamRow.querySelectorAll<HTMLButtonElement>('.opt-btn')].find((b) => b.textContent === 'Par 2')!.click();
    expect(menu.querySelector('.team-mode-desc')!.textContent).toMatch(/même si tu es KO/);
    (menu.querySelector('.btn-play') as HTMLButtonElement).click();

    let game = main.__game()!;
    game.stop();
    let now = performance.now();
    const advance = (s: number) => {
      for (let t = 0; t < s; t += 1 / 60) game.frame((now += 1000 / 60));
    };
    advance(0.3);
    const groups = game.teamGroups!;
    const mate = groups.findIndex((g, t) => t > 0 && g === 0);
    const foe = groups.findIndex((g) => g !== 0);
    const hud = document.getElementById('hud')!;
    const bar = document.getElementById('spectate-bar')!;
    expect(bar.classList.contains('hidden')).toBe(true);

    // KO : la partie continue, en spectateur.
    knockOutPlayer(game, foe);
    advance(0.1);
    expect(game.over).toBe(false);
    expect(game.spectating).toBe(true);
    expect(bar.classList.contains('hidden')).toBe(false);
    expect(hud.classList.contains('spectating')).toBe(true);
    expect(bar.textContent).toMatch(/Tu es KO/);
    expect(bar.textContent).toMatch(/jouent pour l’équipe/);
    // Les commandes de jeu sont masquées par la feuille de style (classe sur le HUD) ; pas de pouvoir possible.
    expect(game.beginPowerDrag('sonnerie')).toBe('recharge');

    // ×2 : deux fois plus de temps de jeu par seconde réelle.
    const fast = bar.querySelector<HTMLButtonElement>('.sp-fast')!;
    const t0 = game.world.time;
    advance(1);
    const normal = game.world.time - t0;
    fast.click();
    expect(fast.classList.contains('on')).toBe(true);
    const t1 = game.world.time;
    advance(1);
    expect((game.world.time - t1) / normal).toBeGreaterThan(1.8);

    // Regarder : la caméra glisse vers le coéquipier.
    bar.querySelector<HTMLButtonElement>('.sp-watch')!.click();
    expect(game.watchTeammate(false)).toBe(mate);

    // Les adversaires tombent : le coéquipier gagne, et toi avec lui.
    for (const u of game.world.units) if (groups[u.team] !== 0) ko(u);
    for (const t of game.world.tiles) if (t.isCamp) t.owner = mate;
    advance(0.1);
    expect(game.over).toBe(true);
    expect(game.sharedWin).toBe(true);
    await wait(2000);
    const overlay = document.getElementById('overlay')!;
    expect(overlay.querySelector('h2')!.textContent).toBe('Victoire de l’équipe\u00a0!');
    expect(overlay.textContent).toMatch(/tes coéquipiers ont tenu/);
    expect(overlay.querySelector('.end-stats table')).not.toBeNull();
    expect(bar.classList.contains('hidden')).toBe(true);
    expect(hud.classList.contains('spectating')).toBe(false);

    // Rejouer : nouvelle partie en équipes ; KO, puis « Terminer » : défaite avec statistiques.
    [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Rejouer')!.click();
    game = main.__game()!;
    game.stop();
    advance(0.3);
    expect(game.teamGroups).not.toBeNull();
    const foe2 = game.teamGroups!.findIndex((g) => g !== 0);
    knockOutPlayer(game, foe2);
    advance(0.1);
    expect(game.spectating).toBe(true);
    expect(game.spectateFast).toBe(false);
    expect(bar.querySelector('.sp-fast')!.classList.contains('on')).toBe(false);
    bar.querySelector<HTMLButtonElement>('.sp-leave')!.click();
    expect(game.over).toBe(true);
    expect(overlay.querySelector('h2')!.textContent).not.toMatch(/Victoire/);
    expect(overlay.textContent).toMatch(/quitté la partie avant la fin/);
    expect(overlay.querySelector('.end-stats table')).not.toBeNull();
  });

  it('partie libre : un joueur KO a perdu tout de suite (pas de spectateur)', async () => {
    const main = await import('../src/main');
    const overlay = document.getElementById('overlay')!;
    [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Menu')!.click();
    const menu = document.getElementById('menu')!;
    const teamRow = menu.querySelector('.team-mode')!;
    [...teamRow.querySelectorAll<HTMLButtonElement>('.opt-btn')].find((b) => b.textContent === 'Libre')!.click();
    (menu.querySelector('.btn-play') as HTMLButtonElement).click();
    const game = main.__game()!;
    game.stop();
    let now = performance.now();
    for (let t = 0; t < 0.3; t += 1 / 60) game.frame((now += 1000 / 60));
    expect(game.teamGroups).toBeNull();
    knockOutPlayer(game, 1);
    game.frame((now += 1000 / 60));
    game.frame((now += 1000 / 60));
    expect(game.spectating).toBe(false);
    expect(game.over).toBe(true);
  });
});
