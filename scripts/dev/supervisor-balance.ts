// Équilibrage des surveillants (option « Surveillants ») : N élèves de base (profil neutre,
// sans bonus) attaquent ensemble un surveillant en pleine santé, sur un terrain dégagé.
// Usage : npx tsx scripts/dev/supervisor-balance.ts [essais par effectif]
import { ensureSupervisors, supervisorActive, type Supervisor } from '../../src/core/supervisors';
import type { MapDef } from '../../src/core/types';
import { World } from '../../src/core/world';

const ARENA: MapDef = {
  id: 'duel',
  name: 'Duel',
  w: 16,
  h: 16,
  teams: 2,
  unitCap: 40,
  spawnInterval: 1e6,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 14, y: 14, owner: 1 },
  ],
};

function park(s: Supervisor, x: number, y: number) {
  s.x = x;
  s.y = y;
  s.mode = 'wait';
  s.timer = 1e6;
  s.path.length = 0;
  s.goal = null;
}

export interface DuelResult {
  win: boolean;
  survivors: number;
  seconds: number;
  supHpLeft: number;
}

/** Un duel : `n` élèves de base lancés ensemble sur un surveillant. */
export function duel(n: number, seed: number): DuelResult {
  const w = new World(ARENA, 2, seed);
  w.rules = { mode: 'classique', supervisors: true };
  const [s, other] = ensureSupervisors(w);
  park(other, 1.5, 14.5);
  park(s, 8, 8);
  // Élèves de base : profil neutre (PV ×1, dégâts ×1).
  w.mods[0].hp = 1;
  w.mods[0].dmg = 1;
  w.mods[0].speed = 1;
  const units = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    units.push(w.spawnUnit(0, 8 + Math.cos(a) * 3.2, 8 + Math.sin(a) * 3.2, false));
  }
  w.orderAttackSupervisor(units, s);
  const step = 1 / 60;
  let t = 0;
  while (t < 90) {
    w.update(step);
    w.drainEvents();
    t += step;
    if (!supervisorActive(s)) break;
    if (!units.some((u) => u.alive)) break;
  }
  return { win: !supervisorActive(s), survivors: units.filter((u) => u.alive).length, seconds: t, supHpLeft: Math.max(0, s.hp) };
}

if (process.argv[1]?.endsWith('supervisor-balance.ts')) {
  const trials = Number(process.argv[2] ?? 20);
  console.log('élèves | victoires | survivants (moy.) | durée (moy.) | PV restants du surveillant (défaites)');
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10, 12]) {
    let wins = 0;
    let surv = 0;
    let secs = 0;
    let hpLeft = 0;
    let losses = 0;
    for (let k = 0; k < trials; k++) {
      const r = duel(n, 1 + k);
      if (r.win) {
        wins++;
        surv += r.survivors;
      } else {
        losses++;
        hpLeft += r.supHpLeft;
      }
      secs += r.seconds;
    }
    console.log(
      `${String(n).padStart(6)} | ${String(Math.round((wins / trials) * 100)).padStart(7)} % | ${(wins ? surv / wins : 0).toFixed(1).padStart(17)} | ${(secs / trials).toFixed(1).padStart(10)} s | ${losses ? Math.round(hpLeft / losses) : '-'}`,
    );
  }
}
