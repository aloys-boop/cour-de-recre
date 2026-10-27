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
const ais = [1, 2, 3].map((t) => new TeamAi(world, t, 'difficile'));
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

// Classes d'élèves : idle, marche, coup, KO, pour quatre directions, grossi ×3.
{
  const { buildSheet, FRAME_W, FRAME_H } = await import('../../src/render/sprites');
  const classes = ['eleve', 'costaud', 'sprinteur', 'infirmier'] as const;
  const frames = [0, 2, 6, 10];
  const dirs = [1, 3, 5, 7];
  for (const color of [0, 2, 5]) {
    const big = createCanvas(classes.length * frames.length * FRAME_W * 2, dirs.length * FRAME_H * 2);
    const c = big.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#d2d2d4';
    c.fillRect(0, 0, big.width, big.height);
    classes.forEach((cls, ci) => {
      const sheet = buildSheet(color, make, cls) as unknown as ReturnType<typeof createCanvas>;
      frames.forEach((f, fi) =>
        dirs.forEach((d, di) => c.drawImage(sheet, f * FRAME_W, d * FRAME_H, FRAME_W, FRAME_H, (ci * frames.length + fi) * FRAME_W * 2, di * FRAME_H * 2, FRAME_W * 2, FRAME_H * 2)),
      );
    });
    writeFileSync(`${OUT}/classes-${color}.png`, big.toBuffer('image/png'));
  }
  // Scène : un groupe mélangé, vue de jeu habituelle.
  const w2 = new World(map, 4, 9, [2, 0, 1, 3]);
  const camp = w2.camps[0];
  const mix = ['eleve', 'costaud', 'sprinteur', 'infirmier', 'eleve', 'costaud', 'sprinteur', 'eleve'] as const;
  mix.forEach((cls, i) => w2.spawnUnit(0, camp.cx + 2 + (i % 4) * 0.7, camp.cy - 1 + Math.floor(i / 4) * 0.8, false, undefined, cls));
  w2.update(1 / 60);
  const cv2 = createCanvas(1170, 540);
  const ctx2 = cv2.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r2 = new Renderer(ctx2, make);
  const cam2 = new Camera(); cam2.setMap(map.w, map.h); cam2.setView(585, 270); cam2.fit(); cam2.zoom *= 1.4; cam2.centerOnGrid(camp.cx + 3, camp.cy - 1);
  ctx2.setTransform(2, 0, 0, 2, 0, 0);
  r2.draw(w2, cam2, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: 1 });
  writeFileSync(`${OUT}/classes-scene.png`, cv2.toBuffer('image/png'));
}

// Pouvoirs et pion : zone visée, élèves figés, boules de neige en vol, pion devant son camp.
{
  const { castPower } = await import('../../src/core/powers');
  const { awardMerit } = await import('../../src/core/merits');
  const { buyPion } = await import('../../src/core/pion');
  const { PowerEffects, drawPowerAim } = await import('../../src/render/powers');
  const w3 = new World(map, 4, 11, [2, 0, 1, 3]);
  const camp = w3.camps[0];
  awardMerit(w3, 0, 500, 0, 0, 'hold');
  buyPion(w3, 0, camp);
  for (let i = 0; i < 8; i++) w3.spawnUnit(1, camp.cx + 3 + (i % 4) * 0.5, camp.cy - 1 + Math.floor(i / 4) * 0.6, false);
  for (let i = 0; i < 4; i++) w3.spawnUnit(0, camp.cx + 2.2, camp.cy - 1.2 + i * 0.5, false);
  w3.update(1 / 60);
  castPower(w3, 0, 'sonnerie', camp.cx + 3.6, camp.cy - 0.7);
  const fx = new PowerEffects();
  fx.add('neige', camp.cx + 4, camp.cy + 2, 1.8, 0, () => 0.37);
  fx.update(0.35);
  for (let i = 0; i < 10; i++) w3.update(1 / 60);
  const cv3 = createCanvas(1170, 540);
  const ctx3 = cv3.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r3 = new Renderer(ctx3, make);
  const cam3 = new Camera(); cam3.setMap(map.w, map.h); cam3.setView(585, 270); cam3.fit(); cam3.zoom *= 1.5; cam3.centerOnGrid(camp.cx + 2.5, camp.cy);
  ctx3.setTransform(2, 0, 0, 2, 0, 0);
  r3.draw(w3, cam3, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: 1 });
  drawPowerAim(ctx3, cam3, w3, 'gouter', { x: camp.cx + 2.2, y: camp.cy - 0.5 }, 0, 1, false);
  fx.draw(ctx3, cam3);
  writeFileSync(`${OUT}/powers.png`, cv3.toBuffer('image/png'));
}

