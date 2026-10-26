// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { awardMerit } from '../src/core/merits';
import type { Tile } from '../src/core/tile';
import type { MapDef } from '../src/core/types';
import { buyUpgrade, type UpgradeBranch } from '../src/core/upgrades';
import { World } from '../src/core/world';
import type { Game } from '../src/game';
import { CampPanel } from '../src/ui/camp-panel';

beforeEach(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script'));
});

const ARENA: MapDef = {
  id: 'arene',
  name: 'Arène',
  w: 12,
  h: 12,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 10, y: 10, owner: 1 },
  ],
};

/** Partie minimale (ce que le panneau utilise de Game). */
function setup() {
  const world = new World(ARENA, 2, 2);
  const hints: string[] = [];
  let panel!: CampPanel;
  const game = {
    world,
    playerTeam: 0,
    mainCamp: () => world.tiles[0],
    openCamp: (c: Tile) => panel.open(c),
    upgradeCamp: (c: Tile, b: UpgradeBranch) => buyUpgrade(world, 0, c, b),
  } as unknown as Game;
  panel = new CampPanel(document.getElementById('hud')!, () => game, (t) => hints.push(t));
  return { world, panel, hints };
}

describe('panneau du camp', () => {
  it('la pastille affiche les bons points et ouvre le camp principal', () => {
    const { world, panel } = setup();
    awardMerit(world, 0, 42, 0, 0, 'hold');
    panel.refresh();
    expect(panel.pill.querySelector('.merit-count')!.textContent).toBe('42');
    expect(panel.pill.querySelector('svg')).not.toBeNull();
    panel.pill.click();
    expect(panel.panel.classList.contains('hidden')).toBe(false);
    expect(panel.openCamp).toBe(world.tiles[0]);
    panel.pill.click();
    expect(panel.panel.classList.contains('hidden')).toBe(true);
  });

  it('quatre branches, achat, niveau affiché en étoiles, refus faute de bons points', () => {
    const { world, panel, hints } = setup();
    panel.open(world.tiles[0]);
    const rows = panel.panel.querySelectorAll('.camp-row');
    expect([...rows].map((r) => r.querySelector('.camp-name')!.firstChild!.textContent)).toEqual(['Production', 'Uniformes', 'Entraînement', 'Défense']);
    const buy = rows[0].querySelector<HTMLButtonElement>('.camp-buy')!;
    expect(buy.textContent).toMatch(/25 ★/);
    buy.click();
    expect(hints.pop()).toMatch(/Pas assez de bons points/);
    awardMerit(world, 0, 100, 0, 0, 'hold');
    buy.click();
    expect(world.tiles[0].upgrades.prod).toBe(1);
    expect(rows[0].querySelector('.camp-level')!.textContent).toBe('★☆☆');
    expect(buy.textContent).toMatch(/50 ★/);
    expect(panel.panel.querySelector('.camp-balance')!.textContent).toBe('75 ★');
  });

  it('se ferme quand le camp est perdu', () => {
    const { world, panel, hints } = setup();
    panel.open(world.tiles[0]);
    world.tiles[0].owner = 1;
    panel.refresh();
    expect(panel.panel.classList.contains('hidden')).toBe(true);
    expect(hints.pop()).toMatch(/Camp perdu/);
  });
});
