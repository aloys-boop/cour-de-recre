// Pointes de la simulation (v5.24) : dans une partie au plafond (Le tournoi, 8 IA Expert,
// diplomatie), qui coûte quoi dans les pas les plus lents (IA, monde, diplomatie) ?
//   npx tsx scripts/dev/pointes.ts [secondes]
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';

const seconds = Number(process.argv[2] ?? 90);
const step = 1 / 60;
const level = LEVELS.findIndex((l) => l.teams === 8);
const base = generateMap(LEVELS[level], 21);
const world = new World({ ...base, startUnits: 30, spawnInterval: 1.2 }, 8, 21);
const ais = Array.from({ length: 8 }, (_, t) => new TeamAi(world, t, 'expert'));
const dip = new Diplomacy(world, 'expert', ais.map((a) => a.team), 21);
type Row = { total: number; ai: number; aiMax: number; world: number; dip: number; t: number };
const rows: Row[] = [];
for (let t = 0; t < seconds && world.victors().length === 0; t += step) {
  const t0 = performance.now();
  let aiMax = 0;
  for (const a of ais) {
    const a0 = performance.now();
    a.update(step);
    aiMax = Math.max(aiMax, performance.now() - a0);
  }
  const t1 = performance.now();
  world.update(step);
  const t2 = performance.now();
  dip.update(step);
  dip.recordAll(world.drainEvents());
  dip.drainEvents();
  const t3 = performance.now();
  if (t > 1) rows.push({ total: t3 - t0, ai: t1 - t0, aiMax, world: t2 - t1, dip: t3 - t2, t });
}
rows.sort((a, b) => b.total - a.total);
const top = rows.slice(0, Math.ceil(rows.length * 0.01));
const sum = (k: keyof Row) => top.reduce((s, r) => s + (r[k] as number), 0) / top.length;
const all = (k: keyof Row) => rows.reduce((s, r) => s + (r[k] as number), 0) / rows.length;
console.log(`${rows.length} pas ; 1 % les plus lents (${top.length}) : total ${sum('total').toFixed(2)} ms, IA ${sum('ai').toFixed(2)} (une IA au plus ${sum('aiMax').toFixed(2)}), monde ${sum('world').toFixed(2)}, diplomatie ${sum('dip').toFixed(2)}`);
console.log(`moyenne : total ${all('total').toFixed(3)} ms, IA ${all('ai').toFixed(3)}, monde ${all('world').toFixed(3)}, diplomatie ${all('dip').toFixed(3)}`);
for (const r of rows.slice(0, 8)) console.log(`  t=${r.t.toFixed(2)} s : ${r.total.toFixed(2)} ms (IA ${r.ai.toFixed(2)}, une IA ${r.aiMax.toFixed(2)}, monde ${r.world.toFixed(2)}, diplo ${r.dip.toFixed(2)})`);
