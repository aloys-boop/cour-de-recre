// Temps de simulation à 8 équipes, cour immense, avec et sans l'option « Surveillants ».
// Usage : npx tsx scripts/dev/perf-supervisors.ts [secondes]
import { TeamAi } from '../../src/core/ai';
import { generateMap } from '../../src/core/mapgen';
import { skirmishLevel } from '../../src/core/skirmish';
import { supervisorsOf, takeWhistles } from '../../src/core/supervisors';
import { World } from '../../src/core/world';

const seconds = Number(process.argv[2] ?? 180);
for (const on of [false, true]) {
  const map = generateMap(skirmishLevel({ teams: 8, size: 3, tiles: 28 }), 77);
  const world = new World(map, map.teams, 77);
  world.rules = { mode: 'classique', supervisors: on };
  const ais = Array.from({ length: map.teams }, (_, t) => new TeamAi(world, t, 'difficile'));
  const step = 1 / 60;
  let whistles = 0;
  let kos = 0;
  let maxUnits = 0;
  let worst = 0;
  const t0 = performance.now();
  let n = 0;
  for (let t = 0; t < seconds; t += step) {
    const a = performance.now();
    for (const ai of ais) ai.update(step);
    world.update(step);
    kos += world.drainEvents().filter((e) => e.kind === 'supKo').length;
    worst = Math.max(worst, performance.now() - a);
    whistles += takeWhistles(world);
    maxUnits = Math.max(maxUnits, world.units.length);
    n++;
  }
  const ms = performance.now() - t0;
  console.log(`surveillants ${on ? 'oui' : 'non'} (${supervisorsOf(world).length}) : ${(ms / n).toFixed(3)} ms/pas en moyenne, pire ${worst.toFixed(1)} ms, élèves max ${maxUnits}, coups de sifflet ${whistles}, surveillants mis KO ${kos}`);
}
