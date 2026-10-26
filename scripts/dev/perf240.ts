// Performances au plafond : 8 équipes × 30 élèves (240 unités), temps par pas de simulation.
//   npx tsx scripts/dev/perf240.ts [secondes]
// Trois scénarios :
//  - « partie » : Le tournoi, IA Difficile + diplomatie, production accélérée pour rester près du plafond ;
//  - « mêlée » : 240 élèves lâchés au centre, tous au combat ;
//  - « ordres » : toutes les 0,5 s, tous les élèves reçoivent un nouvel ordre à l'autre bout de la cour
//    (rafale de recherches de chemin, le pire cas pour l'A*).
// Budget : une image à 60 i/s dure 16,7 ms ; on vise un pas de simulation sous 4 ms sur iPhone,
// soit environ 2 ms sur un ordinateur de bureau (Safari mobile est 2 à 3 fois plus lent que Node).
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';

const seconds = Number(process.argv[2] ?? 90);
const step = 1 / 60;

function report(name: string, all: number[], units: number[]): void {
  const s = all.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const p99 = s[Math.floor(s.length * 0.99)];
  const worst = s[s.length - 1];
  const over2 = s.filter((x) => x > 2).length;
  const avgU = units.reduce((a, b) => a + b, 0) / units.length;
  console.log(
    `${name.padEnd(8)} ${mean.toFixed(3)} ms/pas en moyenne, 99e centile ${p99.toFixed(2)} ms, pire ${worst.toFixed(2)} ms, ` +
      `${over2} pas > 2 ms sur ${s.length}, ${avgU.toFixed(0)} élèves en moyenne (max ${Math.max(...units)})`,
  );
}

function fill(world: World): void {
  for (let team = 0; team < 8; team++) {
    const camp = world.camps.find((c) => c.owner === team)!;
    while (world.teamUnitCount(team) < 30) {
      const a = Math.random() * Math.PI * 2;
      world.spawnUnit(team, camp.cx + Math.cos(a) * 1.5, camp.cy + Math.sin(a) * 1.5, false);
    }
  }
}

// 1) Partie au plafond.
{
  const base = generateMap(LEVELS[5], 21);
  const map = { ...base, startUnits: 30, spawnInterval: 1.2 };
  const world = new World(map, 8, 21);
  const ais = Array.from({ length: 8 }, (_, t) => new TeamAi(world, t, 'difficile'));
  const dip = new Diplomacy(world, 'difficile', ais.map((a) => a.team), 21);
  const all: number[] = [];
  const units: number[] = [];
  for (let t = 0; t < seconds && world.victors().length === 0; t += step) {
    const t0 = performance.now();
    for (const a of ais) a.update(step);
    world.update(step);
    dip.update(step);
    dip.recordAll(world.drainEvents());
    dip.drainEvents();
    const ms = performance.now() - t0;
    if (t > 1) {
      all.push(ms);
      units.push(world.units.length);
    }
  }
  report('partie', all, units);
}

// 2) Mêlée générale au centre.
{
  const map = generateMap(LEVELS[5], 33);
  const world = new World(map, 8, 33);
  fill(world);
  for (let team = 0; team < 8; team++) world.orderMove(world.units.filter((u) => u.team === team), { x: map.w / 2, y: map.h / 2 }, true);
  const all: number[] = [];
  const units: number[] = [];
  for (let t = 0; t < Math.min(seconds, 30); t += step) {
    const t0 = performance.now();
    world.update(step);
    world.drainEvents();
    all.push(performance.now() - t0);
    units.push(world.units.length);
  }
  report('mêlée', all, units);
}

// 3) Rafales d'ordres : 240 recherches de chemin d'un coup.
{
  const map = generateMap(LEVELS[5], 44);
  const world = new World(map, 8, 44);
  fill(world);
  const all: number[] = [];
  const units: number[] = [];
  let flip = false;
  for (let t = 0, k = 0; t < Math.min(seconds, 30); t += step, k++) {
    const t0 = performance.now();
    if (k % 30 === 0) {
      flip = !flip;
      for (let team = 0; team < 8; team++) {
        const camp = world.camps[(team + (flip ? 4 : 0)) % 8];
        world.orderMove(world.units.filter((u) => u.team === team), { x: camp.cx, y: camp.cy }, false);
      }
    }
    world.update(step);
    world.drainEvents();
    all.push(performance.now() - t0);
    units.push(world.units.length);
  }
  report('ordres', all, units);
}

// 4) Rendu d'une image (canvas @napi-rs, à titre comparatif) : cour pleine, vue d'ensemble puis zoomée.
{
  const { createCanvas } = await import('@napi-rs/canvas');
  const { Camera } = await import('../../src/render/camera');
  const { Renderer } = await import('../../src/render/renderer');
  const map = generateMap(LEVELS[5], 55);
  const world = new World(map, 8, 55);
  fill(world);
  for (let team = 0; team < 8; team++) world.orderMove(world.units.filter((u) => u.team === team), { x: map.w / 2, y: map.h / 2 }, true);
  for (let i = 0; i < 120; i++) world.update(step);
  const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
  for (const zoom of [1, 2]) {
    const cv = createCanvas(1170, 540);
    const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
    const r = new Renderer(ctx, make);
    const cam = new Camera();
    cam.setMap(map.w, map.h);
    cam.setView(585, 270);
    cam.fit();
    cam.zoom *= zoom;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const opts = { selected: new Set<number>(), markers: [], box: null, playerTeam: 0, time: 1 };
    for (let i = 0; i < 5; i++) r.draw(world, cam, opts);
    const t0 = performance.now();
    const N = 30;
    for (let i = 0; i < N; i++) r.draw(world, cam, opts);
    console.log(`rendu ×${zoom} ${((performance.now() - t0) / N).toFixed(2)} ms/image, ${world.units.length} élèves`);
  }
}
