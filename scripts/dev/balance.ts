// Équilibrage : victoires par couleur d'uniforme, toutes positions confondues (IA contre IA).
//   npx tsx scripts/dev/balance.ts [difficulté] [mode] [profils JSON] [graines]
//   mode « 4 »     : les 4 couleurs d'origine sur les cartes à 4 équipes (comme avant) ;
//   mode « 4mix »  : 4 couleurs tirées parmi les 8, cartes à 4 équipes ;
//   mode « 8 »     : les 8 couleurs sur « Le tournoi », rotation complète des positions ;
//   mode « 8d »    : idem avec la diplomatie des IA (alliances et trahisons).
// Répartitions de points de remplacement, en JSON : [[vie,dégâts,production,vitesse], ...] (index = couleur).
// Pour l'équilibrage des couleurs, voir plutôt scripts/dev/equilibre.ts (couleurs et positions au hasard).
import { TEAM_NAMES, TEAM_PROFILES } from '../../src/config';
import { TeamAi } from '../../src/core/ai';
import { Diplomacy } from '../../src/core/diplomacy';
import { generateMap, LEVELS } from '../../src/core/maps';
import type { Difficulty, MapDef } from '../../src/core/types';
import { World } from '../../src/core/world';

const diff: Difficulty = (process.argv[2] as Difficulty) ?? 'difficile';
const mode = process.argv[3] ?? '4';
if (process.argv[4] && process.argv[4] !== '-') {
  const over = JSON.parse(process.argv[4]) as number[][];
  over.forEach((o, i) => o && Object.assign(TEAM_PROFILES[i].points, { hp: o[0], dmg: o[1], prod: o[2], speed: o[3] }));
}
const seeds = (process.argv[5] ?? '3,11').split(',').map(Number);

const NC = TEAM_NAMES.length;
const wins = new Array<number>(NC).fill(0); // victoires (partagées : 1 / nombre d'alliés)
const games = new Array<number>(NC).fill(0); // parties jouées par couleur
const leads = new Array<number>(NC).fill(0); // parties non terminées : en tête au temps limite
let total = 0;
let unfinished = 0;
let totalTime = 0;
let stepMs = 0;
let steps = 0;
let maxUnits = 0;

function score(w: World, t: number): number {
  const s = w.stats()[t];
  return s.units + 2 * s.tiles + 6 * s.camps;
}

function play(map: MapDef, colors: number[], seed: number, diplomacy: boolean, limit: number): void {
  const world = new World(map, map.teams, seed, colors);
  const ais = colors.map((_, t) => new TeamAi(world, t, diff));
  const dip = diplomacy ? new Diplomacy(world, diff, ais.map((a) => a.team), seed) : null;
  const step = 1 / 60;
  let t = 0;
  while (t < limit && world.victors().length === 0) {
    for (const a of ais) a.update(step);
    const s0 = performance.now();
    world.update(step);
    stepMs += performance.now() - s0;
    steps++;
    if (dip) {
      dip.update(step);
      dip.recordAll(world.drainEvents());
      dip.drainEvents();
    } else world.drainEvents();
    if (world.units.length > maxUnits) maxUnits = world.units.length;
    t += step;
  }
  for (const c of colors) games[c]++;
  const v = world.victors();
  if (v.length) for (const w of v) wins[colors[w]] += 1 / v.length;
  else {
    unfinished++;
    let best = 0;
    for (let k = 1; k < colors.length; k++) if (score(world, k) > score(world, best)) best = k;
    leads[colors[best]]++;
  }
  total++;
  totalTime += t;
}

if (mode === '8' || mode === '8d') {
  const map = generateMap(LEVELS[5], 105);
  for (let r = 0; r < 8; r++) {
    const colors = Array.from({ length: 8 }, (_, i) => (i + r) % 8);
    for (const seed of seeds) play(map, colors, seed, mode === '8d', 600);
  }
} else {
  const maps = LEVELS.map((l, i) => generateMap(l, 100 + i)).filter((m) => m.teams === 4);
  const rotations = [
    [0, 1, 2, 3],
    [1, 2, 3, 0],
    [2, 3, 0, 1],
    [3, 0, 1, 2],
    [0, 2, 1, 3],
    [3, 1, 0, 2],
  ];
  if (mode === '4mix') {
    // Toutes les combinaisons de 4 couleurs parmi 8 (70), positions décalées d'une combinaison à l'autre.
    let k = 0;
    for (let a = 0; a < NC; a++)
      for (let b = a + 1; b < NC; b++)
        for (let c = b + 1; c < NC; c++)
          for (let d = c + 1; d < NC; d++) {
            const base = [a, b, c, d];
            const colors = base.map((_, i) => base[(i + k) % 4]);
            const map = maps[k % maps.length];
            k++;
            for (const seed of seeds) play(map, colors, seed, false, 480);
          }
  } else {
    for (const map of maps) for (const rot of rotations) for (const seed of seeds) play(map, rot, seed, false, 480);
  }
}
const rates = wins.map((w, c) => (games[c] ? w / games[c] : 0));
const played = rates.filter((_, c) => games[c] > 0);
const mean = played.reduce((a, b) => a + b, 0) / played.length;
console.log(
  `difficulté ${diff}, mode ${mode}, ${total} parties (${unfinished} au temps limite), durée moyenne ${(totalTime / total).toFixed(0)} s, ` +
    `${(stepMs / steps).toFixed(3)} ms/pas (monde), max ${maxUnits} élèves`,
);
for (let c = 0; c < NC; c++) {
  if (!games[c]) continue;
  console.log(
    `${TEAM_NAMES[c].padEnd(7)} ${wins[c].toFixed(1).padStart(5)} victoires / ${String(games[c]).padStart(3)} parties ` +
      `(${(rates[c] * 100).toFixed(0).padStart(3)} %, ${(rates[c] / (mean || 1)).toFixed(2)} × la moyenne)` +
      (leads[c] ? `, en tête ${leads[c]} fois au temps limite` : ''),
  );
}
