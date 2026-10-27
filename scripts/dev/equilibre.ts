// Équilibrage des couleurs (budget de 12 points) : parties IA contre IA en difficulté égale,
// couleurs et positions de départ tirées au hasard, réparties sur plusieurs processus.
//   npx tsx scripts/dev/equilibre.ts [clé=valeur ...]
//     equipes=4        nombre d'équipes (2 à 8)
//     parties=2000     nombre de parties
//     diff=normal      difficulté de toutes les IA
//     graine=1         graine du tirage (cartes, couleurs, positions)
//     valeurs='{"speed":[0.85,0.92,1,1.08,1.16]}'  table de valeur d'un point (remplace STAT_POINT_VALUES)
//     limite=480       durée maximale d'une partie (s) ; au-delà, l'équipe en tête l'emporte
//     processus=4      nombre de processus
// Une partie sans vainqueur au temps limite est attribuée à l'équipe en tête (élèves + cases + camps).
import { fork } from 'node:child_process';
import { STAT_POINT_VALUES, TEAM_NAMES, type TeamStat } from '../../src/config';
import { TeamAi } from '../../src/core/ai';
import { generateMap, LEVELS, type LevelDef } from '../../src/core/maps';
import { Rng } from '../../src/core/rng';
import { skirmishLevel } from '../../src/core/skirmish';
import type { Difficulty } from '../../src/core/types';
import { World } from '../../src/core/world';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const i = a.indexOf('=');
    return [a.slice(0, i), a.slice(i + 1)];
  }),
) as Record<string, string>;
const teams = Number(args.equipes ?? 4);
const nGames = Number(args.parties ?? 2000);
const diff = (args.diff ?? 'normal') as Difficulty;
const seed0 = Number(args.graine ?? 1);
const limit = Number(args.limite ?? 480);
const workers = Number(args.processus ?? 4);
if (args.valeurs) Object.assign(STAT_POINT_VALUES, JSON.parse(args.valeurs) as Partial<Record<TeamStat, number[]>>);

const NC = TEAM_NAMES.length;

/** Cartes possibles pour ce nombre d'équipes : niveaux de campagne et escarmouches. */
function levelsFor(n: number): LevelDef[] {
  const out = LEVELS.filter((l) => l.teams === n);
  for (let size = 0; size < 4; size++) {
    const tiles = n >= 5 ? 24 : 14 + 2 * size;
    if (n >= 5 && size < 2) continue;
    out.push(skirmishLevel({ teams: n, size, tiles }));
  }
  return out;
}

interface Result {
  wins: number[];
  games: number[];
  unfinished: number;
  time: number;
}

function score(w: World, t: number): number {
  const s = w.stats()[t];
  return s.units + 2 * s.tiles + 6 * s.camps;
}

function playGame(index: number): { colors: number[]; winners: number[]; finished: boolean; time: number } {
  const rng = new Rng(seed0 * 1_000_003 + index * 7919);
  const levels = levelsFor(teams);
  const level = levels[Math.floor(rng.next() * levels.length)];
  const map = generateMap(level, Math.floor(rng.next() * 1e9));
  // Couleurs tirées au hasard parmi les 8, placées au hasard sur les positions de départ.
  const pool = Array.from({ length: NC }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const colors = pool.slice(0, teams);
  const world = new World(map, teams, Math.floor(rng.next() * 1e9), colors);
  const ais = colors.map((_, t) => new TeamAi(world, t, diff));
  const step = 1 / 60;
  let t = 0;
  while (t < limit && world.victors().length === 0) {
    for (const a of ais) a.update(step);
    world.update(step);
    world.drainEvents();
    t += step;
  }
  const v = world.victors();
  if (v.length) return { colors, winners: v.map((w) => colors[w]), finished: true, time: t };
  let best = 0;
  for (let k = 1; k < teams; k++) if (score(world, k) > score(world, best)) best = k;
  return { colors, winners: [colors[best]], finished: false, time: t };
}

function runRange(from: number, to: number): Result {
  const r: Result = { wins: new Array(NC).fill(0), games: new Array(NC).fill(0), unfinished: 0, time: 0 };
  for (let i = from; i < to; i++) {
    const g = playGame(i);
    for (const c of g.colors) r.games[c]++;
    for (const c of g.winners) r.wins[c] += 1 / g.winners.length;
    if (!g.finished) r.unfinished++;
    r.time += g.time;
  }
  return r;
}

if (args.tranche) {
  const [from, to] = args.tranche.split('-').map(Number);
  process.send!(runRange(from, to));
} else {
  const t0 = Date.now();
  const per = Math.ceil(nGames / workers);
  const parts = await Promise.all(
    Array.from({ length: workers }, (_, k) => {
      const from = k * per;
      const to = Math.min(nGames, from + per);
      return new Promise<Result>((resolve, reject) => {
        const child = fork(process.argv[1], [...process.argv.slice(2), `tranche=${from}-${to}`]);
        child.on('message', (m) => resolve(m as Result));
        child.on('error', reject);
      });
    }),
  );
  const total: Result = { wins: new Array(NC).fill(0), games: new Array(NC).fill(0), unfinished: 0, time: 0 };
  for (const p of parts) {
    for (let c = 0; c < NC; c++) {
      total.wins[c] += p.wins[c];
      total.games[c] += p.games[c];
    }
    total.unfinished += p.unfinished;
    total.time += p.time;
  }
  console.log(
    `${teams} équipes, ${nGames} parties, difficulté ${diff} : ${total.unfinished} au temps limite, ` +
      `durée moyenne ${(total.time / nGames).toFixed(0)} s, calcul ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
  const rows: Array<Record<string, string | number>> = [];
  for (let c = 0; c < NC; c++) {
    const rate = total.games[c] ? total.wins[c] / total.games[c] : 0;
    rows.push({ couleur: TEAM_NAMES[c], parties: total.games[c], victoires: Number(total.wins[c].toFixed(1)), taux: `${(rate * 100).toFixed(1)} %` });
    console.log(`${TEAM_NAMES[c].padEnd(7)} ${String(total.games[c]).padStart(5)} parties  ${total.wins[c].toFixed(1).padStart(7)} victoires  ${(rate * 100).toFixed(1).padStart(5)} %`);
  }
  if (args.json) console.log(JSON.stringify(rows));
}
