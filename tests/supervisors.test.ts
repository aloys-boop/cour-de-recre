import { describe, expect, it } from 'vitest';
import { TeamAi } from '../src/core/ai';
import { generateMap } from '../src/core/mapgen';
import { RULE_TOGGLES } from '../src/core/rules';
import { skirmishLevel } from '../src/core/skirmish';
import {
  PUNISH_SECONDS,
  ensureSupervisors,
  supervisorCount,
  supervisorsOf,
  takeWhistles,
  type Supervisor,
} from '../src/core/supervisors';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 12,
  h: 12,
  teams: 2,
  unitCap: 10,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 10, y: 10, owner: 1 },
    { kind: 'bonus', x: 8, y: 2, suit: 'heart' },
  ],
};

function tick(world: World, seconds: number, each?: () => void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    world.update(step);
    each?.();
  }
}

/** Immobilise un surveillant à un endroit donné (attente longue, sans chemin). */
function park(s: Supervisor, x: number, y: number, wait = 1000) {
  s.x = x;
  s.y = y;
  s.mode = 'wait';
  s.timer = wait;
  s.path.length = 0;
  s.goal = null;
}

function arena(on: boolean): World {
  const w = new World(ARENA, 2, 3);
  w.rules = { mode: 'classique', supervisors: on };
  return w;
}

