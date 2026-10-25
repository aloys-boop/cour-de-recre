import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config';
import { AI_SUPERVISOR_GROUP, TeamAi, planSupervisorFight } from '../src/core/ai';
import { teamPlural } from '../src/core/diplomacy';
import { generateMap } from '../src/core/mapgen';
import { RULE_TOGGLES } from '../src/core/rules';
import { skirmishLevel } from '../src/core/skirmish';
import { GameStats, endStats } from '../src/core/stats';
import {
  SUPERVISOR_BUFF_SECONDS,
  SUPERVISOR_DMG_MAX,
  SUPERVISOR_DMG_MIN,
  SUPERVISOR_HP,
  SUPERVISOR_LEASH,
  SUPERVISOR_RESPAWN,
  SUPERVISOR_SPLASH_FACTOR,
  ensureSupervisors,
  supervisorActive,
  supervisorAnnouncement,
  supervisorBuffLeft,
  supervisorCount,
  supervisorDamageBonus,
  supervisorsOf,
  takeWhistles,
  type Supervisor,
} from '../src/core/supervisors';
import { NO_TEAM, type MapDef } from '../src/core/types';
import type { Unit } from '../src/core/unit';
import { World, type WorldEvent } from '../src/core/world';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 16,
  h: 16,
  teams: 2,
  unitCap: 40,
  spawnInterval: 1e6,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 14, y: 14, owner: 1 },
    { kind: 'bonus', x: 12, y: 2, suit: 'heart' },
  ],
};

function tick(world: World, seconds: number, each?: () => boolean | void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    world.update(step);
    if (each?.()) return;
  }
}

/** Immobilise un surveillant à un endroit donné (attente longue, sans chemin). */
function park(s: Supervisor, x: number, y: number, wait = 1e6) {
  s.x = x;
  s.y = y;
  s.mode = 'wait';
  s.timer = wait;
  s.path.length = 0;
  s.goal = null;
}

/** Arène avec un surveillant au centre (8, 8) et l'autre rangé dans un coin. */
function arena(on = true): { w: World; s: Supervisor } {
  const w = new World(ARENA, 2, 3);
  w.rules = { mode: 'classique', supervisors: on };
  if (!on) return { w, s: undefined as unknown as Supervisor };
  const [s, other] = ensureSupervisors(w);
  park(other, 1.5, 14.5);
  park(s, 8, 8);
  return { w, s };
}

/** Élèves de base (profil neutre) pour l'équipe 0. */
function baseStudents(w: World) {
  w.mods[0].hp = 1;
  w.mods[0].dmg = 1;
  w.mods[0].speed = 1;
}

/** `n` élèves de base lancés ensemble sur le surveillant ; vrai s'ils le mettent KO. */
function duel(n: number, seed: number): { win: boolean; survivors: number } {
  const w = new World(ARENA, 2, seed);
  w.rules = { mode: 'classique', supervisors: true };
  const [s, other] = ensureSupervisors(w);
  park(other, 1.5, 14.5);
  park(s, 8, 8);
  baseStudents(w);
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    units.push(w.spawnUnit(0, 8 + Math.cos(a) * 3.2, 8 + Math.sin(a) * 3.2, false));
  }
  w.orderAttackSupervisor(units, s);
  tick(w, 60, () => !supervisorActive(s) || !units.some((u) => u.alive));
  return { win: !supervisorActive(s), survivors: units.filter((u) => u.alive).length };
}

describe('option « Surveillants » : réglage', () => {
  it('figure dans les options d’escarmouche, désactivée par défaut, avec la nouvelle description', () => {
    const t = RULE_TOGGLES.find((r) => r.key === 'supervisors');
    expect(t?.label).toBe('Surveillants');
    expect(t?.description).toContain('KO');
    expect(t?.description).not.toMatch(/puni/);
    expect(new World(ARENA, 2, 1).rules.supervisors).toBeFalsy();
  });

  it('option inactive : aucun surveillant, les combats se déroulent normalement', () => {
    const { w } = arena(false);
    const a = w.spawnUnit(0, 8, 8, false);
    const b = w.spawnUnit(1, 8.4, 8, false);
    tick(w, 3);
    expect(supervisorsOf(w)).toHaveLength(0);
    expect(ensureSupervisors(w)).toHaveLength(0);
    expect(takeWhistles(w)).toBe(0);
    expect(a.supId).toBe(0);
    expect(a.hp < a.maxHp || b.hp < b.maxHp).toBe(true);
    expect(supervisorDamageBonus(w, 0)).toBe(1);
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
  });

  it('les surveillants patrouillent dans la cour', () => {
    const w = new World(ARENA, 2, 3);
    w.rules = { mode: 'classique', supervisors: true };
    const s = ensureSupervisors(w)[0];
    const x0 = s.x;
    const y0 = s.y;
    let moved = 0;
    tick(w, 12, () => void (moved = Math.max(moved, Math.hypot(s.x - x0, s.y - y0))));
    expect(moved).toBeGreaterThan(1);
    for (const x of supervisorsOf(w)) expect(w.grid.walkable(x.x, x.y)).toBe(true);
  });
});

