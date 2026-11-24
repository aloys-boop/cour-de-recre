// Pointes du monde (v5.25) : dans les pas les plus lents de World.update, quelle étape coûte quoi,
// et combien de chemins A* ont été calculés ? Plusieurs graines, Le tournoi à 8 IA Expert.
//   npx tsx scripts/dev/pointes-monde.ts [secondes] [graines]
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
import { PerformanceObserver } from 'node:perf_hooks';
import { World } from '../../src/core/world';

const seconds = Number(process.argv[2] ?? 90);
const seeds = Number(process.argv[3] ?? 3);
const step = 1 / 60;
const level = LEVELS.findIndex((l) => l.teams === 8);
const P = World.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
const cur: Record<string, number> = {};
const wrap = (name: string): void => {
  const f = P[name];
  P[name] = function (this: unknown, ...a: unknown[]) {
    const t0 = performance.now();
    const r = f.apply(this, a);
    cur[name] = (cur[name] ?? 0) + performance.now() - t0;
    return r;
  };
};
const parts = ['flushPathQueue', 'rebuildHash', 'updateUnit', 'separate', 'updateTiles', 'removeDead'];
parts.forEach(wrap);
let paths = 0;
const cp = P.computePath;
P.computePath = function (this: { pathsThisStep: number }, ...a: unknown[]) {
  const before = this.pathsThisStep;
  const r = cp.apply(this, a);
  if (this.pathsThisStep > before) paths++;
  return r;
};
type Row = Record<string, number>;
// Ramasse-miettes : nombre de passages et durée cumulée (mineurs et majeurs).
const gc = { minor: 0, major: 0, ms: 0, worst: 0 };
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    const kind = (e as unknown as { detail?: { kind?: number } }).detail?.kind ?? 0;
    if (kind === 1) gc.minor++;
    else gc.major++;
    gc.ms += e.duration;
    gc.worst = Math.max(gc.worst, e.duration);
  }
}).observe({ entryTypes: ['gc'] });
let simSeconds = 0;
const rows: Row[] = [];
for (let s = 0; s < seeds; s++) {
  const seed = 21 + s * 7;
  const base = generateMap(LEVELS[level], seed);
  const world = new World({ ...base, startUnits: 30, spawnInterval: 1.2 }, 8, seed);
  const ais = Array.from({ length: 8 }, (_, t) => new TeamAi(world, t, 'expert'));
  const dip = new Diplomacy(world, 'expert', ais.map((a) => a.team), seed);
  for (let t = 0; t < seconds && world.victors().length === 0; t += step) {
    const t0 = performance.now();
    for (const a of ais) a.update(step);
    const ai = performance.now() - t0;
    for (const k of parts) cur[k] = 0;
    paths = 0;
    const t1 = performance.now();
    world.update(step);
    const w = performance.now() - t1;
    dip.update(step);
    dip.recordAll(world.drainEvents());
    dip.drainEvents();
    simSeconds += step;
    if (t > 1) rows.push({ ...cur, world: w, ai, total: performance.now() - t0, paths, units: world.units.length, t });
  }
}
await new Promise((r) => setTimeout(r, 50)); // les mesures du ramasse-miettes arrivent en différé
const pctOf = (k: string, q: number): number => {
  const v = rows.map((r) => r[k]).sort((a, b) => b - a);
  return v[Math.floor(v.length * (1 - q))] ?? 0;
};
console.log(`pas complet (IA + monde + diplomatie) : 99e centile ${pctOf('total', 0.99).toFixed(2)} ms, 99,9e ${pctOf('total', 0.999).toFixed(2)} ms ; IA 99e ${pctOf('ai', 0.99).toFixed(2)} ms`);
console.log(`ramasse-miettes : ${gc.minor} mineurs et ${gc.major} majeurs pour ${simSeconds.toFixed(0)} s de jeu, ${gc.ms.toFixed(0)} ms en tout, pire ${gc.worst.toFixed(2)} ms`);
rows.sort((a, b) => b.world - a.world);
const pct = (q: number): number => pctOf('world', q);
const top = rows.slice(0, Math.ceil(rows.length * 0.01));
const avg = (rs: Row[], k: string): number => rs.reduce((s, r) => s + (r[k] ?? 0), 0) / rs.length;
console.log(`${rows.length} pas ; monde : moyenne ${avg(rows, 'world').toFixed(3)} ms, 99e centile ${pct(0.99).toFixed(2)} ms, pire ${rows[0].world.toFixed(2)} ms`);
const cols = [...parts, 'paths', 'units'];
console.log('                 ' + cols.map((c) => c.slice(0, 10).padStart(11)).join(''));
console.log('1 % plus lents : ' + cols.map((c) => avg(top, c).toFixed(2).padStart(11)).join(''));
console.log('moyenne        : ' + cols.map((c) => avg(rows, c).toFixed(3).padStart(11)).join(''));
for (const r of rows.slice(0, 6)) console.log(`  t=${r.t.toFixed(1)} ${r.world.toFixed(2)} ms : ` + cols.map((c) => `${c} ${r[c].toFixed(2)}`).join(', '));
