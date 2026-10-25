import { TUNING } from '../config';
import { dirFromVector, dist2 } from './math';
import { findPath, smoothPath } from './pathfinding';
import { Rng } from './rng';
import type { Dir, MapDef, Vec2 } from './types';
import type { Unit } from './unit';
import type { World } from './world';

/**
 * Option d'escarmouche « Surveillants » (rules.supervisors) : des adultes neutres patrouillent
 * dans la cour. Quand une bagarre éclate près de l'un d'eux, il s'y rend, donne un coup de sifflet
 * et punit les élèves qui se battent autour de lui : combat interrompu, petit recul, 3 s sans bouger.
 *
 * Les surveillants ne sont pas des élèves : ils ne figurent pas dans `world.units`, n'appartiennent
 * à aucune équipe, ne sont ni sélectionnables ni attaquables, ne capturent rien et ne bloquent personne.
 * Leur état est rangé à part (WeakMap par monde), créé au premier pas de simulation.
 */

/** Distance (cellules) à laquelle un surveillant repère une bagarre et s'y dirige. */
export const SUPERVISOR_DETECT = 2.5;
/** Distance au bagarreur le plus proche à partir de laquelle il siffle. */
export const SUPERVISOR_ARRIVE = 1.0;
/** Rayon de la punition autour du surveillant au coup de sifflet. */
export const SUPERVISOR_PUNISH = 1.5;
/** Durée de la punition (secondes sans bouger ni se battre). */
export const PUNISH_SECONDS = 3;
/** Taille d'affichage d'un surveillant par rapport à un élève. */
export const SUPERVISOR_SCALE = 1.3;

const PATROL_SPEED = TUNING.unitSpeed * 0.45;
const RUSH_SPEED = TUNING.unitSpeed * 0.95;
const SCAN_EVERY = 0.25;
const RUSH_TIMEOUT = 8;
const WHISTLE_SECONDS = 1.1;
const PUSH = 3;

export type SupervisorMode = 'patrol' | 'wait' | 'rush' | 'whistle';

export interface Supervisor {
  readonly id: number;
  x: number;
  y: number;
  dir: Dir;
  anim: 'idle' | 'walk' | 'whistle';
  animTime: number;
  mode: SupervisorMode;
  /** Temps restant de l'état courant (attente, sifflet, abandon d'une intervention). */
  timer: number;
  path: Vec2[];
  /** Destination du chemin courant. */
  goal: Vec2 | null;
  /** Instant de la prochaine recherche de bagarre. */
  nextScan: number;
}

interface State {
  list: Supervisor[];
  rng: Rng;
  /** Coups de sifflet depuis le dernier `takeWhistles` (son). */
  whistles: number;
}

const store = new WeakMap<World, State>();
const EMPTY: readonly Supervisor[] = [];

/** Nombre de surveillants selon la taille de la cour : 2 sur les petites, 3 à 4 sur les grandes. */
export function supervisorCount(map: Pick<MapDef, 'w' | 'h'>): number {
  const side = Math.sqrt(map.w * map.h);
  return side < 18 ? 2 : side < 23 ? 3 : 4;
}

/** Surveillants de la partie (vide si l'option est inactive ou pas encore initialisée). */
export function supervisorsOf(world: World): readonly Supervisor[] {
  return store.get(world)?.list ?? EMPTY;
}

/** Nombre de surveillants à moins de `r` cellules d'un point (pour l'IA). */
export function supervisorsNear(world: World, x: number, y: number, r: number): number {
  const st = store.get(world);
  if (!st) return 0;
  let n = 0;
  for (const s of st.list) if (dist2(s.x, s.y, x, y) < r * r) n++;
  return n;
}

/** Nombre de coups de sifflet depuis le dernier appel (remis à zéro). */
export function takeWhistles(world: World): number {
  const st = store.get(world);
  if (!st) return 0;
  const n = st.whistles;
  st.whistles = 0;
  return n;
}

/** L'élève est-il puni (immobile, hors combat) ? */
export function isPunished(u: Unit, time: number): boolean {
  return u.punishedUntil > time;
}

