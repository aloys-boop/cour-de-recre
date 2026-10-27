// Simulation IA contre IA du mode « Roi de la cour » : durée des parties et façon dont elles se terminent.
// Usage : npx tsx scripts/dev/roi.ts [parties par configuration] [difficulté]
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { KING, withThrone } from '../../src/core/king';
import { generateMap } from '../../src/core/mapgen';
import { skirmishLevel, type SkirmishSettings } from '../../src/core/skirmish';
import type { Difficulty } from '../../src/core/types';
import { World } from '../../src/core/world';

const N = Number(process.argv[2] ?? 6);
const diff = (process.argv[3] ?? 'difficile') as Difficulty;
const CONFIGS: SkirmishSettings[] = [
  { teams: 2, size: 0, tiles: 10 },
  { teams: 4, size: 1, tiles: 18 },
  { teams: 6, size: 2, tiles: 22 },
  { teams: 8, size: 3, tiles: 28 },
];
const LIMIT = 1200;

for (const cfg of CONFIGS) {
  const rows: Array<{ t: number; how: string; victors: number[]; reign: number[] }> = [];
  for (let g = 0; g < N; g++) {
    const seed = 1000 + g * 37 + cfg.teams;
    const map = withThrone(generateMap(skirmishLevel(cfg), seed));
    const colors = Array.from({ length: 8 }, (_, i) => (i + g) % 8);
    const world = new World(map, map.teams, seed, colors);
    world.rules = { mode: 'roi' };
    const ais: TeamAi[] = [];
    for (let t = 0; t < map.teams; t++) {
      const ai = new TeamAi(world, t, diff);
      ais.push(ai);
      world.damageScale[t] = ai.profile.damage;
    }
    const diplo = new Diplomacy(world, diff, ais.map((a) => a.team), seed);
    const step = 1 / 60;
    let victors: number[] = [];
    while (world.time < LIMIT) {
      for (const a of ais) a.update(step);
      world.update(step);
      diplo.update(step);
      for (const ev of world.drainEvents()) diplo.record(ev);
      diplo.drainEvents();
      victors = world.victors();
      if (victors.length) break;
    }
    const how = world.king.winner >= 0 ? 'trône' : victors.length ? 'classique' : 'limite';
    rows.push({ t: world.time, how, victors, reign: world.king.reign.slice() });
  }
  const times = rows.map((r) => r.t).sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const count = (h: string) => rows.filter((r) => r.how === h).length;
  console.log(
    `${cfg.teams} équipes, cour ${cfg.size} : durée moy. ${mean.toFixed(0)} s, médiane ${times[Math.floor(times.length / 2)].toFixed(0)} s, ` +
      `min ${times[0].toFixed(0)} s, max ${times[times.length - 1].toFixed(0)} s ; trône ${count('trône')}, classique ${count('classique')}, limite ${count('limite')} (sur ${rows.length})`,
  );
  for (const r of rows) console.log(`   ${r.t.toFixed(0).padStart(4)} s  ${r.how.padEnd(9)} vainqueurs ${JSON.stringify(r.victors)}  règne ${r.reign.map((x) => (x ?? 0).toFixed(0)).join('/')} (objectif ${KING.winSeconds})`);
}
