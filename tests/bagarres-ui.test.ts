// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';
import type { Game } from '../src/game';
import { Camera } from '../src/render/camera';
import { BrawlHud } from '../src/ui/brawl-hud';

beforeEach(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script'));
});

const MAP: MapDef = {
  id: 'm',
  name: 'M',
  w: 30,
  h: 30,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 28, y: 28, owner: 1 },
  ],
};

describe('alerte de bagarre hors écran', () => {
  it('mini-barre en haut, flèche vers la bagarre, tap : la caméra glisse dessus', () => {
    const world = new World(MAP, 2, 1);
    const cam = new Camera();
    cam.setMap(30, 30);
    cam.setView(800, 400);
    cam.zoom = 2;
    cam.centerOnGrid(3, 3);
    const game = { world, cam, playerTeam: 0, over: false } as unknown as Game;
    const hud = new BrawlHud(document.getElementById('hud')!, () => game);
    hud.refresh();
    expect(hud.alerts.every((a) => a.classList.contains('hidden'))).toBe(true);
    // Bagarre loin de la vue.
    world.spawnUnit(0, 25, 20, false);
    world.spawnUnit(0, 25, 20.4, false);
    world.spawnUnit(1, 25.5, 20.2, false);
    world.update(1 / 60);
    hud.refresh();
    const a = hud.alerts[0];
    expect(a.classList.contains('hidden')).toBe(false);
    expect(a.querySelectorAll('.ba-bar i')).toHaveLength(2);
    expect(a.getAttribute('aria-label')).toMatch(/Bagarre hors de l’écran/);
    expect(a.querySelector<SVGElement>('.ba-arrow')!.style.transform).toMatch(/rotate\(-?\d+deg\)/);
    // Une bagarre d'autres équipes ne déclenche pas d'alerte : ici, seulement celle du joueur.
    expect(hud.alerts.filter((x) => !x.classList.contains('hidden'))).toHaveLength(1);
    a.click();
    expect(cam.gliding).toBe(true);
    for (let i = 0; i < 40; i++) cam.update(1 / 60);
    const p = cam.gridToScreen(world.brawls.list[0].x, world.brawls.list[0].y);
    expect(Math.abs(p.x - 400)).toBeLessThan(5);
    hud.refresh();
    expect(a.classList.contains('hidden')).toBe(true);
  });
});
