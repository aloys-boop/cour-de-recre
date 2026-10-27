// Rendu hors navigateur pour vérification visuelle (sprites + une scène de jeu).
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { TEAM_COLORS } from '../../src/config';
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
const MAPS = LEVELS.map((l, i) => generateMap(l, 100 + i));
import { World } from '../../src/core/world';
import { Camera } from '../../src/render/camera';
import { Renderer } from '../../src/render/renderer';
import { buildSheet } from '../../src/render/sprites';

const OUT = '/tmp/claude-0/-home-claude/0bece804-9679-563f-be56-1ee9d238d3fa/scratchpad';
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;

// 1) Planches de sprites, agrandies ×3.
for (let t = 0; t < TEAM_COLORS.length; t++) {
  const sheet = buildSheet(t, make) as unknown as ReturnType<typeof createCanvas>;
  const big = createCanvas(sheet.width * 3, sheet.height * 3);
  const c = big.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#d9d9de';
  c.fillRect(0, 0, big.width, big.height);
  c.drawImage(sheet, 0, 0, big.width, big.height);
  writeFileSync(`${OUT}/sheet-${t}.png`, big.toBuffer('image/png'));
}

// 2) Scène de jeu : carte 3 (ou celle demandée), après 40 s de simulation avec IA.
//    Carte 6 (« Le tournoi ») : 8 équipes ; le joueur (équipe 0) est allié à l'équipe 2.
const mapIdx = Number(process.argv[2] ?? 2);
const seconds = Number(process.argv[3] ?? 40);
const map = MAPS[mapIdx];
const colors = map.teams > 4 ? Array.from({ length: map.teams }, (_, i) => i) : [2, 0, 1, 3];
const world = new World(map, map.teams, 7, colors);
const ais = Array.from({ length: map.teams - 1 }, (_, i) => i + 1).map((t) => new TeamAi(world, t, 'expert'));
const diplo = new Diplomacy(world, 'expert', ais.map((a) => a.team), 7);
if (map.teams > 4) world.setAllied(0, 2, true);
let maxUnits = 0;
const ai0 = new TeamAi(world, 0, 'difficile');
const step = 1 / 60;
const t0 = Date.now();
let frames = 0;
for (let t = 0; t < seconds; t += step) {
  ai0.update(step);
  for (const a of ais) a.update(step);
  world.update(step);
  diplo.update(step);
  diplo.recordAll(world.drainEvents());
  diplo.drainEvents();
  maxUnits = Math.max(maxUnits, world.units.length);
  frames++;
}
const ms = Date.now() - t0;
console.log(`simulation: ${frames} pas en ${ms} ms (${(ms / frames).toFixed(3)} ms/pas IA + monde), unités: ${world.units.length} (max ${maxUnits}), alliances:`, world.alliesOf(0), world.stats());

for (const zoom of [1, 1.8]) {
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
  const home = world.camps[0];
  if (zoom > 1) cam.centerOnGrid(home.cx + 2, home.cy - 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const selected = new Set(world.units.filter((u) => u.team === 0).slice(0, 5).map((u) => u.id));
  const t1 = Date.now();
  const N = 30;
  for (let i = 0; i < N; i++) {
    r.draw(world, cam, {
      selected,
      markers: [
        { x: home.cx + 2, y: home.cy, t: 0.2, kind: 'move', team: 2 },
        { x: home.cx + 1, y: home.cy + 1, t: 0.05, kind: 'hit', team: 2 },
      ],
      box: zoom > 1 ? { x0: 60, y0: 60, x1: 220, y1: 180 } : null,
      playerTeam: 0,
      time: 3,
    });
  }
  console.log(`rendu zoom ${zoom}: ${((Date.now() - t1) / N).toFixed(2)} ms/image`);
  writeFileSync(`${OUT}/scene-m${mapIdx}-z${zoom}.png`, cv.toBuffer('image/png'));
}