describe('option « Surveillants » : mini-boss', () => {
  it('points de vie de 10 élèves de base, neutres et hors des élèves', () => {
    const { w, s } = arena();
    expect(SUPERVISOR_HP).toBe(10 * TUNING.unitHp);
    expect(s.hp).toBe(SUPERVISOR_HP);
    expect(s.maxHp).toBe(SUPERVISOR_HP);
    expect(s.team).toBe(NO_TEAM);
    expect(w.units).toHaveLength(0);
  });

  it('coup lourd et frappe de zone : la cible et ses voisins proches encaissent, avec un recul marqué', () => {
    const { w } = arena();
    baseStudents(w);
    const target = w.spawnUnit(0, 8.7, 8, false);
    const close = w.spawnUnit(0, 9.05, 8.25, false); // à moins de 0,6 de la cible
    const far = w.spawnUnit(1, 6.4, 6.4, false); // hors de la zone de frappe
    // On les retient sur place (repli sur leur position) pour mesurer un seul coup.
    const hold = () => {
      for (const u of [target, close, far]) if (u.alive && u.hp === u.maxHp) w.orderMove([u], { x: u.x, y: u.y });
    };
    hold();
    const p0 = { x: close.x, y: close.y };
    let events: WorldEvent[] = [];
    tick(w, 4, () => {
      events = events.concat(w.drainEvents());
      return target.hp < target.maxHp;
    });
    const dmg = target.maxHp - target.hp;
    expect(dmg).toBeGreaterThanOrEqual(SUPERVISOR_DMG_MIN);
    expect(dmg).toBeLessThanOrEqual(SUPERVISOR_DMG_MAX);
    expect(dmg).toBeGreaterThanOrEqual(3 * TUNING.punchDamageMax * 0.9); // ≈ 3 à 4 coups d'élève
    const splash = close.maxHp - close.hp;
    expect(splash).toBe(Math.max(1, Math.round(dmg * SUPERVISOR_SPLASH_FACTOR)));
    expect(far.hp).toBe(far.maxHp);
    const t0 = { x: target.x, y: target.y };
    let pushed = 0;
    tick(w, 0.3, () => void (pushed = Math.max(pushed, Math.hypot(target.x - t0.x, target.y - t0.y))));
    // Recul marqué : bien plus qu'un coup d'élève (≈ 0,1 case).
    expect(pushed).toBeGreaterThan(0.25);
    expect(Math.hypot(close.x - p0.x, close.y - p0.y)).toBeGreaterThan(0.25);
  });

  it('un élève qui entre dans le rayon d’agression est attaqué (coup de sifflet), poursuivi un peu, puis le surveillant revient patrouiller', () => {
    const { w, s } = arena();
    takeWhistles(w);
    const u = w.spawnUnit(0, 10.2, 8, false);
    w.orderMove([u], { x: 10.2, y: 8 });
    tick(w, 0.6);
    expect(['alert', 'fight']).toContain(s.mode);
    expect(s.targetId).toBe(u.id);
    expect(takeWhistles(w)).toBe(1);
    // L'élève s'enfuit loin (repli, sans riposter) : le surveillant le poursuit sans dépasser sa laisse.
    w.orderMove([u], { x: 15, y: 15 });
    const anchor = { ...s.anchor! };
    let farthest = 0;
    let returned = false;
    tick(w, 20, () => {
      farthest = Math.max(farthest, Math.hypot(s.x - anchor.x, s.y - anchor.y));
      if (s.mode === 'return') returned = true;
      return returned && (s.mode === 'wait' || s.mode === 'patrol');
    });
    expect(farthest).toBeGreaterThan(1);
    expect(farthest).toBeLessThanOrEqual(SUPERVISOR_LEASH + 0.3);
    expect(returned).toBe(true);
    expect(['wait', 'patrol']).toContain(s.mode);
    expect(Math.hypot(s.x - anchor.x, s.y - anchor.y)).toBeLessThan(1.5);
    expect(u.alive).toBe(true);
  });

  it('se régénère lentement hors combat', () => {
    const { w, s } = arena();
    s.hp = 300;
    s.lastCombat = w.time;
    tick(w, 2);
    expect(s.hp).toBe(300); // pas tout de suite
    tick(w, 6);
    expect(s.hp).toBeGreaterThan(300);
    expect(s.hp).toBeLessThan(400);
  });

  it('un élève inoccupé à portée riposte contre le surveillant qui l’attaque', () => {
    const { w, s } = arena();
    const u = w.spawnUnit(0, 9.6, 8, false);
    tick(w, 3, () => s.hp < s.maxHp);
    expect(u.supId).toBe(s.id);
    expect(s.hp).toBeLessThan(s.maxHp);
  });

  it('ordre d’attaque sur un surveillant : les élèves vont le frapper, puis lâchent quand il est KO', () => {
    const { w, s } = arena();
    const units = [0, 1, 2].map((i) => w.spawnUnit(0, 3 + i * 0.4, 12, false));
    w.orderAttackSupervisor(units, s);
    for (const u of units) {
      expect(u.order.kind).toBe('attack');
      expect(u.supId).toBe(s.id);
    }
    tick(w, 6, () => s.hp < s.maxHp);
    expect(s.hp).toBeLessThan(s.maxHp);
    s.hp = 1;
    tick(w, 3, () => !supervisorActive(s));
    expect(s.mode).toBe('ko');
    tick(w, 0.2);
    for (const u of units.filter((x) => x.alive)) {
      expect(u.supId).toBe(0);
      expect(u.order.kind).not.toBe('attack');
    }
  });

  it('les alliances n’y changent rien : il frappe et se fait frapper par toutes les équipes', () => {
    const { w, s } = arena();
    w.setAllied(0, 1, true);
    const a = w.spawnUnit(0, 8.7, 8, false);
    const b = w.spawnUnit(1, 7.3, 8, false);
    tick(w, 6, () => a.hp < a.maxHp && b.hp < b.maxHp);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(a.supId === s.id || !a.alive).toBe(true);
    expect(b.supId === s.id || !b.alive).toBe(true);
  });

  it('KO : annonce, bonus de dégâts pour l’équipe du dernier coup, statistiques, puis retour à un bord 45 s plus tard', () => {
    const { w, s } = arena();
    const stats = new GameStats(2);
    const u = w.spawnUnit(1, 8.7, 8, false);
    s.hp = 1;
    let ko: WorldEvent | undefined;
    tick(w, 3, () => {
      const evs = w.drainEvents();
      stats.recordAll(evs);
      ko = evs.find((e) => e.kind === 'supKo');
      return !!ko;
    });
    expect(ko).toMatchObject({ kind: 'supKo', team: 1 });
    expect(s.mode).toBe('ko');
    expect(s.anim).toBe('ko');
    expect(supervisorDamageBonus(w, 1)).toBeCloseTo(1.25);
    expect(supervisorDamageBonus(w, 0)).toBe(1);
    expect(supervisorBuffLeft(w, 1)).toBeCloseTo(SUPERVISOR_BUFF_SECONDS, 0);
    expect(stats.teams[1].supKo).toBe(1);
    expect(stats.teams[0].supKo).toBe(0);
    const end = endStats(stats, w, 0);
    expect(end.supervisors).toBe(true);
    expect(end.rows[1].supKo).toBe(1);
    // Annonce.
    const colors = [0, 1];
    const plural = (t: number) => teamPlural(colors[t]);
    expect(supervisorAnnouncement(ko!, 0, plural)).toBe('Les Verts ont mis KO un surveillant !');
    expect(supervisorAnnouncement({ kind: 'supKo', team: 0 }, 0, plural)).toMatch(/^Tu as mis KO un surveillant/);
    // Pendant son absence, il n'est ni ciblable ni dangereux.
    u.clearOrder();
    tick(w, 5);
    expect(s.mode).toBe('away');
    expect(u.supId).toBe(0);
    tick(w, SUPERVISOR_BUFF_SECONDS - 5 + 0.2);
    expect(supervisorDamageBonus(w, 1)).toBe(1);
    expect(supervisorActive(s)).toBe(false);
    tick(w, SUPERVISOR_RESPAWN - SUPERVISOR_BUFF_SECONDS);
    expect(supervisorActive(s)).toBe(true);
    expect(s.hp).toBe(SUPERVISOR_HP);
    const edge = Math.min(s.x, s.y, ARENA.w - s.x, ARENA.h - s.y);
    expect(edge).toBeLessThan(1.6);
    expect(w.grid.walkable(s.x, s.y)).toBe(true);
  });

  it('le bonus de dégâts s’applique aux coups de l’équipe récompensée', () => {
    const avg = (buff: boolean) => {
      const { w, s } = arena();
      park(s, 2, 14);
      if (buff) {
        // KO express pour l'équipe 0.
        const k = w.spawnUnit(0, 2.6, 14, false);
        s.hp = 1;
        tick(w, 3, () => !supervisorActive(s));
        k.hp = 0;
        k.state = 'ko';
      }
      let total = 0;
      let n = 0;
      for (let i = 0; i < 20; i++) {
        const a = w.spawnUnit(0, 8, 8, false);
        const b = w.spawnUnit(1, 8.4, 8, false);
        b.maxHp = b.hp = 1e6;
        tick(w, 0.9);
        total += 1e6 - b.hp;
        n++;
        a.hp = 0;
        a.state = 'ko';
        b.hp = 0;
        b.state = 'ko';
        tick(w, 2);
      }
      return total / n;
    };
    expect(avg(true) / avg(false)).toBeGreaterThan(1.15);
  });

  it('équilibre : une dizaine d’élèves de base en viennent à bout, 4 ou 5 se font battre', () => {
    for (const seed of [1, 2, 3, 4]) {
      expect(duel(10, seed).win).toBe(true);
      expect(duel(4, seed).win).toBe(false);
      expect(duel(5, seed).win).toBe(false);
    }
    // À 10, la victoire coûte quelques élèves.
    const r = duel(10, 5);
    expect(r.survivors).toBeLessThan(10);
  });
});

