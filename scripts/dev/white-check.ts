// Comparaison Blanc / Rose pour la 8e couleur (rendu hors navigateur).
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { TEAM_COLORS } from '../../src/config';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';
import { Camera } from '../../src/render/camera';
import { Renderer } from '../../src/render/renderer';

const OUT = process.argv[2] ?? '.';
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
const WHITE = { light: '#ffffff', main: '#f4f4f6', dark: '#b9b9c2', ui: '#f2f2f4', text: '#2b2b33' };
for (const variant of ['blanc', 'rose']) {
  if (variant === 'blanc') Object.assign(TEAM_COLORS[7] as object, WHITE);
  else Object.assign(TEAM_COLORS[7] as object, { light: '#ffb3d9', main: '#ec6fae', dark: '#a83d74', ui: '#e46aa8', text: '#2b2b33' });
  const map = generateMap(LEVELS[5], 3);
  const world = new World(map, 8, 1);
  // L'équipe 7 possède quelques cases bonus proches de son camp.
  const camp = world.tiles.find((t) => t.isCamp && t.owner === 7)!;
  const near = world.tiles.filter((t) => !t.isCamp).sort((a, b) => Math.hypot(a.cx - camp.cx, a.cy - camp.cy) - Math.hypot(b.cx - camp.cx, b.cy - camp.cy));
  near.slice(0, 3).forEach((t) => (t.owner = 7));
  const W = 585, H = 270;
  const cv = createCanvas(W * 2, H * 2);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const r = new Renderer(ctx, make);
  const cam = new Camera();
  cam.setMap(map.w, map.h);
  cam.setView(W, H);
  cam.fit();
  cam.zoom *= 1.6;
  cam.centerOnGrid(camp.cx + 2, camp.cy - 1);
  r.draw(world, cam, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: 1 });
  writeFileSync(`${OUT}/couleur-${variant}.png`, cv.toBuffer('image/png'));
}