/** Un élève puni ne fait rien : ni combat, ni déplacement (le recul s'applique quand même). */
export function holdPunished(u: Unit): void {
  u.engagedId = -1;
  u.pendingHit = 0;
  u.state = 'idle';
  if (u.anim !== 'idle') u.setAnim('idle');
}

/** Crée les surveillants si l'option est active (sans effet sinon ou s'ils existent déjà). */
export function ensureSupervisors(world: World): readonly Supervisor[] {
  const have = store.get(world);
  if (have) return have.list;
  if (!world.rules.supervisors) return EMPTY;
  const { w, h } = world.map;
  const rng = new Rng(((world.map.seed ?? 1) * 7919 + 17) >>> 0);
  const n = supervisorCount(world.map);
  const list: Supervisor[] = [];
  // Répartis en cercle autour du centre, à distance des camps (coins et bords).
  const a0 = rng.next() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    const c = world.grid.nearestFree(w / 2 + Math.cos(a) * w * 0.22, h / 2 + Math.sin(a) * h * 0.22);
    list.push({
      id: i + 1,
      x: c.x + 0.5,
      y: c.y + 0.5,
      dir: 1,
      anim: 'idle',
      animTime: rng.next(),
      mode: 'wait',
      timer: 0.5 + rng.next() * 2,
      path: [],
      goal: null,
      nextScan: i * 0.07,
    });
  }
  const st: State = { list, rng, whistles: 0 };
  store.set(world, st);
  return list;
}

/** Un pas de simulation des surveillants (appelé par World.update). */
export function updateSupervisors(world: World, dt: number): void {
  if (!world.rules.supervisors) return;
  ensureSupervisors(world);
  const st = store.get(world)!;
  for (const s of st.list) updateOne(world, st, s, dt);
}

function updateOne(world: World, st: State, s: Supervisor, dt: number): void {
  s.animTime += dt;
  s.timer -= dt;

  if (s.mode === 'whistle') {
    if (s.timer <= 0) setMode(s, 'wait', 0.6 + st.rng.next() * 0.8);
    return;
  }

  // Recherche d'une bagarre à proximité (étalée dans le temps).
  if (world.time >= s.nextScan) {
    s.nextScan = world.time + SCAN_EVERY;
    const radius = s.mode === 'rush' ? SUPERVISOR_DETECT + 1 : SUPERVISOR_DETECT;
    const f = nearestFighter(world, s.x, s.y, radius);
    if (f) {
      if (dist2(s.x, s.y, f.x, f.y) <= SUPERVISOR_ARRIVE * SUPERVISOR_ARRIVE) {
        whistle(world, st, s);
        return;
      }
      if (s.mode !== 'rush') setMode(s, 'rush', RUSH_TIMEOUT);
      if (!s.goal || dist2(s.goal.x, s.goal.y, f.x, f.y) > 0.36 || s.path.length === 0) goTo(world, s, f.x, f.y);
    } else if (s.mode === 'rush') {
      setMode(s, 'wait', 0.5);
    }
  }

  if (s.mode === 'rush' && s.timer <= 0) setMode(s, 'wait', 1.5);

  if (s.mode === 'wait') {
    if (s.anim !== 'idle') setAnim(s, 'idle');
    if (s.timer <= 0) {
      // Nouvelle destination de patrouille, au hasard dans la cour.
      const { w, h } = world.map;
      const c = world.grid.nearestFree(1 + st.rng.next() * (w - 2), 1 + st.rng.next() * (h - 2));
      goTo(world, s, c.x + 0.5, c.y + 0.5);
      setMode(s, 'patrol', 0);
    }
    return;
  }

  // Patrouille ou intervention : on suit le chemin.
  if (s.path.length === 0) {
    if (s.mode === 'patrol') setMode(s, 'wait', 1 + st.rng.next() * 2.5);
    else setAnim(s, 'idle');
    return;
  }
  follow(world, s, (s.mode === 'rush' ? RUSH_SPEED : PATROL_SPEED) * dt);
}

function setMode(s: Supervisor, m: SupervisorMode, timer: number): void {
  s.mode = m;
  s.timer = timer;
  if (m === 'wait') {
    s.path.length = 0;
    s.goal = null;
  }
}

function setAnim(s: Supervisor, a: Supervisor['anim']): void {
  if (s.anim !== a) {
    s.anim = a;
    s.animTime = 0;
  }
}

