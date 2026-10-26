// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { awardMerit } from '../src/core/merits';
import type { Tile } from '../src/core/tile';
import type { MapDef } from '../src/core/types';
import { buyClassUnlock, buyDefense, buyGlobal, type GlobalBranch } from '../src/core/upgrades';
import { World } from '../src/core/world';
import type { Game } from '../src/game';
import { CampPanel } from '../src/ui/camp-panel';
import { ClassSection } from '../src/ui/class-section';
import { PionSection } from '../src/ui/pion-section';
import { buyPion, PION } from '../src/core/pion';
import { setProduce, type UnitClass } from '../src/core/classes';

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
    buyTeamUpgrade: (b: GlobalBranch) => buyGlobal(world, 0, b),
    buyClasses: () => buyClassUnlock(world, 0),
    buyCampDefense: (c: Tile) => buyDefense(world, 0, c),
    focusCamp: () => undefined,
    buyCampPion: (c: Tile) => buyPion(world, 0, c),
    setCampProduce: (c: Tile, cls: UnitClass) => setProduce(world, 0, c, cls),
  } as unknown as Game;
  panel = new CampPanel(document.getElementById('hud')!, () => game, (t) => hints.push(t));
  panel.addSection(new ClassSection((t) => hints.push(t)));
  panel.addSection(new PionSection((t) => hints.push(t)));
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

  it('deux zones : « Toute l’équipe » (globales, classes) et « Ce camp » (Défense) ; achat, étoiles, refus', () => {
    const { world, panel, hints } = setup();
    panel.open(world.tiles[0]);
    const team = panel.panel.querySelector('.zone-team')!;
    const camp = panel.panel.querySelector('.zone-camp')!;
    const names = (z: Element) => [...z.querySelectorAll('.camp-row')].map((r) => r.querySelector('.camp-name')!.firstChild!.textContent);
    expect(names(team)).toEqual(['Production', 'Uniformes', 'Entraînement', 'Classes d’élèves']);
    expect(names(camp)).toEqual(['Défense']);
    const buy = team.querySelector<HTMLButtonElement>('.camp-row[data-branch="prod"] .camp-buy')!;
    expect(buy.textContent).toMatch(/50 ★/);
    buy.click();
    expect(hints.pop()).toMatch(/Pas assez de bons points/);
    awardMerit(world, 0, 200, 0, 0, 'hold');
    buy.click();
    expect(world.teamUpgrades[0].prod).toBe(1);
    expect(team.querySelector('.camp-row[data-branch="prod"] .camp-level')!.textContent).toBe('★☆☆');
    expect(buy.textContent).toMatch(/100 ★/);
    expect(panel.panel.querySelector('.camp-balance')!.textContent).toBe('150 ★');
    camp.querySelector<HTMLButtonElement>('.camp-buy')!.click();
    expect(world.tiles[0].defense).toBe(1);
    team.querySelector<HTMLButtonElement>('.camp-row[data-branch="classes"] .camp-buy')!.click();
    expect(world.teamUpgrades[0].classes).toBe(true);
    expect(team.querySelector('.camp-row[data-branch="classes"] .camp-buy')!.textContent).toBe('Débloquées');
  });

  it('navigation ‹ › entre ses camps sans fermer le panneau, « Camp 2/2 » et nom du camp', () => {
    const { world, panel } = setup();
    panel.open(world.tiles[0]);
    const label = () => panel.panel.querySelector('.camp-label')!.textContent;
    expect(label()).toBe('Camp 1/1 · Camp de départ');
    expect(panel.prevBtn.disabled).toBe(true);
    world.tiles[1].owner = 0;
    panel.refresh();
    expect(label()).toBe('Camp 1/2 · Camp de départ');
    panel.nextBtn.click();
    expect(panel.openCamp).toBe(world.tiles[1]);
    expect(label()).toMatch(/^Camp 2\/2 · Camp \w+/);
    expect(panel.panel.classList.contains('hidden')).toBe(false);
    panel.nextBtn.click();
    expect(panel.openCamp).toBe(world.tiles[0]);
    panel.prevBtn.click();
    expect(panel.openCamp).toBe(world.tiles[1]);
  });

  it('se ferme quand le dernier camp est perdu', () => {
    const { world, panel, hints } = setup();
    panel.open(world.tiles[0]);
    world.tiles[0].owner = 1;
    panel.refresh();
    expect(panel.panel.classList.contains('hidden')).toBe(true);
    expect(hints.pop()).toMatch(/Camp perdu/);
  });

  it('choix de la classe produite : verrouillée tant que l’équipe ne l’a pas débloquée, puis au choix', () => {
    const { world, panel, hints } = setup();
    panel.open(world.tiles[0]);
    const btns = panel.panel.querySelectorAll<HTMLButtonElement>('.class-btn');
    expect([...btns].map((b) => b.querySelector('.class-name')!.textContent)).toEqual(['Élève', 'Costaud', 'Sprinteur', 'Infirmier']);
    expect(btns[1].classList.contains('locked')).toBe(true);
    expect(panel.panel.querySelector('.class-note')!.textContent).toMatch(/À débloquer dans « Toute l’équipe »/);
    btns[1].click();
    expect(hints.pop()).toMatch(/Débloque d’abord les classes/);
    expect(world.tiles[0].produce).toBe('eleve');
    world.teamUpgrades[0].classes = true;
    panel.refresh();
    expect(btns[1].classList.contains('locked')).toBe(false);
    btns[1].click();
    expect(world.tiles[0].produce).toBe('costaud');
    expect(btns[1].classList.contains('active')).toBe(true);
    expect(btns[3].querySelector('.class-cost')!.textContent).toBe('6 ★ · 0/3');
  });

  it('un camp capturé : on y navigue, on y achète un pion et on choisit ce qu’il produit', () => {
    const { world, panel } = setup();
    world.teamUpgrades[0].classes = true;
    world.tiles[1].owner = 0;
    awardMerit(world, 0, PION.cost, 0, 0, 'hold');
    panel.open(world.tiles[0]);
    panel.nextBtn.click();
    expect(panel.openCamp).toBe(world.tiles[1]);
    const zone = panel.panel.querySelector('.zone-camp')!;
    zone.querySelectorAll<HTMLButtonElement>('.class-btn')[3].click();
    expect(world.tiles[1].produce).toBe('infirmier');
    expect(world.tiles[0].produce).toBe('eleve');
    zone.querySelector<HTMLButtonElement>('.pion-buy')!.click();
    expect(world.tiles[1].pionBought).toBe(true);
    expect(world.tiles[0].pionBought).toBe(false);
  });

  it('panneau : en-tête (et croix) fixe pendant le défilement, jamais de défilement horizontal', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/camp.css'), 'utf8');
    expect(css).toMatch(/\.camp-head \{[^}]*position: sticky;[^}]*top: 0;/s);
    expect(css).toMatch(/\.camp-panel \{[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/s);
    const { world, panel } = setup();
    panel.open(world.tiles[0]);
    expect(panel.panel.firstElementChild!.classList.contains('camp-head')).toBe(true);
    expect(panel.panel.querySelector('.camp-head .camp-close')).not.toBeNull();
  });
});
