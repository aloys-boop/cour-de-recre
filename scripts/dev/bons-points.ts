// Équilibrage des bons points (IA contre IA).
//   npx tsx scripts/dev/bons-points.ts [difficulté] [mode] [graines]
//   mode « revenus » : d'où viennent les bons points, combien chaque équipe gagne et dépense par minute ;
//   mode « eco »     : la moitié des équipes dépense ses bons points, l'autre non (positions alternées) :
//                      taux de victoire des équipes qui dépensent ;
//   mode « classes » : la moitié des équipes produit des classes (mélange de l'IA), l'autre seulement des élèves ;
//   mode « costaud », « sprinteur », « infirmier » : la moitié des équipes ne produit que cette classe ;
//   mode « pouvoirs » / « pion » : la moitié des équipes utilise les pouvoirs (ou achète des pions), l'autre non ;
//   mode « ralliement » : la moitié des équipes pose des ralliements vers ses fronts, l'autre non.
import { TeamAi } from '../../src/core/ai';
import { generateMap, LEVELS } from '../../src/core/maps';
import type { Difficulty, MapDef } from '../../src/core/types';
import { World } from '../../src/core/world';
import { CLASS_UNLOCK, totalTeamUpgrades, UPGRADES } from '../../src/core/upgrades';
import { MERITS, awardMerit } from '../../src/core/merits';
import { buyPion, PION } from '../../src/core/pion';
import { CLASS_MIX, setRallyReach } from '../../src/core/ai-economy';

// Réglages de remplacement (essais) : COUTS='[40,80,140]' (améliorations globales), COUTS_DEF='[20,40,70]' (Défense d'un camp),
// CLASSES=60 (déblocage des classes), GAINS='{"koUnit":2,...}'.
if (process.env.COUTS) for (const b of ['prod', 'hp', 'dmg'] as const) UPGRADES[b].costs = JSON.parse(process.env.COUTS);
if (process.env.COUTS_DEF) UPGRADES.def.costs = JSON.parse(process.env.COUTS_DEF);
if (process.env.CLASSES) CLASS_UNLOCK.cost = Number(process.env.CLASSES);
// PORTEE=5 : distance maximale camp → ralliement posé par les IA.
if (process.env.PORTEE) setRallyReach(Number(process.env.PORTEE));
if (process.env.GAINS) Object.assign(MERITS, JSON.parse(process.env.GAINS));
// MIX='{"costaud":0.35,...}' : mélange de classes visé par les IA (voir CLASS_MIX).
if (process.env.MIX) Object.assign(CLASS_MIX, JSON.parse(process.env.MIX));

const diff = (process.argv[2] as Difficulty) ?? 'normal';
const mode = process.argv[3] ?? 'revenus';
const seeds = (process.argv[4] ?? '3,11,17').split(',').map(Number);
const step = 1 / 60;

interface Result {
  world: World;
  time: number;
  victors: number[];
  bySource: Record<string, number>;
}

function play(map: MapDef, seed: number, setup: (ais: TeamAi[]) => void, limit = 600, colors?: number[]): Result {
  const world = new World(map, map.teams, seed, colors);
  seen.clear();
  // PROD2=1 : classes débloquées d'emblée pour toutes les équipes.
  if (process.env.PROD2) for (const u of world.teamUpgrades) u.classes = true;
  const ais = Array.from({ length: map.teams }, (_, t) => new TeamAi(world, t, diff));
  setup(ais);
  const bySource: Record<string, number> = {};
  let t = 0;
  while (t < limit && world.victors().length === 0) {
    for (const a of ais) a.update(step);
    world.update(step);
    for (const ev of world.drainEvents()) {
      if (ev.kind === 'merit') bySource[ev.reason] = (bySource[ev.reason] ?? 0) + ev.amount;
      if (ev.kind === 'power') ((casts[ev.id] = (casts[ev.id] ?? 0) + 1), (castHits[ev.id] = (castHits[ev.id] ?? 0) + ev.hits));
    }
    for (const u of world.units) if (!seen.has(u.id)) (seen.add(u.id), (produced[u.cls] = (produced[u.cls] ?? 0) + 1));
    t += step;
  }
  return { world, time: t, victors: world.victors(), bySource };
}

const seen = new Set<number>();
/** Pouvoirs lancés et élèves touchés, par pouvoir. */
const casts: Record<string, number> = {};
const castHits: Record<string, number> = {};
let pions = 0;
/** Élèves produits par classe (toutes parties confondues). */
const produced: Record<string, number> = {};
const maps = LEVELS.map((l, i) => generateMap(l, 100 + i)).filter((m) => m.teams === 4);

