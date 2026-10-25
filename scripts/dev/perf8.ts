// Performances à 8 équipes : cour pleine (≈ 144 élèves), IA + diplomatie, temps par pas de simulation.
//   npx tsx scripts/dev/perf8.ts [secondes]
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';

const seconds = Number(process.argv[2] ?? 120);
for (const full of [false, true]) {
  const base = generateMap(LEVELS[5], 21);
  // « Pleine » : tous les élèves dès le départ et production rapide, pour rester au plafond.
  const map = full ? { ...base, startUnits: base.unitCap, spawnInterval: 1.5 } : base;
  const world = new World(map, 8, 21);
  const ais = Array.from({ length: 8 }, (_, t) => new TeamAi(world, t, 'difficile'));
  const dip = new Diplomacy(world, 'difficile', ais.map((a) => a.team), 21);
  const step = 1 / 60;
  let worst = 0;
  const all: number[] = [];
  let sum = 0;
  let n = 0;
  let units = 0;
  let maxUnits = 0;
  for (let t = 0; t < seconds && world.victors().length === 0; t += step) {
    const t0 = performance.now();
    for (const a of ais) a.update(step);
    world.update(step);
    dip.update(step);
    dip.recordAll(world.drainEvents());
    dip.drainEvents();
    const ms = performance.now() - t0;
    if (t > 1) worst = Math.max(worst, ms);
    all.push(ms);
    sum += ms;
    n++;
    units += world.units.length;
    maxUnits = Math.max(maxUnits, world.units.length);
  }
  all.sort((a, b) => a - b);
  const p99 = all[Math.floor(all.length * 0.99)];
  const over4 = all.filter((x) => x > 4).length;
  console.log(
    `${full ? 'cour pleine' : 'partie normale'} : ${(sum / n).toFixed(3)} ms/pas en moyenne (IA + monde + diplomatie), 99e centile ${p99.toFixed(2)} ms, pire pas ${worst.toFixed(2)} ms (${over4} pas > 4 ms sur ${all.length}), ` +
      `${(units / n).toFixed(0)} élèves en moyenne, max ${maxUnits}, plafond ${map.unitCap} × 8 = ${map.unitCap * 8}`,
  );
}
