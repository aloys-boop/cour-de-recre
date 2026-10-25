// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { Diplomacy } from '../src/core/diplomacy';
import { DiplomacyExtras } from '../src/core/diplomacy-extras';
import { normalizeRules, type GameRules } from '../src/core/rules';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';
import { DiplomacyExtrasHud, type ExtrasHost } from '../src/ui/diplomacy-extras';
import { Hud } from '../src/ui/hud';

beforeEach(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script'));
});

const ARENA: MapDef = {
  id: 'arene',
  name: 'Arène',
  w: 12,
  h: 12,
  teams: 3,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 10, y: 10, owner: 1 },
    { kind: 'camp', x: 0, y: 10, owner: 2 },
    { kind: 'bonus', x: 4, y: 4, suit: 'heart' },
  ],
};

function setup(rules: GameRules) {
  const world = new World(ARENA, 3, 2);
  world.rules = normalizeRules(rules);
  const dip = new Diplomacy(world, 'normal', [1, 2], 2);
  const extras = new DiplomacyExtras(world, dip, 0, 2);
  const host: ExtrasHost = { world, extras, selected: new Set<number>(), playerTeam: 0, paused: false, over: false };
  const hints: string[] = [];
  const root = document.getElementById('hud')!;
  const hud = new Hud(
    root,
    {
      onSelectAll: () => undefined,
      onCancel: () => undefined,
      onPause: () => undefined,
      onToggleSound: () => false,
      diplomacy: { view: (t) => dip.view(0, t), propose: (t) => void dip.propose(0, t), breakOff: (t) => void dip.requestBreak(0, t) },
    },
    false,
  );
  hud.show();
  hud.update(world, 0, 0);
  const ui = new DiplomacyExtrasHud(root, () => host, hud, (t) => hints.push(t));
  return { world, extras, host, hud, ui, hints };
}

describe('interface des options de diplomatie', () => {
  it('sans les options : pas de bouton SOS ni d’action supplémentaire dans le panneau', () => {
    const { ui } = setup({});
    expect(ui.sosBtn.classList.contains('hidden')).toBe(true);
    document.querySelectorAll<HTMLButtonElement>('#team-chips .chip')[1].click();
    expect(ui.panelBox.classList.contains('hidden')).toBe(true);
    expect(ui.offerCard.classList.contains('hidden')).toBe(true);
  });

  it('bouton SOS (≥ 44 px) avec recharge affichée', () => {
    const { world, ui, hints } = setup({ sos: true });
    world.setAllied(0, 1, true);
    for (let i = 0; i < 6; i++) world.spawnUnit(1, 10 + i * 0.2, 10, false);
    expect(ui.sosBtn.classList.contains('hidden')).toBe(false);
    const css = readFileSync(resolve(process.cwd(), 'src/ui/diplomacy-extras.css'), 'utf8');
    expect(css).toMatch(/\.sos-btn \{[^}]*width: 52px;[^}]*height: 52px;/s);
    ui.sosBtn.click();
    expect(hints[0]).toMatch(/^SOS ! 3 élèves \(les Verts\) viennent défendre ton camp\.$/);
    expect(ui.sosBtn.classList.contains('cooling')).toBe(true);
    expect(ui.sosBtn.querySelector('.sos-wait')!.textContent).toBe('60 s');
    expect(ui.sosBtn.querySelector('.sos-help')!.textContent).toBe('3');
  });

  it('panneau d’un allié : donner les élèves sélectionnés, céder une case', () => {
    const { world, host, ui, hints } = setup({ gifts: true });
    world.setAllied(0, 1, true);
    const u = world.spawnUnit(0, 2, 2, false);
    world.tiles[3].owner = 0;
    document.querySelectorAll<HTMLButtonElement>('#team-chips .chip')[1].click();
    expect(ui.panelBox.classList.contains('hidden')).toBe(false);
    const give = ui.panelBox.querySelector<HTMLButtonElement>('.diplo-give')!;
    const cede = ui.panelBox.querySelector<HTMLButtonElement>('.diplo-cede')!;
    expect(ui.panelBox.querySelector('.diplo-tribute')!.classList.contains('hidden')).toBe(true);
    give.click();
    expect(hints.pop()).toBe('Sélectionne d’abord les élèves à donner aux Verts.');
    host.selected.add(u.id);
    ui.refresh();
    expect(give.textContent).toBe('Donner 1 élève');
    give.click();
    expect(u.team).toBe(1);
    expect(cede.textContent).toBe('Céder une case ♥');
    cede.click();
    expect(world.tiles[3].owner).toBe(1);
  });

  it('tribut : bouton dans le panneau d’un ennemi, trêve visible sur la puce ; proposition d’une IA avec Accepter / Refuser', () => {
    const { world, extras, ui } = setup({ tribute: true });
    world.spawnUnit(1, 10, 10, false);
    world.spawnUnit(2, 1, 10, false);
    world.tiles[3].owner = 0;
    const chips = document.querySelectorAll<HTMLButtonElement>('#team-chips .chip');
    chips[1].click();
    const pay = ui.panelBox.querySelector<HTMLButtonElement>('.diplo-tribute')!;
    expect(pay.textContent).toBe('Payer un tribut ♥');
    pay.click();
    expect(world.tiles[3].owner).toBe(1);
    expect(chips[1].classList.contains('truce')).toBe(true);
    expect(chips[1].querySelector('.chip-truce-s')!.textContent).toBe('30');
    expect(pay.disabled).toBe(true);
    // Proposition des Jaunes (équipe 2) : carte non bloquante avec deux boutons.
    world.tiles[3].owner = 2;
    extras.offer = { from: 2, tile: world.tiles[3], expires: world.time + 8 };
    ui.refresh();
    expect(ui.offerCard.classList.contains('hidden')).toBe(false);
    expect(ui.offerCard.querySelector('.offer-text')!.textContent).toBe('Les Jaunes proposent un tribut : une case ♥ contre une trêve de 30 s.');
    ui.offerCard.querySelector<HTMLButtonElement>('.offer-accept')!.click();
    expect(world.tiles[3].owner).toBe(0);
    expect(extras.truceLeft(2)).toBeGreaterThan(29);
    expect(ui.offerCard.classList.contains('hidden')).toBe(true);
  });
});
