// Rendu hors navigateur d'une partie d'escarmouche avec l'option « Surveillants »
// (planche des surveillants, scène de jeu zoomée sur un surveillant, mini-carte).
// Usage : npx tsx scripts/dev/render-supervisors.ts [dossier de sortie] [secondes]
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { TeamAi } from '../../src/core/ai';
import { generateMap } from '../../src/core/mapgen';
import { skirmishLevel } from '../../src/core/skirmish';
import { supervisorsOf, takeWhistles } from '../../src/core/supervisors';
import { World } from '../../src/core/world';
import { Camera } from '../../src/render/camera';
import { Minimap } from '../../src/render/minimap';
import { Renderer } from '../../src/render/renderer';
import { buildSheet } from '../../src/render/sprites';
import { buildSupervisorSheet } from '../../src/render/supervisors';

const OUT = process.argv[2] ?? '.';
const seconds = Number(process.argv[3] ?? 35);
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;

// 1) Planche : surveillants (8 directions × 6 images) à côté d'élèves, agrandie ×3.
{
  const sup = buildSupervisorSheet(make) as unknown as ReturnType<typeof createCanvas>;
  const stu = buildSheet(0, make) as unknown as ReturnType<typeof createCanvas>;
  const big = createCanvas((sup.width + 40 * 2) * 3, sup.height * 3);
  const c = big.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#d2d2d4';
  c.fillRect(0, 0, big.width, big.height);
  c.drawImage(sup, 0, 0, sup.width * 3, sup.height * 3);
  c.drawImage(stu, 0, 0, 80, stu.height, sup.width * 3, 0, 80 * 3, stu.height * 3);
  writeFileSync(`${OUT}/supervisors-sheet.png`, big.toBuffer('image/png'));
}

// 2) Partie : 4 équipes, grande cour, IA partout.
const map = generateMap(skirmishLevel({ teams: 4, size: 2, tiles: 18 }), 4242);
const world = new World(map, map.teams, 4242, [0, 1, 4, 5]);
world.rules = { mode: 'classique', supervisors: true };
const ais = [0, 1, 2, 3].map((t) => new TeamAi(world, t, 'normal'));
const step = 1 / 60;
let whistles = 0;
let punishedMax = 0;
const t0 = Date.now();
let frames = 0;
let best = { score: -1, time: 0 };
for (let t = 0; t < seconds; t += step) {
  for (const a of ais) a.update(step);
  world.update(step);
  world.drainEvents();
  whistles += takeWhistles(world);
  const punished = world.units.filter((u) => u.punishedUntil > world.time).length;
  punishedMax = Math.max(punishedMax, punished);
  frames++;
  // On s'arrête sur une image où un surveillant vient de siffler, à la fin.
  if (t > seconds * 0.6 && punished > best.score && supervisorsOf(world).some((s) => s.mode === 'whistle')) best = { score: punished, time: t };
  if (best.score >= 2 && t > best.time + 0.25 && t > seconds * 0.6) break;
}
const ms = Date.now() - t0;
console.log(`simulation : ${frames} pas en ${ms} ms (${(ms / frames).toFixed(3)} ms/pas), élèves ${world.units.length}, surveillants ${supervisorsOf(world).length}, coups de sifflet ${whistles}, punis au plus ${punishedMax}`);

const W = 1170 / 2;
const H = 540 / 2;
const dpr = 2;
const sups = supervisorsOf(world);
const focus = sups.find((s) => s.mode === 'whistle' || s.mode === 'wait') ?? sups[0];
for (const zoom of [1, 2]) {
  const cv = createCanvas(W * dpr, H * dpr);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r = new Renderer(ctx, make);
  const cam = new Camera();
  cam.setMap(map.w, map.h);
  cam.setView(W, H);
  cam.fit();
  cam.zoom *= zoom;
  if (zoom > 1) cam.centerOnGrid(focus.x, focus.y);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  r.draw(world, cam, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: world.time });
  // Mini-carte incrustée en haut à gauche.
  const mm = createCanvas(132 * dpr, 76 * dpr);
  Object.assign(mm, { style: {} });
  (globalThis as unknown as { window: { devicePixelRatio: number } }).window = { devicePixelRatio: dpr };
  const mini = new Minimap(mm as unknown as HTMLCanvasElement, 132, 76);
  mini.setMap(map.w, map.h);
  mini.draw(world, cam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(mm as unknown as CanvasImageSource, 8 * dpr, 8 * dpr);
  writeFileSync(`${OUT}/supervisors-z${zoom}.png`, cv.toBuffer('image/png'));
}
console.log(`images : ${OUT}/supervisors-sheet.png, ${OUT}/supervisors-z1.png, ${OUT}/supervisors-z2.png`);
