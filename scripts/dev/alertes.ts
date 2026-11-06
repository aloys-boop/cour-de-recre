// Fréquence des alertes (v5.7) : parties IA contre IA, l'équipe 0 jouée par une IA Normal,
// on compte les alertes qu'elle aurait reçues.
//   npx tsx scripts/dev/alertes.ts [parties=20] [equipes=4]
import { AlertWatcher } from '../../src/core/alerts';
import { TeamAi } from '../../src/core/ai';
import { generateMap } from '../../src/core/mapgen';
import { skirmishLevel } from '../../src/core/skirmish';
import { World } from '../../src/core/world';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('='))) as Record<string, string>;
const games = Number(args.parties ?? 20);
const teams = Number(args.equipes ?? 4);
let minutes = 0;
const counts = { camp: 0, perdue: 0, attaque: 0 };
let grouped = 0;
const gaps: number[] = [];
for (let g = 0; g < games; g++) {
  const w = new World(generateMap(skirmishLevel({ teams, size: 1, tiles: 18 }), g + 1), teams, g + 1);
  const ais = Array.from({ length: teams }, (_, t) => new TeamAi(w, t, 'normal'));
  const watch = new AlertWatcher(w, 0);
  let last = 0;
  const dt = 1 / 20;
  while (w.time < 480 && w.victors().length === 0 && w.stats()[0].alive) {
    for (const a of ais) a.update(dt);
    w.update(dt);
    const al = watch.update(dt);
    if (al) {
      counts[al.kind]++;
      if (al.count > 1) grouped++;
      gaps.push(w.time - last);
      last = w.time;
    }
  }
  minutes += w.time / 60;
}
const total = counts.camp + counts.perdue + counts.attaque;
gaps.sort((a, b) => a - b);
console.log(`${games} parties, ${minutes.toFixed(1)} min : ${(total / minutes).toFixed(1)} alertes par minute (camp ${(counts.camp / minutes).toFixed(1)}, perdue ${(counts.perdue / minutes).toFixed(1)}, attaque ${(counts.attaque / minutes).toFixed(1)}), ${grouped} regroupées, écart médian ${gaps[Math.floor(gaps.length / 2)]?.toFixed(1)} s`);
