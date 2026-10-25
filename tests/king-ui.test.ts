// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { KING, withThrone } from '../src/core/king';
import { generateMap } from '../src/core/mapgen';
import { skirmishLevel } from '../src/core/skirmish';
import { World } from '../src/core/world';
import { KingHud, kingEnd } from '../src/ui/king-hud';
import { Overlay } from '../src/ui/overlay';
import { rulesPanel } from '../src/ui/skirmish';

beforeEach(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script'));
});

function kingWorld(mode: 'roi' | 'classique' = 'roi'): World {
  const map = generateMap(skirmishLevel({ teams: 4, size: 1, tiles: 18 }), 5);
  const w = new World(mode === 'roi' ? withThrone(map) : map, 4, 5, [0, 1, 2, 3, 4, 5, 6, 7]);
  w.rules = { mode };
  return w;
}

describe('mode Roi de la cour : interface', () => {
  it('le menu d’escarmouche propose le mode Roi de la cour', () => {
    const rules = { mode: 'classique' as const } as { mode: 'classique' | 'roi' };
    const panel = rulesPanel(rules);
    const btn = [...panel.querySelectorAll('button')].find((b) => b.textContent === 'Roi de la cour')!;
    expect(btn).toBeTruthy();
    btn.click();
    expect(rules.mode).toBe('roi');
    expect(panel.textContent).toContain('trône');
  });

  it('compteurs de règne : toi, le meneur et le tenant du trône', () => {
    const hud = new KingHud(document.getElementById('hud')!);
    const el = document.querySelector('.king-hud')!;
    expect(el.parentElement!.classList.contains('hud-top-left')).toBe(true);
    hud.update(kingWorld('classique'), 0);
    expect(el.classList.contains('hidden')).toBe(true);
    const w = kingWorld();
    hud.update(w, 0);
    expect(el.classList.contains('hidden')).toBe(false);
    expect(el.textContent).toContain('Trône libre');
    expect(el.querySelectorAll('.king-row')).toHaveLength(1);
    w.king.reign[2] = 75;
    w.king.reign[0] = 12;
    w.king.find(w)!.owner = 3;
    hud.update(w, 0);
    const rows = [...el.querySelectorAll('.king-row')].map((r) => r.textContent);
    expect(rows).toEqual(['Toi0:12', 'Jaunes1:15', 'Violets0:00']);
    expect(el.textContent).toContain('Trône : Violets');
    expect(el.querySelectorAll('.king-row.holder')).toHaveLength(1);
  });

  it('écran de fin : « Roi de la cour ! » et temps de règne de chaque équipe', () => {
    const w = kingWorld();
    w.king.reign[0] = KING.winSeconds;
    w.king.reign[1] = 47;
    w.king.winner = 0;
    const k = kingEnd(w, 0)!;
    expect(k.winTitle).toBe('Roi de la cour !');
    const overlay = new Overlay(document.getElementById('overlay')!);
    overlay.end(true, 'Escarmouche', {
      nextAvailable: false,
      onReplay: () => undefined,
      onNext: () => undefined,
      onMenu: () => undefined,
      winText: k.winText,
      winTitle: k.winTitle,
      loseText: k.loseText,
      extras: [k.block],
    });
    const card = document.querySelector('#overlay .card')!;
    expect(card.querySelector('h2')!.textContent).toBe('Roi de la cour !');
    expect(card.textContent).toContain('tenu le trône 2 minutes');
    const items = [...card.querySelectorAll('.king-end-item')].map((i) => i.textContent);
    expect(items).toEqual(['Noir (toi) 2:00', 'Vert 0:47', 'Jaune 0:00', 'Violet 0:00']);
    // Défaite : le roi est nommé.
    const lose = kingEnd(w, 1)!;
    expect(lose.winTitle).toBeUndefined();
    expect(lose.loseText).toBe('Les Noirs ont tenu le trône 2 minutes : ils sont rois de la cour.');
    // Mode classique : rien de particulier.
    expect(kingEnd(kingWorld('classique'), 0)).toBeNull();
  });
});