// Barre de bagarre : deux mêlées (dont une à trois équipes), tendance visible.
{
  const { BrawlBars } = await import('../../src/render/brawls');
  const w4 = new World(map, 4, 13, [2, 0, 1, 3]);
  const cx = map.w / 2;
  const cy = map.h / 2;
  for (let i = 0; i < 6; i++) w4.spawnUnit(0, cx - 0.4 + (i % 3) * 0.35, cy - 0.5 + Math.floor(i / 3) * 0.5, false);
  for (let i = 0; i < 4; i++) w4.spawnUnit(1, cx + 0.5 + (i % 2) * 0.35, cy - 0.3 + Math.floor(i / 2) * 0.5, false);
  for (let i = 0; i < 3; i++) w4.spawnUnit(2, cx + 3 + i * 0.3, cy + 2.5, false);
  for (let i = 0; i < 3; i++) w4.spawnUnit(3, cx + 3.4 + i * 0.3, cy + 3, false);
  for (let i = 0; i < 150; i++) w4.update(1 / 60);
  const cv4 = createCanvas(1170, 540);
  const ctx4 = cv4.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r4 = new Renderer(ctx4, make);
  const cam4 = new Camera(); cam4.setMap(map.w, map.h); cam4.setView(585, 270); cam4.fit(); cam4.zoom *= 1.6; cam4.centerOnGrid(cx + 1.5, cy + 1);
  ctx4.setTransform(2, 0, 0, 2, 0, 0);
  r4.draw(w4, cam4, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: 1 });
  new BrawlBars().draw(ctx4, w4, cam4, 0, 1, 1);
  writeFileSync(`${OUT}/brawls.png`, cv4.toBuffer('image/png'));
}

// Pastilles des camps : type produit et pion (debout, puis KO avec sa recharge).
{
  const { awardMerit } = await import('../../src/core/merits');
  const { buyPion, pionOf } = await import('../../src/core/pion');
  const w5 = new World(map, 4, 17, [2, 0, 1, 3]);
  awardMerit(w5, 0, 500, 0, 0, 'hold');
  w5.teamUpgrades[0].classes = true;
  w5.camps[2].owner = 0;
  w5.camps[0].produce = 'sprinteur';
  w5.camps[2].produce = 'infirmier';
  buyPion(w5, 0, w5.camps[0]);
  buyPion(w5, 0, w5.camps[2]);
  pionOf(w5, w5.camps[2])!.takeDamage(1000, 0, 0);
  w5.setCampRally(0, w5.camps[0], { x: w5.camps[0].cx + 3, y: w5.camps[0].cy - 2.5 });
  w5.setCampRally(0, w5.camps[2], { x: w5.camps[2].cx + 2.5, y: w5.camps[2].cy - 1 });
  for (let i = 0; i < 600; i++) w5.update(1 / 60);
  const cv5 = createCanvas(1170, 540);
  const ctx5 = cv5.getContext('2d') as unknown as CanvasRenderingContext2D;
  const r5 = new Renderer(ctx5, make);
  const cam5 = new Camera(); cam5.setMap(map.w, map.h); cam5.setView(585, 270); cam5.fit(); cam5.zoom *= 2; cam5.centerOnGrid(w5.camps[0].cx + 2, w5.camps[0].cy - 2);
  ctx5.setTransform(2, 0, 0, 2, 0, 0);
  r5.draw(w5, cam5, { selected: new Set(), markers: [], box: null, playerTeam: 0, time: 1, rallyLines: [w5.camps[0]] });
  writeFileSync(`${OUT}/badges.png`, cv5.toBuffer('image/png'));
}
