// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateMap, LEVELS } from '../src/core/mapgen';
import { Diplomacy } from '../src/core/diplomacy';
import { World } from '../src/core/world';
import { Hud } from '../src/ui/hud';
import { Overlay } from '../src/ui/overlay';
import { Menu } from '../src/ui/menu';
import type { Progress } from '../src/core/save';

beforeEach(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script'));
});

function setupHud() {
  const map = generateMap(LEVELS[5], 3);
  const world = new World(map, 8, 3, [5, 0, 1, 2, 3, 4, 6, 7]);
  const dip = new Diplomacy(world, 'normal', [1, 2, 3, 4, 5, 6, 7], 3);
  const calls: string[] = [];
  const hud = new Hud(
    document.getElementById('hud')!,
    {
      onSelectAll: () => undefined,
      onCancel: () => undefined,
      onPause: () => undefined,
      onToggleSound: () => false,
      diplomacy: {
        view: (t) => dip.view(0, t),
        propose: (t) => {
          calls.push(`propose ${t}`);
          dip.propose(0, t);
        },
        breakOff: (t) => {
          calls.push(`rompre ${t}`);
          dip.requestBreak(0, t);
        },
      },
    },
    false,
  );
  hud.show();
  hud.update(world, 0, 0);
  return { world, dip, hud, calls };
}

describe('HUD à 8 équipes et diplomatie', () => {
  it('puces compactes (pastille + nombre), une par équipe, zones tactiles en boutons', () => {
    const { world } = setupHud();
    const chips = document.querySelectorAll<HTMLButtonElement>('#team-chips .chip');
    expect(chips).toHaveLength(8);
    expect(document.getElementById('team-chips')!.classList.contains('compact')).toBe(true);
    expect(chips[0].classList.contains('me')).toBe(true);
    expect(chips[0].querySelector('.chip-count')!.textContent).toBe(String(world.teamUnitCount(0)));
    for (const c of chips) expect(c.tagName).toBe('BUTTON');
  });

  it('toucher une puce ouvre le panneau « Diplomatie » ; proposer, puis la puce porte la marque d’alliance', () => {
    const { world, hud, calls } = setupHud();
    const chips = document.querySelectorAll<HTMLButtonElement>('#team-chips .chip');
    const panel = document.getElementById('diplo-panel')!;
    expect(panel.classList.contains('hidden')).toBe(true);
    chips[0].click(); // sa propre équipe : rien
    expect(panel.classList.contains('hidden')).toBe(true);
    chips[2].click();
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(panel.querySelector('.diplo-title')!.textContent).toBe('Diplomatie : les Verts');
    const action = panel.querySelector<HTMLButtonElement>('.diplo-action')!;
    expect(action.textContent).toBe('Proposer une alliance');
    action.click();
    expect(calls).toEqual(['propose 2']);
    expect(world.isAllied(0, 2)).toBe(true);
    hud.update(world, 0, 0);
    expect(chips[2].classList.contains('ally')).toBe(true);
    expect(chips[2].querySelector('.chip-ally svg')).not.toBeNull();
    // Rompre est possible seulement après le délai entre deux changements.
    expect(action.textContent).toMatch(/^Rompre \(dans \d+ s\)$/);
    expect(action.disabled).toBe(true);
    // Fermer.
    panel.querySelector<HTMLButtonElement>('.diplo-close')!.click();
    expect(panel.classList.contains('hidden')).toBe(true);
  });

  it('écran de fin : « Victoire de l’alliance ! » avec les couleurs alliées', () => {
    const overlay = new Overlay(document.getElementById('overlay')!);
    overlay.end(true, 'Le tournoi', { nextAvailable: false, onReplay: () => undefined, onNext: () => undefined, onMenu: () => undefined, alliance: [5, 1] });
    const card = document.querySelector('#overlay .card')!;
    expect(card.querySelector('h2')!.textContent).toBe('Victoire de l’alliance !');
    expect(card.querySelectorAll('.alliance-dot')).toHaveLength(2);
    expect(card.querySelector('p')!.textContent).toMatch(/^Les Bleus et les Verts gagnent ensemble\./);
    overlay.end(false, 'Le tournoi', { nextAvailable: false, onReplay: () => undefined, onNext: () => undefined, onMenu: () => undefined, alliance: [2, 3, 4] });
    expect(document.querySelector('#overlay .card p')!.textContent).toBe('L’alliance des Jaunes, des Violets et des Rouges l’emporte.');
  });

  it('menu : 8 couleurs au choix, escarmouche de 2 à 8 équipes, 6e niveau verrouillé', () => {
    const root = document.getElementById('menu')!;
    const p: Progress = { unlocked: 5, wins: {}, muted: false, lastTeam: 6, lastDifficulty: 'normal' };
    const played: unknown[] = [];
    new Menu(root, p, { onPlay: (s) => played.push(s), onToggleSound: () => false, onInstallHelp: () => undefined }).show();
    expect(root.querySelectorAll('.team-btn')).toHaveLength(8);
    expect(root.querySelector('.team-btn.active')!.textContent).toBe('Orange');
    const maps = root.querySelectorAll('.map-btn');
    expect(maps).toHaveLength(6);
    expect(maps[5].textContent).toMatch(/Le tournoi/);
    expect(maps[5].classList.contains('locked')).toBe(true);
    const teamOpts = [...root.querySelectorAll('.skirmish .opt-line')[0].querySelectorAll('.opt-btn')].map((b) => b.textContent);
    expect(teamOpts).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    // 8 équipes : au moins 20 cases bonus.
    (root.querySelectorAll('.mode-btn')[1] as HTMLButtonElement).click();
    (root.querySelectorAll('.skirmish .opt-btn')[6] as HTMLButtonElement).click();
    expect(root.querySelector('.stepper-value')!.textContent).toBe('20');
    (root.querySelector('.btn-play') as HTMLButtonElement).click();
    expect(played[0]).toMatchObject({ mode: 'escarmouche', team: 6, skirmish: { teams: 8, tiles: 20 } });
  });

  it('brouillard de guerre : effectif des ennemis masqué, le sien et ceux des alliés visibles', () => {
    const { world, hud } = setupHud();
    world.rules = { mode: 'classique', fog: true };
    world.setAllied(0, 1, true);
    hud.update(world, 0, 0);
    const counts = [...document.querySelectorAll('#team-chips .chip .chip-count')].map((e) => e.textContent);
    expect(counts[0]).toBe(String(world.teamUnitCount(0)));
    expect(counts[1]).toBe(String(world.teamUnitCount(1)));
    expect(counts.slice(2).every((c) => c === '?')).toBe(true);
  });
});