function goTo(world: World, s: Supervisor, x: number, y: number): void {
  const from = { x: s.x, y: s.y };
  s.path = smoothPath(world.grid, from, findPath(world.grid, from, { x, y }));
  // Dernier point : la position exacte visée (le chemin s'arrête au centre de la cellule).
  if (s.path.length && world.grid.walkable(x, y)) s.path[s.path.length - 1] = { x, y };
  s.goal = { x, y };
}

function follow(world: World, s: Supervisor, step: number): void {
  const wp = s.path[0];
  const dx = wp.x - s.x;
  const dy = wp.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d <= step || d < 0.05) {
    s.x = wp.x;
    s.y = wp.y;
    s.path.shift();
  } else {
    const nx = s.x + (dx / d) * step;
    const ny = s.y + (dy / d) * step;
    if (world.grid.walkable(nx, ny)) {
      s.x = nx;
      s.y = ny;
    } else s.path.shift();
    s.dir = dirFromVector(dx, dy);
  }
  setAnim(s, 'walk');
}

/** L'élève est-il en train de se battre (engagé contre un ennemi au contact) ? */
export function isFighting(world: World, u: Unit): boolean {
  if (!u.alive || u.engagedId < 0 || u.punishedUntil > world.time) return false;
  const e = world.unitById(u.engagedId);
  if (!e || !e.alive) return false;
  const r = TUNING.punchRange * 1.6;
  return dist2(u.x, u.y, e.x, e.y) <= r * r;
}

let bestFighter: Unit | null = null;
let bestD = 0;

function nearestFighter(world: World, x: number, y: number, r: number): Unit | null {
  bestFighter = null;
  bestD = r * r;
  world.hash.query(x, y, r, (u) => {
    const d = dist2(x, y, u.x, u.y);
    if (d < bestD && isFighting(world, u)) {
      bestD = d;
      bestFighter = u;
    }
  });
  return bestFighter;
}

/** Coup de sifflet : les élèves qui se battent dans le rayon de punition sont punis. */
function whistle(world: World, st: State, s: Supervisor): number {
  const fighters: Unit[] = [];
  world.hash.query(s.x, s.y, SUPERVISOR_PUNISH, (u) => {
    if (dist2(s.x, s.y, u.x, u.y) <= SUPERVISOR_PUNISH * SUPERVISOR_PUNISH && isFighting(world, u)) fighters.push(u);
  });
  // Son adversaire direct, s'il se bat aussi et se tient juste au-delà du rayon, est puni avec lui.
  const reach = SUPERVISOR_PUNISH + 0.5;
  for (let i = 0, n = fighters.length; i < n; i++) {
    const e = world.unitById(fighters[i].engagedId);
    if (e && !fighters.includes(e) && isFighting(world, e) && dist2(s.x, s.y, e.x, e.y) <= reach * reach) fighters.push(e);
  }
  // On punit après la recherche : punir l'un ne doit pas « innocenter » son adversaire.
  for (const u of fighters) punish(world, u, s);
  st.whistles++;
  s.path.length = 0;
  s.goal = null;
  if (fighters.length) s.dir = dirFromVector(fighters[0].x - s.x, fighters[0].y - s.y);
  setMode(s, 'whistle', WHISTLE_SECONDS);
  setAnim(s, 'whistle');
  return fighters.length;
}

/** Punition d'un élève : fin du combat, recul (loin de son adversaire) et 3 s sans bouger. */
export function punish(world: World, u: Unit, from: Vec2): void {
  const e = u.engagedId >= 0 ? world.unitById(u.engagedId) : undefined;
  let dx = u.x - (e ? e.x : from.x);
  let dy = u.y - (e ? e.y : from.y);
  let d = Math.hypot(dx, dy);
  if (d < 1e-3) {
    dx = u.x - from.x;
    dy = u.y - from.y;
    d = Math.hypot(dx, dy) || 1;
  }
  u.kx += (dx / d) * PUSH;
  u.ky += (dy / d) * PUSH;
  if (u.order.kind === 'attack') u.clearOrder();
  u.attackCooldown = Math.max(u.attackCooldown, 0.4);
  u.punishedUntil = world.time + PUNISH_SECONDS;
  holdPunished(u);
}
