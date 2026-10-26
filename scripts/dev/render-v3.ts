// Aperçus des nouveautés v3 (fanions d'amélioration, gains de bons points…) rendus hors navigateur.
//   npx tsx scripts/dev/render-v3.ts <dossier de sortie>
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { TeamAi } from '../../src/core/ai';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';
import { Camera } from '../../src/render/camera';
import { Renderer } from '../../src/render/renderer';
import { MeritPopups } from '../../src/render/merits';
const OUT = process.argv[2];
const map = generateMap(LEVELS[2], 102);
const world = new World(map, 4, 7, [2, 0, 1, 3]);
const ais = [1, 2, 3].map((t) => new TeamAi(world, t, 'normal'));
for (let t = 0; t < 20; t += 1 / 60) { for (const a of ais) a.update(1 / 60); world.update(1 / 60); world.drainEvents(); }
const home = world.camps[0];
home.upgrades = { prod: 3, hp: 2, dmg: 1, def: 2 };
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
const cv = createCanvas(1170, 540);
const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
const r = new Renderer(ctx, make);
const cam = new Camera(); cam.setMap(map.w, map.h); cam.setView(585, 270); cam.fit(); cam.zoom *= 2.2; cam.centerOnGrid(home.cx + 1, home.cy - 1);
ctx.setTransform(2, 0, 0, 2, 0, 0);
r.draw(world, cam, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: 1 });
const g = new MeritPopups(); g.add(home.cx + 2, home.cy - 1, 10); g.update(0.3); g.draw(ctx, cam);
writeFileSync(`${OUT}/camp.png`, cv.toBuffer('image/png'));
