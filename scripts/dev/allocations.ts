// Allocations (v5.25) : qui crée des objets à chaque pas dans une partie au plafond ?
// Profil d'allocation échantillonné (objets ramassés compris), regroupé par fonction.
//   npx tsx scripts/dev/allocations.ts [secondes]
import { Session } from 'node:inspector/promises';
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
import { World } from '../../src/core/world';

const seconds = Number(process.argv[2] ?? 60);
const step = 1 / 60;
const level = LEVELS.findIndex((l) => l.teams === 8);
const base = generateMap(LEVELS[level], 21);
const world = new World({ ...base, startUnits: 30, spawnInterval: 1.2 }, 8, 21);
const ais = Array.from({ length: 8 }, (_, t) => new TeamAi(world, t, 'expert'));
const dip = new Diplomacy(world, 'expert', ais.map((a) => a.team), 21);
const tick = (): void => {
  for (const a of ais) a.update(step);
  world.update(step);
  dip.update(step);
  dip.recordAll(world.drainEvents());
  dip.drainEvents();
};
for (let t = 0; t < 2; t += step) tick(); // mise en route
const session = new Session();
session.connect();
await session.post('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
let steps = 0;
for (let t = 0; t < seconds && world.victors().length === 0; t += step, steps++) tick();
const { profile } = await session.post('HeapProfiler.stopSampling');
type Node = { callFrame: { functionName: string; url: string; lineNumber: number }; selfSize: number; children: Node[] };
const by = new Map<string, number>();
let total = 0;
const walk = (n: Node): void => {
  if (n.selfSize > 0) {
    const f = n.callFrame;
    const k = `${f.functionName || '(anonyme)'} ${f.url.replace(/.*\/src\//, 'src/')}:${f.lineNumber + 1}`;
    by.set(k, (by.get(k) ?? 0) + n.selfSize);
    total += n.selfSize;
  }
  n.children.forEach(walk);
};
walk(profile.head as unknown as Node);
console.log(`${steps} pas, ${(total / 1024 / 1024).toFixed(1)} Mo alloués, ${(total / steps / 1024).toFixed(1)} Ko par pas`);
for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[3] ?? 25))) console.log(`${((v / total) * 100).toFixed(1).padStart(5)} %  ${(v / steps).toFixed(0).padStart(7)} o/pas  ${k}`);
