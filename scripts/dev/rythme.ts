// Durée des parties IA contre IA sur plusieurs graines, avec ou sans rythme de partie (argument « off »).
import { RHYTHM } from '../../src/config';
import { TeamAi } from '../../src/core/ai';
import { generateMap, LEVELS } from '../../src/core/maps';
import { NO_TEAM, type Difficulty } from '../../src/core/types';
import { World } from '../../src/core/world';
if (process.argv[2] === 'off') { RHYTHM.goldenFirstAt = 1e9; RHYTHM.noCampDrainPerSec = 0; }
for (const d of ['facile', 'normal', 'difficile'] as Difficulty[]) {
  const times: number[] = []; let unfinished = 0; let goldenCaps = 0;
  for (let li = 0; li < LEVELS.length; li++) for (let s = 1; s <= 8; s++) {
    const map = generateMap(LEVELS[li], 1000 + s * 7 + li);
    const w = new World(map, map.teams, s);
    const ais = []; for (let t = 0; t < map.teams; t++) ais.push(new TeamAi(w, t, d));
    let t = 0;
    while (t < 600 && w.winner() === NO_TEAM) { for (const a of ais) a.update(1/60); w.update(1/60);
      for (const e of w.drainEvents()) if (e.kind === 'captured' && w.rhythm.golden && e.x === w.rhythm.golden.cx && e.y === w.rhythm.golden.cy) goldenCaps++;
      t += 1/60; }
    if (w.winner() === NO_TEAM) unfinished++;
    times.push(t);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`${d.padEnd(9)} n=${times.length} moyenne ${mean.toFixed(0)} s, médiane ${times[times.length>>1].toFixed(0)} s, min ${times[0].toFixed(0)}, max ${times[times.length-1].toFixed(0)}, non finies ${unfinished}, captures de case dorée ${goldenCaps}`);
}