describe('option « Surveillants »', () => {
  it('figure dans les options d’escarmouche, désactivée par défaut', () => {
    const t = RULE_TOGGLES.find((r) => r.key === 'supervisors');
    expect(t?.label).toBe('Surveillants');
    expect(new World(ARENA, 2, 1).rules.supervisors).toBeFalsy();
  });

  it('option inactive : aucun surveillant', () => {
    const w = arena(false);
    w.spawnUnit(0, 3, 3);
    tick(w, 2);
    expect(supervisorsOf(w)).toHaveLength(0);
    expect(ensureSupervisors(w)).toHaveLength(0);
  });

  it('option active : 2 surveillants sur les petites cours, 3 à 4 sur les grandes', () => {
    const counts = [0, 1, 2, 3].map((size) => {
      const map = generateMap(skirmishLevel({ teams: 4, size, tiles: 14 }), 11);
      const w = new World(map, map.teams, 11);
      w.rules = { mode: 'classique', supervisors: true };
      tick(w, 0.05);
      const list = supervisorsOf(w);
      for (const s of list) expect(w.grid.walkable(s.x, s.y)).toBe(true);
      expect(list.length).toBe(supervisorCount(map));
      return list.length;
    });
    expect(counts[0]).toBe(2);
    expect(counts[2]).toBeGreaterThanOrEqual(3);
    expect(counts[3]).toBe(4);
    expect(counts[3]).toBeLessThanOrEqual(4);
    // 8 équipes, grande cour : 4.
    const big = generateMap(skirmishLevel({ teams: 8, size: 2, tiles: 24 }), 5);
    expect(supervisorCount(big)).toBe(4);
  });

  it('les surveillants patrouillent dans la cour', () => {
    const w = arena(true);
    const s = ensureSupervisors(w)[0];
    const x0 = s.x;
    const y0 = s.y;
    let moved = 0;
    tick(w, 12, () => (moved = Math.max(moved, Math.hypot(s.x - x0, s.y - y0))));
    expect(moved).toBeGreaterThan(1);
    for (const x of supervisorsOf(w)) expect(w.grid.walkable(x.x, x.y)).toBe(true);
  });

  it('un combat près d’un surveillant est interrompu, les combattants immobilisés puis libérés', () => {
    const w = arena(true);
    const [s, other] = ensureSupervisors(w);
    park(other, 1, 11);
    park(s, 4, 6);
    const a = w.spawnUnit(0, 6, 6, false);
    const b = w.spawnUnit(1, 6.5, 6, false);
    const bystander = w.spawnUnit(0, 5.6, 7.1, false); // ne se bat pas : repli permanent sur place
    // Le combat s'engage et le surveillant s'y rend ; on s'arrête au premier coup de sifflet.
    s.timer = 0.01;
    let whistled = 0;
    for (let i = 0; i < 300 && whistled === 0; i++) {
      w.orderMove([bystander], { x: 5.5, y: 7.5 });
      w.update(1 / 60);
      whistled += takeWhistles(w);
    }
    expect(whistled).toBeGreaterThanOrEqual(1);
    expect(a.punishedUntil).toBeGreaterThan(0);
    expect(b.punishedUntil).toBeGreaterThan(0);
    expect(bystander.punishedUntil).toBe(0);

    // On éloigne le surveillant pour vérifier la libération sans nouvelle punition.
    park(s, 1, 10);
    const until = Math.max(a.punishedUntil, b.punishedUntil);
    expect(until - w.time).toBeLessThanOrEqual(PUNISH_SECONDS);
    tick(w, 0.3); // fin du recul
    const hpA = a.hp;
    const hpB = b.hp;
    const pa = { x: a.x, y: a.y };
    tick(w, Math.max(0, until - w.time - 0.4), () => {
      expect(a.engagedId).toBe(-1);
      expect(b.engagedId).toBe(-1);
      expect(a.state).toBe('idle');
    });
    expect(Math.hypot(a.x - pa.x, a.y - pa.y)).toBeLessThan(0.3); // immobile (à la séparation près)
    expect(a.hp).toBe(hpA);
    expect(b.hp).toBe(hpB);
    // Libérés : ils reprennent le combat.
    tick(w, 2.5);
    expect(a.punishedUntil).toBeLessThan(w.time);
    expect(a.hp < hpA || b.hp < hpB || !a.alive || !b.alive).toBe(true);
  });

  it('les combattants sont repoussés au coup de sifflet', () => {
    const w = arena(true);
    const [s, other] = ensureSupervisors(w);
    park(other, 1, 11);
    park(s, 6.2, 6.6);
    const a = w.spawnUnit(0, 6, 6, false);
    const b = w.spawnUnit(1, 6.45, 6, false);
    tick(w, 1.5);
    expect(a.punishedUntil).toBeGreaterThan(0);
    expect(b.punishedUntil).toBeGreaterThan(0);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.6);
  });

  it('les surveillants ne prennent pas de dégâts, ne capturent rien et ne sont pas des élèves', () => {
    const w = arena(true);
    const sups = ensureSupervisors(w);
    const tile = w.tiles.find((t) => !t.isCamp)!;
    park(sups[0], tile.cx, tile.cy);
    park(sups[1], 3, 3);
    // Une mêlée juste à côté du second surveillant, en continu.
    for (let i = 0; i < 4; i++) {
      w.spawnUnit(0, 3 + 0.3 * i, 3.4, false);
      w.spawnUnit(1, 3 + 0.3 * i, 3.9, false);
    }
    tick(w, 10, () => {
      // Le surveillant reste où il est, quoi qu'il arrive autour de lui.
      if (sups[1].mode !== 'wait') park(sups[1], 3, 3);
    });
    expect(supervisorsOf(w)).toHaveLength(2);
    expect(w.units.every((u) => u.team === 0 || u.team === 1)).toBe(true);
    expect(w.units.some((u) => (u as unknown) === sups[0] || (u as unknown) === sups[1])).toBe(false);
    expect(tile.owner).toBe(NO_TEAM);
    expect(tile.cap).toBe(0);
    expect(w.stats().every((s) => s.units <= 4)).toBe(true);
  });

  it('l’IA évite les cases surveillées', () => {
    const scoreWith = (on: boolean) => {
      const w = arena(on);
      for (let i = 0; i < 4; i++) w.spawnUnit(1, 10.5 + 0.1 * i, 9.5, false);
      if (on) for (const s of ensureSupervisors(w)) park(s, 8.6, 2.6); // sur la case bonus
      const ai = new TeamAi(w, 1, 'normal');
      tick(w, 3, () => ai.update(1 / 60));
      return w.units.filter((u) => u.team === 1 && Math.hypot(u.x - 8.6, u.y - 2.6) < 2).length;
    };
    // Seule cible non possédée : la case bonus et le camp adverse ; sous surveillance, l'IA va ailleurs.
    expect(scoreWith(false)).toBeGreaterThanOrEqual(scoreWith(true));
  });
});
