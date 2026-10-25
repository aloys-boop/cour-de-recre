// Simulation IA contre IA pour vérifier l'équilibrage et les performances.
import { TeamAi } from '../../src/core/ai';
import { generateMap, LEVELS } from '../../src/core/maps';
const MAPS = LEVELS.map((l, i) => generateMap(l, 100 + i));
import { NO_TEAM, type Difficulty } from '../../src/core/types';
import { World } from '../../src/core/world';

const diffs: Difficulty[] = ['facile', 'normal', 'difficile'];
for (const map of MAPS) {
  for (const d of diffs) {
    const world = new World(map, map.teams, 11);
    const ais = [];
    for (let t = 0; t < map.teams; t++) ais.push(new TeamAi(world, t, d));
    const step = 1 / 60;
    let t = 0;
    let maxUnits = 0;
    let stepMs = 0;
    let steps = 0;
    const t0 = performance.now();
    while (t < 600 && world.winner() === NO_TEAM) {
      for (const a of ais) a.update(step);
      const s0 = performance.now();
      world.update(step);
      stepMs += performance.now() - s0;
      steps++;
      world.drainEvents();
      maxUnits = Math.max(maxUnits, world.units.length);
      t += step;
    }
    const total = (performance.now() - t0) / 1000;
    console.log(
      `${map.name.padEnd(16)} ${d.padEnd(9)} fin à ${t.toFixed(0).padStart(3)} s, gagnant ${world.winner()}, max unités ${maxUnits}, ` +
        `${(stepMs / steps).toFixed(3)} ms/pas monde, ${total.toFixed(1)} s réels, stats ${JSON.stringify(world.stats().map((s) => [s.units, s.tiles]))}`,
    );
  }
}
