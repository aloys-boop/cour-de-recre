// Rendu hors navigateur d'une partie d'escarmouche avec l'option « Surveillants » :
// planche des surveillants, combat d'un groupe d'élèves contre un surveillant (zoomé), mini-carte.
// Usage : npx tsx scripts/dev/render-supervisors.ts [dossier de sortie] [secondes d'IA avant le combat]
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { TeamAi } from '../../src/core/ai';
import { generateMap } from '../../src/core/mapgen';
import { skirmishLevel } from '../../src/core/skirmish';
import { supervisorActive, supervisorsOf, takeWhistles, type Supervisor } from '../../src/core/supervisors';
import { World } from '../../src/core/world';
import { Camera } from '../../src/render/camera';
import { Minimap } from '../../src/render/minimap';
import { Renderer } from '../../src/render/renderer';
import { buildSheet } from '../../src/render/sprites';
import { buildSupervisorSheet } from '../../src/render/supervisors';

const OUT = process.argv[2] ?? '.';
const seconds = Number(process.argv[3] ?? 20);
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;

// 1) Planche : surveillants (8 directions × 10 images) à côté d'élèves, agrandie ×3.
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

// 2) Partie : 4 équipes, cour moyenne, IA partout pendant quelques secondes.
const map = generateMap(skirmishLevel({ teams: 4, size: 1, tiles: 16 }), 4242);
const world = new World(map, map.teams, 4242, [0, 1, 4, 5]);
world.rules = { mode: 'classique', supervisors: true };
const ais = [1, 2, 3].map((t) => new TeamAi(world, t, 'difficile'));
const step = 1 / 60;
let whistles = 0;
const t0 = Date.now();
let frames = 0;
for (let t = 0; t < seconds; t += step) {
  for (const a of ais) a.update(step);
  world.update(step);
  world.drainEvents();
  whistles += takeWhistles(world);
  frames++;
}

// 3) Mise en scène : 9 élèves Noirs (le joueur) chargent un surveillant ; un autre gît KO à côté.
const park = (s: Supervisor, x: number, y: number) => {
  s.x = x;
  s.y = y;
  s.mode = 'wait';
  s.timer = 1e6;
  s.path.length = 0;
  s.goal = null;
  s.hp = s.maxHp;
  s.anim = 'idle';
  s.targetId = -1;
  s.anchor = null;
};
const sups = supervisorsOf(world);
const boss = sups[0];
const c = world.grid.nearestFree(map.w / 2 + 2, map.h / 2 + 1);
park(boss, c.x + 0.5, c.y + 0.5);
// Les autres élèves s'écartent de la scène.
for (const u of world.units) if (Math.hypot(u.x - boss.x, u.y - boss.y) < 6) u.x = u.y = 0.6;
const squad = Array.from({ length: 9 }, (_, i) => {
  // Surtout par l'arrière (haut de l'écran), pour que le surveillant reste bien visible devant.
  const a = Math.PI * (0.85 + (i / 8) * 0.95);
  return world.spawnUnit(0, boss.x + Math.cos(a) * 2.8, boss.y + Math.sin(a) * 2.8, false);
});
world.orderAttackSupervisor(squad, boss);
const run = (until: () => boolean, max: number) => {
  for (let t = 0; t < max; t += step) {
    world.update(step);
    world.drainEvents();
    frames++;
    whistles += takeWhistles(world);
    if (until()) return true;
  }
  return false;
};
// Le combat s'engage ; le second surveillant, voisin, se fait achever par un autre élève Noir.
run(() => boss.hp < boss.maxHp * 0.8, 10);
if (sups[1]) {
  const k = world.grid.nearestFree(boss.x - 2.6, boss.y + 1.8);
  park(sups[1], k.x + 0.5, k.y + 0.5);
  sups[1].hp = 1;
  const hitter = world.spawnUnit(0, sups[1].x + 0.6, sups[1].y, false);
  world.orderAttackSupervisor([hitter], sups[1]);
}
// On s'arrête juste après l'impact d'un coup du surveillant, l'autre étendu au sol.
run(() => (!sups[1] || (sups[1].mode === 'ko' && sups[1].animTime > 0.5)) && boss.anim === 'punch' && boss.animTime > 0.29 && boss.animTime < 0.36, 10);
const ms = Date.now() - t0;
const alive = squad.filter((u) => u.alive).length;
console.log(
  `simulation : ${frames} pas en ${ms} ms, élèves ${world.units.length}, surveillants debout ${sups.filter(supervisorActive).length}/${sups.length}, coups de sifflet ${whistles}, PV du surveillant ${Math.round(boss.hp)}/${boss.maxHp}, élèves du groupe encore debout ${alive}/9`,
);

const W = 1170 / 2;
const H = 540 / 2;
const dpr = 2;
for (const zoom of [1, 2.2]) {
  const cv = createCanvas(W * dpr, H * dpr);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r = new Renderer(ctx, make);
  const cam = new Camera();
  cam.setMap(map.w, map.h);
  cam.setView(W, H);
  cam.fit();
  cam.zoom *= zoom;
  if (zoom > 1) cam.centerOnGrid(boss.x - 1, boss.y + 0.2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  r.draw(world, cam, { selected: new Set(squad.map((u) => u.id)), markers: [], box: null, playerTeam: 0, time: world.time });
  // Mini-carte incrustée en haut à gauche.
  const mm = createCanvas(132 * dpr, 76 * dpr);
  Object.assign(mm, { style: {} });
  (globalThis as unknown as { window: { devicePixelRatio: number } }).window = { devicePixelRatio: dpr };
  const mini = new Minimap(mm as unknown as HTMLCanvasElement, 132, 76);
  mini.setMap(map.w, map.h);
  mini.draw(world, cam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(mm as unknown as CanvasImageSource, 8 * dpr, 8 * dpr);
  writeFileSync(`${OUT}/supervisors-${zoom > 1 ? 'combat' : 'z1'}.png`, cv.toBuffer('image/png'));
}
console.log(`images : ${OUT}/supervisors-sheet.png, ${OUT}/supervisors-z1.png, ${OUT}/supervisors-combat.png`);
