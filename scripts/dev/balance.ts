// Équilibrage : victoires par couleur d'uniforme, toutes positions confondues (IA contre IA).
import { TEAM_NAMES, TEAM_PROFILES } from '../../src/config';
import { TeamAi } from '../../src/core/ai';
import { generateMap, LEVELS } from '../../src/core/maps';
const MAPS = LEVELS.map((l, i) => generateMap(l, 100 + i));
import { NO_TEAM, type Difficulty } from '../../src/core/types';
import { World } from '../../src/core/world';

const rotations = [
  [0, 1, 2, 3],
  [1, 2, 3, 0],
  [2, 3, 0, 1],
  [3, 0, 1, 2],
  [0, 2, 1, 3],
  [3, 1, 0, 2],
];
const wins = [0, 0, 0, 0];
const diff: Difficulty = (process.argv[2] as Difficulty) ?? 'normal';
// Profils de remplacement, en JSON : [[hp,dmg,prod,speed], ...]
if (process.argv[3]) {
  const over = JSON.parse(process.argv[3]) as number[][];
  over.forEach((o, i) => Object.assign(TEAM_PROFILES[i], { hp: o[0], dmg: o[1], prod: o[2], speed: o[3] }));
}
let games = 0;
let totalTime = 0;
for (const map of MAPS.filter((m) => m.teams === 4)) {
  for (const rot of rotations) {
    for (const seed of [3, 11]) {
      const world = new World(map, 4, seed, rot);
      const ais = [0, 1, 2, 3].map((t) => new TeamAi(world, t, diff));
      const step = 1 / 60;
      let t = 0;
      while (t < 480 && world.winner() === NO_TEAM) {
        for (const a of ais) a.update(step);
        world.update(step);
        world.drainEvents();
        t += step;
      }
      const w = world.winner();
      if (w !== NO_TEAM) wins[rot[w]]++;
      games++;
      totalTime += t;
    }
  }
}
console.log(`difficulté ${diff}, ${games} parties, durée moyenne ${(totalTime / games).toFixed(0)} s`);
for (let c = 0; c < 4; c++) console.log(`${TEAM_NAMES[c].padEnd(7)} ${wins[c]} victoires`);
