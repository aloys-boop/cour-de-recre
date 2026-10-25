// Brouillard de guerre : rendu hors navigateur d'une partie (vue + mini-carte) et mesures.
// npx tsx scripts/dev/fog-check.ts [carte=5] [secondes=50]
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { fogFor } from '../../src/core/fog';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';
import { Camera } from '../../src/render/camera';
import { fogLayer } from '../../src/render/fog';
import { Minimap } from '../../src/render/minimap';
import { Renderer } from '../../src/render/renderer';

const OUT = process.env.OUT ?? '/tmp/claude-0/-home-claude/0bece804-9679-563f-be56-1ee9d238d3fa/scratchpad';
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;

const mapIdx = Number(process.argv[2] ?? 5);
const seconds = Number(process.argv[3] ?? 50);
const map = generateMap(LEVELS[mapIdx], 100 + mapIdx);
const world = new World(map, map.teams, 7, Array.from({ length: map.teams }, (_, i) => i));
world.rules = { mode: 'classique', fog: true };
const ais = Array.from({ length: map.teams }, (_, t) => new TeamAi(world, t, 'normal'));
const diplo = new Diplomacy(world, 'normal', ais.slice(1).map((a) => a.team), 7);
if (map.teams > 4) world.setAllied(0, 2, true);
const step = 1 / 60;
let simMs = 0;
let fogMs = 0;
let fogCount = 0;
for (let t = 0; t < seconds; t += step) {
  const a = performance.now();
  for (const ai of ais) ai.update(step);
  world.update(step);
  diplo.update(step);
  diplo.recordAll(world.drainEvents());
  diplo.drainEvents();
  const b = performance.now();
  // Comme la boucle de jeu : on demande la vue du joueur à chaque image (recalcul à 10 Hz).
  fogCount = fogFor(world, 0)!.computeCount;
  fogMs += performance.now() - b;
  simMs += b - a;
}
const frames = Math.round(seconds / step);
console.log(`cour ${map.w}×${map.h}, ${world.units.length} élèves ; ${frames} pas : simulation ${(simMs / frames).toFixed(3)} ms/pas (IA avec brouillard comprise)`);
console.log(`visibilité du joueur : ${fogCount} recalculs, ${(fogMs / frames).toFixed(4)} ms/image en moyenne`);
// Cour pleine : on complète chaque équipe jusqu'à son plafond, autour de ses élèves ou de son camp.
for (let t = 0; t < map.teams; t++) {
  const camp = world.camps.find((c) => c.owner === t) ?? world.camps[t];
  const own = world.units.filter((u) => u.team === t);
  for (let n = own.length; n < map.unitCap; n++) {
    const base = own.length ? own[n % own.length] : { x: camp.cx, y: camp.cy };
    world.spawnUnit(t, base.x + world.rng.next() * 3 - 1.5, base.y + world.rng.next() * 3 - 1.5, false);
  }
}
for (let i = 0; i < 30; i++) world.update(step);
if (map.teams > 4) world.setAllied(0, 2, true);
console.log(`cour pleine : ${world.units.length} élèves ; alliés du joueur :`, world.alliesOf(0), world.stats().map((s) => s.units));
// Coût d'un recalcul isolé, à cour pleine.
{
  const N = 2000;
  const a = performance.now();
  for (let i = 0; i < N; i++) fogFor(world, 0, true);
  console.log(`un recalcul de visibilité : ${((performance.now() - a) / N).toFixed(4)} ms`);
}

const W = 1170 / 2;
const H = 540 / 2;
const dpr = 2;
for (const [fog, zoom] of [[false, 1], [true, 1], [true, 1.6]] as const) {
  world.rules.fog = fog;
  const cv = createCanvas(W * dpr, H * dpr);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r = new Renderer(ctx, make);
  const cam = new Camera();
  cam.setMap(map.w, map.h);
  cam.setView(W, H);
  cam.fit();
  cam.zoom *= zoom;
  const home = world.camps.find((c) => c.owner === 0) ?? world.camps[0];
  if (zoom > 1) cam.centerOnGrid(home.cx + (map.w / 2 - home.cx) * 0.3, home.cy + (map.h / 2 - home.cy) * 0.3);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const draw = () => r.draw(world, cam, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: world.time });
  draw();
  const N = 30;
  const t1 = performance.now();
  for (let i = 0; i < N; i++) draw();
  const ms = (performance.now() - t1) / N;
  let syncMs = 0;
  if (fog) {
    const l = fogLayer(world, 0, make)!;
    const t2 = performance.now();
    for (let i = 0; i < 200; i++) {
      world.time += 1 / 60;
      l.sync();
    }
    syncMs = (performance.now() - t2) / 200;
  }
  console.log(`rendu ${fog ? 'avec' : 'sans'} brouillard : ${ms.toFixed(2)} ms/image${fog ? ` (fondu du calque : ${syncMs.toFixed(3)} ms/image)` : ''}`);
  // Mini-carte incrustée en haut à droite.
  (globalThis as unknown as { window: unknown }).window = { devicePixelRatio: dpr };
  const mc = createCanvas(1, 1) as unknown as HTMLCanvasElement & { style: Record<string, string> };
  mc.style = {};
  const mini = new Minimap(mc, 132, 76);
  mini.setMap(map.w, map.h);
  mini.draw(world, cam, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(mc as unknown as CanvasImageSource, cv.width - 132 * dpr - 12, 12);
  writeFileSync(`${OUT}/fog-m${mapIdx}-${fog ? 'brouillard' : 'clair'}-z${zoom}.png`, cv.toBuffer('image/png'));
}
console.log('images :', OUT);
