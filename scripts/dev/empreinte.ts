// Empreinte d'une partie (v5.25) : même graine, même suite d'états ? Sert à vérifier qu'une
// optimisation ne change rien au jeu (comparer la sortie avant et après).
//   npx tsx scripts/dev/empreinte.ts [secondes]
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';

const seconds = Number(process.argv[2] ?? 60);
const step = 1 / 60;
for (const [teams, seed] of [[8, 21], [4, 5], [2, 9]] as const) {
  const level = LEVELS.findIndex((l) => l.teams === teams);
  const world = new World({ ...generateMap(LEVELS[level], seed), startUnits: 30, spawnInterval: 1.2 }, teams, seed);
  const ais = Array.from({ length: teams }, (_, t) => new TeamAi(world, t, 'expert'));
  const dip = new Diplomacy(world, 'expert', ais.map((a) => a.team), seed);
  let h = 0;
  for (let t = 0, k = 0; t < seconds && world.victors().length === 0; t += step, k++) {
    for (const a of ais) a.update(step);
    world.update(step);
    dip.update(step);
    dip.recordAll(world.drainEvents());
    dip.drainEvents();
    if (k % 60 === 0) for (const u of world.units) h = (Math.imul(h, 31) + Math.round(u.x * 1000) * 7 + Math.round(u.y * 1000) * 13 + u.hp + u.id) | 0;
  }
  console.log(`${teams} équipes, graine ${seed} : ${world.units.length} élèves, cases ${world.tiles.map((t) => t.owner).join('')}, empreinte ${h >>> 0}`);
}