describe('option « Surveillants » : IA et brouillard', () => {
  it('un petit groupe d’IA évite les cases gardées', () => {
    const scoreWith = (on: boolean) => {
      const w = new World(ARENA, 2, 3);
      w.rules = { mode: 'classique', supervisors: on };
      for (let i = 0; i < 4; i++) w.spawnUnit(1, 13.5 + 0.1 * i, 12.5, false);
      if (on) {
        const [a, b] = ensureSupervisors(w);
        park(a, 12.6, 2.6); // sur la case bonus
        park(b, 1.5, 14.5);
      }
      const ai = new TeamAi(w, 1, 'normal');
      tick(w, 4, () => void ai.update(1 / 60));
      return w.units.filter((u) => u.team === 1 && u.alive && Math.hypot(u.x - 12.6, u.y - 2.6) < 2).length;
    };
    expect(scoreWith(false)).toBeGreaterThanOrEqual(scoreWith(true));
  });

  it('un gros groupe d’IA (8 élèves ou plus) va mettre KO un surveillant proche', () => {
    const { w, s } = arena();
    park(s, 8, 4.5);
    for (let i = 0; i < AI_SUPERVISOR_GROUP + 1; i++) w.spawnUnit(1, 7 + (i % 3) * 0.5, 9.5 + Math.floor(i / 3) * 0.5, false);
    const ai = new TeamAi(w, 1, 'normal');
    let attacking = 0;
    tick(w, 6, () => {
      ai.update(1 / 60);
      attacking = Math.max(attacking, w.units.filter((u) => u.supId === s.id).length);
    });
    expect(attacking).toBeGreaterThanOrEqual(AI_SUPERVISOR_GROUP);
  });

  it('brouillard : un surveillant caché n’est pas visé par l’IA', () => {
    const plan = (fog: boolean) => {
      const { w, s } = arena();
      w.rules = { ...w.rules, fog };
      park(s, 8, 8);
      const strikers = Array.from({ length: 10 }, (_, i) => w.spawnUnit(1, 3 + (i % 2) * 0.4, 7.5 + i * 0.1, false));
      const target = w.tiles.find((t) => !t.isCamp)!;
      return planSupervisorFight({ world: w, team: 1 }, strikers, target);
    };
    expect(plan(false)).toBe(true);
    expect(plan(true)).toBe(false);
  });
});
