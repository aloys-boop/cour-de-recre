// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { awardMerit } from '../src/core/merits';
import { buyPion, PION } from '../src/core/pion';
import { castPower, POWERS, type PowerId } from '../src/core/powers';
import type { Tile } from '../src/core/tile';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';
import type { Game } from '../src/game';
import { CampPanel } from '../src/ui/camp-panel';
import { PionSection } from '../src/ui/pion-section';
import { PowersHud } from '../src/ui/powers-hud';

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

function setup() {
  const world = new World(ARENA, 2, 2);
  const hints: string[] = [];
  const game = {
    world,
    playerTeam: 0,
    paused: false,
    over: false,
    armedPower: null as PowerId | null,
    armPower(id: PowerId) {
      if (this.armedPower === id) return (this.armedPower = null), 'desarme';
      if (world.merits.points[0] < POWERS[id].cost) return 'pas-assez';
      this.armedPower = id;
      return 'arme';
    },
    mainCamp: () => world.tiles[0],
    openCamp: () => undefined,
    buyCampPion: (c: Tile) => buyPion(world, 0, c),
  };
  const hud = new PowersHud(document.getElementById('hud')!, () => game as unknown as Game, (t) => hints.push(t));
  return { world, game, hud, hints };
}

describe('interface des pouvoirs et du pion', () => {
  it('trois boutons (≥ 44 px) avec coût, armement, refus et recharge affichée', () => {
    const { world, game, hud, hints } = setup();
    expect([...hud.buttons.keys()]).toEqual(['sonnerie', 'neige', 'gouter']);
    const css = readFileSync(resolve(process.cwd(), 'src/ui/powers.css'), 'utf8');
    expect(css).toMatch(/\.power-btn \{[^}]*width: 54px;[^}]*height: 54px;/s);
    const bell = hud.buttons.get('sonnerie')!;
    expect(bell.querySelector('.power-cost')!.textContent).toBe(`${POWERS.sonnerie.cost} ★`);
    hud.refresh();
    expect(bell.classList.contains('poor')).toBe(true);
    bell.click();
    expect(hints.pop()).toMatch(/Pas assez de bons points/);
    awardMerit(world, 0, 200, 0, 0, 'hold');
    bell.click();
    expect(game.armedPower).toBe('sonnerie');
    expect(bell.classList.contains('armed')).toBe(true);
    expect(hints.pop()).toMatch(/touche la carte pour viser/);
    bell.click();
    expect(game.armedPower).toBeNull();
    castPower(world, 0, 'neige', 5, 5);
    hud.refresh();
    const snow = hud.buttons.get('neige')!;
    expect(snow.classList.contains('cooling')).toBe(true);
    expect(snow.querySelector('.power-wait')!.textContent).toBe(`${POWERS.neige.cooldown} s`);
  });

  it('rubrique Pion : achat, état et retour après un KO', () => {
    const { world, game, hints } = setup();
    const panel = new CampPanel(document.getElementById('hud')!, () => game as unknown as Game, (t) => hints.push(t));
    panel.addSection(new PionSection((t) => hints.push(t)));
    panel.open(world.tiles[0]);
    const btn = panel.panel.querySelector<HTMLButtonElement>('.pion-buy')!;
    expect(btn.textContent).toBe(`Engager · ${PION.cost} ★`);
    btn.click();
    expect(hints.pop()).toMatch(/Pas assez/);
    awardMerit(world, 0, PION.cost, 0, 0, 'hold');
    btn.click();
    expect(btn.disabled).toBe(true);
    expect(panel.panel.querySelector('.pion-status')!.textContent).toMatch(/garde le camp \(400 \/ 400 PV\)/);
    world.units.find((u) => u.pion)!.takeDamage(1000, 0, 0);
    for (let i = 0; i < 120; i++) world.update(1 / 60);
    panel.refresh();
    expect(panel.panel.querySelector('.pion-status')!.textContent).toMatch(/Pion KO : retour dans 5\d s/);
  });
});