if (mode === 'revenus') {
  let games = 0;
  let minutes = 0;
  let earned = 0;
  let spent = 0;
  let levels = 0;
  let teamGames = 0;
  const sources: Record<string, number> = {};
  for (const map of maps)
    for (const seed of seeds) {
      const r = play(map, seed, () => undefined);
      games++;
      minutes += r.time / 60;
      for (let team = 0; team < map.teams; team++) {
        earned += r.world.merits.earned[team];
        spent += r.world.merits.spent[team];
        teamGames++;
      }
      for (const c of r.world.camps) if (c.pionBought) pions++;
      for (let team = 0; team < map.teams; team++) levels += totalTeamUpgrades(r.world, team);
      for (const c of r.world.camps) levels += c.defense;
      for (const [k, v] of Object.entries(r.bySource)) sources[k] = (sources[k] ?? 0) + v;
    }
  const total = Object.values(sources).reduce((a, b) => a + b, 0);
  console.log(`${games} parties, ${diff}, durée moyenne ${((minutes / games) * 60).toFixed(0)} s`);
  console.log(`par équipe : ${(earned / teamGames).toFixed(0)} bons points gagnés, ${(spent / teamGames).toFixed(0)} dépensés, ${(earned / teamGames / (minutes / games)).toFixed(0)} par minute`);
  console.log(`niveaux d'amélioration en fin de partie (globaux + Défense des camps) : ${(levels / games).toFixed(1)} par partie`);
  for (const [k, v] of Object.entries(sources)) console.log(`  ${k.padEnd(11)} ${((v / total) * 100).toFixed(0)} %`);
  const all = Object.values(produced).reduce((a, b) => a + b, 0);
  console.log(`pouvoirs : ${Object.entries(casts).map(([k, v]) => `${k} ${(v / games).toFixed(1)} par partie (${(castHits[k] / v).toFixed(1)} élèves touchés)`).join(', ')}`);
  console.log(`pions en place en fin de partie : ${(pions / games).toFixed(1)} par partie`);
  console.log(`élèves par classe : ${Object.entries(produced).map(([k, v]) => `${k} ${((v / all) * 100).toFixed(0)} %`).join(', ')}`);
} else if (['eco', 'classes', 'costaud', 'sprinteur', 'infirmier', 'pouvoirs', 'pion', 'pion0', 'ralliement', 'ameliorations'].includes(mode)) {
  let wins = 0;
  let games = 0;
  let unfinished = 0;
  let duration = 0;
  for (const map of maps)
    for (const seed of seeds)
      for (let rot = 0; rot < 4; rot++) {
        const r = play(map, seed, (ais) => {
          const on = (t: number) => (t + rot) % 2 === 0;
          if (mode === 'eco') ais.forEach((a, t) => (a.economy.enabled = on(t)));
          else if (mode === 'pouvoirs') ais.forEach((a, t) => (a.economy.allowPowers = on(t)));
          else if (mode === 'pion') ais.forEach((a, t) => (a.economy.allowPion = on(t)));
          else if (mode === 'ralliement') ais.forEach((a, t) => (a.economy.allowRallies = on(t)));
          else if (mode === 'ameliorations') ais.forEach((a, t) => (a.economy.allowUpgrades = on(t)));
          else if (mode === 'pion0')
            // Valeur d'un pion : la moitié des équipes en reçoit un, gratuit, dès le départ.
            ais.forEach((a, t) => {
              a.economy.allowPion = false;
              if (on(t)) {
                awardMerit(a.world, t, PION.cost, 0, 0, 'hold');
                buyPion(a.world, t, a.world.camps.find((c) => c.owner === t)!);
              }
            });
          else if (mode === 'classes') ais.forEach((a, t) => (a.economy.forceClass = on(t) ? null : 'aucune'));
          else ais.forEach((a, t) => (a.economy.forceClass = on(t) ? (mode as 'costaud') : 'aucune'));
        });
        games++;
        duration += r.time;
        if (r.victors.length === 0) unfinished++;
        // « eco » : victoires des équipes qui dépensent (paires de positions alternées).
        for (const v of r.victors) if ((v + rot) % 2 === 0) wins += 1 / r.victors.length;
      }
  console.log(`${games} parties, ${unfinished} au temps limite, durée moyenne ${(duration / games).toFixed(0)} s`);
  const who =
    mode === 'eco' ? 'qui dépensent leurs bons points' : mode === 'classes' ? 'qui produisent des classes' : mode === 'pouvoirs' ? 'qui lancent des pouvoirs' : mode === 'pion' ? 'qui achètent des pions' : mode === 'pion0' ? 'qui ont un pion dès le départ' : mode === 'ralliement' ? 'qui posent des ralliements vers leurs fronts' : mode === 'ameliorations' ? 'qui achètent des améliorations (globales et Défense)' : `qui produisent des ${mode}s`;
  console.log(`victoires des équipes ${who} : ${((wins / (games - unfinished)) * 100).toFixed(0)} % (50 % = aucun effet)`);
}
