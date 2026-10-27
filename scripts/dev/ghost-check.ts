// Rendu hors navigateur d'une carte d'escarmouche avec camps fantômes (vérification visuelle).
// npx tsx scripts/dev/ghost-check.ts [équipes] [taille] [cases] [graine] [secondes]
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { TeamAi } from '../../src/core/ai';
import { ghostCamps, mapWithRules } from '../../src/core/ghosts';
import { encodeMapCode, type MapCode } from '../../src/core/mapcode';
import { World } from '../../src/core/world';
import { Camera } from '../../src/render/camera';
import { Minimap } from '../../src/render/minimap';
import { Renderer } from '../../src/render/renderer';

(globalThis as unknown as { window: unknown }).window ??= { devicePixelRatio: 2 };
const OUT = process.env.OUT ?? '/tmp/claude-0/-home-claude/0bece804-9679-563f-be56-1ee9d238d3fa/scratchpad';
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
const [teams, size, tiles, seed, seconds] = [4, 2, 18, 4242, 0].map((d, i) => Number(process.argv[2 + i] ?? d));

const code: MapCode = { spec: { kind: 'escarmouche', teams, size, tiles }, seed };
const map = mapWithRules(code, { ghostCamps: true });
console.log(`code ${encodeMapCode(code)}, cour ${map.w}×${map.h}, camps fantômes :`, ghostCamps(map.tiles).map((g) => `(${g.x}, ${g.y})`).join(' '));
const world = new World(map, map.teams, 7);
world.rules = { mode: 'classique', ghostCamps: true };
const ais = Array.from({ length: map.teams }, (_, t) => new TeamAi(world, t, 'difficile'));
const step = 1 / 60;
for (let t = 0; t < seconds; t += step) {
  for (const a of ais) a.update(step);
  world.update(step);
  world.drainEvents();
}
console.log('propriétaires des camps fantômes :', world.tiles.filter((t) => t.ghost).map((t) => t.owner));

for (const zoom of [1, 2.2]) {
  const W = 1170 / 2;
  const H = 540 / 2;
  const dpr = 2;
  const cv = createCanvas(W * dpr, H * dpr);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r = new Renderer(ctx, make);
  const cam = new Camera();
  cam.setMap(map.w, map.h);
  cam.setView(W, H);
  cam.fit();
  cam.zoom *= zoom;
  const g = world.tiles.find((t) => t.ghost)!;
  if (zoom > 1) cam.centerOnGrid(g.cx, g.cy);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  r.draw(world, cam, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: 1.3 });
  // Mini-carte en haut à droite.
  const mc = createCanvas(132 * dpr, 76 * dpr);
  (mc as unknown as { style: object }).style = {};
  const mini = new Minimap(mc as unknown as HTMLCanvasElement, 132, 76);
  mini.setMap(map.w, map.h);
  mini.draw(world, cam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(mc as unknown as CanvasImageSource, W * dpr - 132 * dpr - 8, 8);
  const file = `${OUT}/fantomes-${teams}e-t${seconds}-z${zoom}.png`;
  writeFileSync(file, cv.toBuffer('image/png'));
  console.log(file);
}
