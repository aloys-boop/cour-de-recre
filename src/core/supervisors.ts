import { TUNING } from '../config';
import { dirFromVector, dist2 } from './math';
import { findPath, smoothPath } from './pathfinding';
import { Rng } from './rng';
import { NO_TEAM, type Dir, type MapDef, type Vec2 } from './types';
import type { Unit } from './unit';
import type { World } from './world';
import { MERITS, awardMerit } from './merits';

/**
 * Option d'escarmouche « Surveillants » (rules.supervisors) : des adultes costauds, neutres et
 * hostiles à toutes les équipes, patrouillent dans la cour comme des mini-boss.
 *  - Ils frappent tout élève qui entre dans leur rayon d'agression ou qui les frappe, le poursuivent
 *    un peu (laisse de SUPERVISOR_LEASH cases autour de l'endroit où le combat a commencé), puis
 *    reviennent patrouiller et se régénèrent lentement hors combat.
 *  - Leur coup est lourd et touche aussi les élèves collés à la cible (frappe de zone, gros recul).
 *  - Mis KO, ils s'effondrent ; l'équipe qui a porté le dernier coup gagne un bonus de dégâts
 *    temporaire ; ils reviennent SUPERVISOR_RESPAWN secondes plus tard à un bord de la cour.
 *
 * Les surveillants ne sont pas des élèves : ils ne figurent pas dans `world.units`, n'appartiennent
 * à aucune équipe, ne capturent rien. Un élève les vise par `unit.supId` (au lieu de `engagedId`).
 * Leur état est rangé à part (WeakMap par monde), créé au premier pas de simulation.
 */

/** Points de vie d'un surveillant : ceux de 10 élèves de base. */
export const SUPERVISOR_HP = 10 * TUNING.unitHp;
/** Dégâts d’un coup de surveillant (≈ 4 fois un coup d’élève, 7 à 11). */
export const SUPERVISOR_DMG_MIN = 32;
export const SUPERVISOR_DMG_MAX = 40;
/** Secondes entre deux coups (un élève : 0,75 s). */
export const SUPERVISOR_INTERVAL = 0.95;
/** Portée du coup d'un surveillant (centre à centre, cellules). */
export const SUPERVISOR_REACH = 0.85;
/** Rayon du corps : les élèves le frappent de plus loin qu'un autre élève et ne le traversent pas. */
export const SUPERVISOR_BODY = 0.3;
/** Distance (centre à centre) à laquelle un élève peut frapper un surveillant. */
export const SUPERVISOR_HIT_RANGE = TUNING.punchRange + SUPERVISOR_BODY;
/** Frappe de zone : les élèves à moins de cette distance de la cible sont touchés aussi. */
export const SUPERVISOR_SPLASH = 0.6;
/** Part des dégâts reçue par les élèves touchés par la frappe de zone. */
export const SUPERVISOR_SPLASH_FACTOR = 0.6;
/** Recul supplémentaire infligé par un coup de surveillant (vitesse initiale, cellules/s). */
export const SUPERVISOR_KNOCK = 3.2;
/** Rayon d'agression : un élève qui s'approche plus près se fait attaquer. */
export const SUPERVISOR_AGGRO = 2.5;
/** Distance maximale de poursuite autour de l'endroit où le combat a commencé. */
export const SUPERVISOR_LEASH = 5;
/** Régénération hors combat (part des PV max par seconde) et délai avant qu'elle commence. */
export const SUPERVISOR_REGEN = 0.015;
export const SUPERVISOR_REGEN_DELAY = 4;
/** Durée de l'animation de KO, puis délai de retour (compté depuis le KO). */
export const SUPERVISOR_KO_SECONDS = 3;
export const SUPERVISOR_RESPAWN = 45;
/** Récompense du KO : bonus de dégâts de l'équipe qui a porté le dernier coup. */
export const SUPERVISOR_BUFF = 0.25;
export const SUPERVISOR_BUFF_SECONDS = 30;
/** Taille d'affichage d'un surveillant par rapport à un élève. */
export const SUPERVISOR_SCALE = 1.45;

const PATROL_SPEED = TUNING.unitSpeed * 0.45;
const CHASE_SPEED = TUNING.unitSpeed * 0.9;
const RETURN_SPEED = TUNING.unitSpeed * 0.6;
const SCAN_EVERY = 0.25;
/** Coup de sifflet avant de charger (le joueur voit venir l'attaque). */
const ALERT_SECONDS = 0.45;
/** Délai entre l'élan et l'impact du coup. */
const WINDUP = 0.28;

export type SupervisorMode = 'patrol' | 'wait' | 'alert' | 'fight' | 'return' | 'ko' | 'away';

export interface Supervisor {
  readonly kind: 'supervisor';
  readonly id: number;
  /** Toujours NO_TEAM : neutre et hostile à toutes les équipes. */
  readonly team: number;
  x: number;
  y: number;
  dir: Dir;
  anim: 'idle' | 'walk' | 'whistle' | 'punch' | 'ko';
  animTime: number;
  mode: SupervisorMode;
  /** Temps restant de l'état courant (attente, sifflet, KO, absence). */
  timer: number;
  path: Vec2[];
  /** Destination du chemin courant. */
  goal: Vec2 | null;
  /** Instant de la prochaine recherche de cible. */
  nextScan: number;
  hp: number;
  maxHp: number;
  /** Élève visé (-1 : aucun). */
  targetId: number;
  /** Centre de la zone de combat (laisse de poursuite), null hors combat. */
  anchor: Vec2 | null;
  attackCooldown: number;
  /** Temps restant avant que le coup en cours ne porte (0 si aucun). */
  pendingHit: number;
  /** Dernier instant de combat (coup donné ou reçu), pour la régénération. */
  lastCombat: number;
  /** Dernier coup reçu (clignotement) et équipe qui l'a porté. */
  hurtAt: number;
  lastHitTeam: number;
}

export interface SupervisorEvent {
  kind: 'supKo';
  x: number;
  y: number;
  /** Équipe qui a porté le dernier coup. */
  team: number;
}

interface State {
  list: Supervisor[];
  rng: Rng;
  /** Engagements depuis le dernier `takeWhistles` (son). */
  whistles: number;
  /** Fin du bonus de dégâts de chaque équipe (temps du monde). */
  buffUntil: number[];
}

const store = new WeakMap<World, State>();
const EMPTY: readonly Supervisor[] = [];

/** Nombre de surveillants selon la taille de la cour : 2 sur les petites, 3 à 4 sur les grandes. */
export function supervisorCount(map: Pick<MapDef, 'w' | 'h'>): number {
  const side = Math.sqrt(map.w * map.h);
  return side < 18 ? 2 : side < 23 ? 3 : 4;
}

/** Surveillants de la partie, y compris KO ou absents (vide si l'option est inactive). */
export function supervisorsOf(world: World): readonly Supervisor[] {
  return store.get(world)?.list ?? EMPTY;
}

/** Le surveillant est-il debout dans la cour (ni KO ni absent) ? */
export function supervisorActive(s: Supervisor): boolean {
  return s.mode !== 'ko' && s.mode !== 'away';
}

export function isSupervisor(x: unknown): x is Supervisor {
  return !!x && (x as { kind?: string }).kind === 'supervisor';
}

export function supervisorById(world: World, id: number): Supervisor | undefined {
  const st = store.get(world);
  if (!st) return undefined;
  for (const s of st.list) if (s.id === id) return s;
  return undefined;
}

/** Nombre de surveillants debout à moins de `r` cellules d'un point (pour l'IA). */
export function supervisorsNear(world: World, x: number, y: number, r: number): number {
  const st = store.get(world);
  if (!st) return 0;
  let n = 0;
  for (const s of st.list) if (supervisorActive(s) && dist2(s.x, s.y, x, y) < r * r) n++;
  return n;
}

/** Surveillant debout le plus proche à moins de `r` cellules, ou null. */
export function nearestSupervisor(world: World, x: number, y: number, r: number, accept?: (s: Supervisor) => boolean): Supervisor | null {
  const st = store.get(world);
  if (!st) return null;
  let best: Supervisor | null = null;
  let bd = r * r;
  for (const s of st.list) {
    if (!supervisorActive(s)) continue;
    const d = dist2(s.x, s.y, x, y);
    if (d < bd && (!accept || accept(s))) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Nombre de coups de sifflet (surveillant qui engage un combat) depuis le dernier appel. */
export function takeWhistles(world: World): number {
  const st = store.get(world);
  if (!st) return 0;
  const n = st.whistles;
  st.whistles = 0;
  return n;
}

/** Multiplicateur de dégâts d'une équipe dû au KO d'un surveillant (1 sans bonus). */
export function supervisorDamageBonus(world: World, team: number): number {
  const st = store.get(world);
  return st && (st.buffUntil[team] ?? 0) > world.time ? 1 + SUPERVISOR_BUFF : 1;
}

/** Secondes de bonus de dégâts restantes pour une équipe (0 : aucun). */
export function supervisorBuffLeft(world: World, team: number): number {
  const st = store.get(world);
  return st ? Math.max(0, (st.buffUntil[team] ?? 0) - world.time) : 0;
}

/** Annonce du KO d'un surveillant (« Les Verts ont mis KO un surveillant ! »). */
export function supervisorAnnouncement(ev: { kind: string; team: number }, playerTeam: number, teamPlural: (team: number) => string): string | null {
  if (ev.kind !== 'supKo') return null;
  if (ev.team === playerTeam) return `Tu as mis KO un surveillant ! Dégâts +${Math.round(SUPERVISOR_BUFF * 100)} % pendant ${SUPERVISOR_BUFF_SECONDS} s.`;
  const who = teamPlural(ev.team);
  return `${who.charAt(0).toUpperCase()}${who.slice(1)} ont mis KO un surveillant !`;
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
      kind: 'supervisor',
      id: i + 1,
      team: NO_TEAM,
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
      hp: SUPERVISOR_HP,
      maxHp: SUPERVISOR_HP,
      targetId: -1,
      anchor: null,
      attackCooldown: 0,
      pendingHit: 0,
      lastCombat: -1e9,
      hurtAt: -1e9,
      lastHitTeam: NO_TEAM,
    });
  }
  const st: State = { list, rng, whistles: 0, buffUntil: [] };
  store.set(world, st);
  return list;
}

/** Un pas de simulation des surveillants (appelé par World.update). */
export function updateSupervisors(world: World, dt: number): void {
  if (!world.rules.supervisors) return;
  ensureSupervisors(world);
  const st = store.get(world)!;
  for (const s of st.list) {
    updateOne(world, st, s, dt);
    if (supervisorActive(s)) pushStudentsAway(world, s);
  }
}

/**
 * Coup d'un élève sur un surveillant (appelé par World quand le coup porte).
 * Retourne vrai si le surveillant est mis KO.
 */
export function hitSupervisor(world: World, s: Supervisor, dmg: number, attacker: Unit): boolean {
  const st = store.get(world);
  if (!st || !supervisorActive(s)) return false;
  s.hp -= dmg;
  s.lastCombat = world.time;
  s.hurtAt = world.time;
  s.lastHitTeam = attacker.team;
  world.events.push({ kind: 'hit', x: s.x, y: s.y, team: attacker.team });
  if (s.hp <= 0) {
    knockOut(world, st, s, attacker.team);
    return true;
  }
  // Riposte : un surveillant au calme se retourne contre son agresseur ; en rentrant, seulement
  // si l'agresseur est encore dans sa zone.
  if (s.mode === 'patrol' || s.mode === 'wait') engage(world, st, s, attacker);
  else if (s.mode === 'return' && s.anchor && dist2(attacker.x, attacker.y, s.anchor.x, s.anchor.y) <= SUPERVISOR_LEASH * SUPERVISOR_LEASH) engage(world, st, s, attacker);
  return false;
}

function knockOut(world: World, st: State, s: Supervisor, team: number): void {
  s.hp = 0;
  s.mode = 'ko';
  s.timer = SUPERVISOR_KO_SECONDS;
  s.path.length = 0;
  s.goal = null;
  s.targetId = -1;
  s.anchor = null;
  s.pendingHit = 0;
  setAnim(s, 'ko');
  if (team >= 0) st.buffUntil[team] = world.time + SUPERVISOR_BUFF_SECONDS;
  world.events.push({ kind: 'supKo', x: s.x, y: s.y, team });
  if (team >= 0) awardMerit(world, team, MERITS.supervisor, s.x, s.y, 'supervisor');
}

/** Retour d'un surveillant KO, à un bord de la cour, loin des camps. */
function respawn(world: World, st: State, s: Supervisor): void {
  const { w, h } = world.map;
  let best: Vec2 | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const side = Math.floor(st.rng.next() * 4);
    const t = 0.2 + st.rng.next() * 0.6;
    const x = side === 0 ? 0.5 : side === 1 ? w - 0.5 : t * w;
    const y = side === 2 ? 0.5 : side === 3 ? h - 0.5 : t * h;
    const c = world.grid.nearestFree(x, y);
    const px = c.x + 0.5;
    const py = c.y + 0.5;
    let near = Infinity;
    for (const tile of world.tiles) if (tile.isCamp) near = Math.min(near, Math.hypot(tile.cx - px, tile.cy - py));
    // Loin des camps, et loin des élèves si possible.
    let crowd = 0;
    world.hash.query(px, py, 2.5, (u) => {
      if (u.alive) crowd++;
    });
    const score = Math.min(near, 8) - crowd * 1.5 + st.rng.next() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = { x: px, y: py };
    }
  }
  const p = best ?? { x: w / 2, y: h / 2 };
  s.x = p.x;
  s.y = p.y;
  s.hp = s.maxHp;
  s.targetId = -1;
  s.anchor = null;
  s.attackCooldown = 0;
  s.pendingHit = 0;
  s.lastCombat = -1e9;
  s.lastHitTeam = NO_TEAM;
  s.nextScan = world.time + 1; // une seconde de répit à l'arrivée
  setMode(s, 'wait', 0.4);
  setAnim(s, 'idle');
}

function updateOne(world: World, st: State, s: Supervisor, dt: number): void {
  s.animTime += dt;
  s.timer -= dt;
  if (s.mode === 'away') {
    if (s.timer <= 0) respawn(world, st, s);
    return;
  }
  if (s.mode === 'ko') {
    if (s.timer <= 0) {
      s.mode = 'away';
      s.timer = SUPERVISOR_RESPAWN - SUPERVISOR_KO_SECONDS;
    }
    return;
  }
  if (s.attackCooldown > 0) s.attackCooldown -= dt;
  // Régénération lente hors combat.
  if (s.hp < s.maxHp && world.time - s.lastCombat > SUPERVISOR_REGEN_DELAY) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * SUPERVISOR_REGEN * dt);

  // Coup en cours : il porte après l'élan.
  if (s.pendingHit > 0) {
    s.pendingHit -= dt;
    if (s.pendingHit <= 0) {
      s.pendingHit = 0;
      strike(world, st, s);
    }
  }

  if (s.mode === 'alert') {
    const t = world.unitById(s.targetId);
    if (t && t.alive) s.dir = dirFromVector(t.x - s.x, t.y - s.y);
    if (s.timer > 0) return;
    s.mode = 'fight';
  }
  if (s.mode === 'fight') return fight(world, st, s, dt);
  if (s.mode === 'return') {
    if (s.path.length === 0) {
      s.anchor = null;
      setMode(s, 'wait', 0.8 + st.rng.next());
      setAnim(s, 'idle');
    } else follow(world, s, RETURN_SPEED * dt);
    return;
  }

  // Patrouille : un élève trop proche se fait attaquer.
  if (world.time >= s.nextScan) {
    s.nextScan = world.time + SCAN_EVERY;
    const u = nearestStudent(world, s.x, s.y, SUPERVISOR_AGGRO, null);
    if (u) return engage(world, st, s, u);
  }

  if (s.mode === 'wait') {
    if (s.anim !== 'idle' && !(s.anim === 'punch' && s.animTime < 0.5)) setAnim(s, 'idle');
    if (s.timer <= 0) {
      // Nouvelle destination de patrouille, au hasard dans la cour.
      const c = patrolGoal(world, st);
      goTo(world, s, c.x, c.y);
      setMode(s, 'patrol', 0);
    }
    return;
  }

  if (s.path.length === 0) {
    setMode(s, 'wait', 1 + st.rng.next() * 2.5);
    return;
  }
  follow(world, s, PATROL_SPEED * dt);
}

/** Destination de patrouille au hasard dans la cour, de préférence loin des camps. */
function patrolGoal(world: World, st: State): Vec2 {
  const { w, h } = world.map;
  let best: Vec2 = { x: w / 2, y: h / 2 };
  let bestNear = -1;
  for (let i = 0; i < 6; i++) {
    const c = world.grid.nearestFree(1 + st.rng.next() * (w - 2), 1 + st.rng.next() * (h - 2));
    const p = { x: c.x + 0.5, y: c.y + 0.5 };
    let near = Infinity;
    for (const t of world.tiles) if (t.isCamp) near = Math.min(near, Math.hypot(t.cx - p.x, t.cy - p.y));
    if (near >= 3.5) return p;
    if (near > bestNear) {
      bestNear = near;
      best = p;
    }
  }
  return best;
}

/** Le surveillant engage le combat contre `u` (coup de sifflet s'il était au calme). */
function engage(world: World, st: State, s: Supervisor, u: Unit): void {
  s.targetId = u.id;
  s.lastCombat = world.time;
  if (!s.anchor) s.anchor = { x: s.x, y: s.y };
  if (s.mode === 'patrol' || s.mode === 'wait') {
    st.whistles++;
    s.path.length = 0;
    s.goal = null;
    s.dir = dirFromVector(u.x - s.x, u.y - s.y);
    s.mode = 'alert';
    s.timer = ALERT_SECONDS;
    setAnim(s, 'whistle');
  } else s.mode = 'fight';
}

function goReturn(world: World, s: Supervisor): void {
  s.targetId = -1;
  s.mode = 'return';
  s.timer = 0;
  const a = s.anchor ?? { x: s.x, y: s.y };
  goTo(world, s, a.x, a.y);
}

function fight(world: World, st: State, s: Supervisor, dt: number): void {
  const a = s.anchor ?? (s.anchor = { x: s.x, y: s.y });
  const L2 = SUPERVISOR_LEASH * SUPERVISOR_LEASH;
  const inZone = (u: Unit) => dist2(u.x, u.y, a.x, a.y) <= L2;
  let t = s.targetId >= 0 ? world.unitById(s.targetId) : undefined;
  if (t && (!t.alive || !inZone(t))) t = undefined;
  if (world.time >= s.nextScan || !t) {
    s.nextScan = world.time + 0.2;
    // Cible hors de portée : on préfère un élève déjà au contact ; sans cible, le plus proche.
    if (!t || dist2(s.x, s.y, t.x, t.y) > SUPERVISOR_REACH * SUPERVISOR_REACH) {
      const n = nearestStudent(world, s.x, s.y, t ? SUPERVISOR_REACH : SUPERVISOR_AGGRO, a);
      if (n) t = n;
    }
  }
  if (!t) {
    if (s.pendingHit === 0) goReturn(world, s);
    return;
  }
  s.targetId = t.id;
  if (dist2(s.x, s.y, a.x, a.y) > L2) return goReturn(world, s);
  const d2 = dist2(s.x, s.y, t.x, t.y);
  if (d2 <= SUPERVISOR_REACH * SUPERVISOR_REACH) {
    s.dir = dirFromVector(t.x - s.x, t.y - s.y);
    s.path.length = 0;
    s.goal = null;
    s.lastCombat = world.time;
    if (s.attackCooldown <= 0 && s.pendingHit === 0) {
      s.attackCooldown = SUPERVISOR_INTERVAL * (0.95 + 0.1 * st.rng.next());
      s.pendingHit = WINDUP;
      s.anim = 'punch';
      s.animTime = 0;
      world.events.push({ kind: 'punch', x: s.x, y: s.y, team: NO_TEAM });
    } else if (s.anim !== 'punch' || s.animTime > 0.55) setAnim(s, 'idle');
    return;
  }
  if (s.pendingHit > 0) return; // pas de déplacement pendant l'élan
  if (!s.goal || dist2(s.goal.x, s.goal.y, t.x, t.y) > 0.36 || s.path.length === 0) goTo(world, s, t.x, t.y);
  if (s.path.length) follow(world, s, CHASE_SPEED * dt);
}

/** Le coup porte : la cible et les élèves collés à elle encaissent, avec un gros recul. */
function strike(world: World, st: State, s: Supervisor): void {
  const t = s.targetId >= 0 ? world.unitById(s.targetId) : undefined;
  const r = SUPERVISOR_REACH * 1.4;
  if (!t || !t.alive || dist2(s.x, s.y, t.x, t.y) > r * r) return;
  const dmg = Math.round(SUPERVISOR_DMG_MIN + (SUPERVISOR_DMG_MAX - SUPERVISOR_DMG_MIN) * st.rng.next());
  const splash: Unit[] = [];
  world.hash.query(t.x, t.y, SUPERVISOR_SPLASH, (o) => {
    if (o !== t && o.alive && dist2(o.x, o.y, t.x, t.y) <= SUPERVISOR_SPLASH * SUPERVISOR_SPLASH) splash.push(o);
  });
  hurt(world, s, t, dmg);
  const sd = Math.max(1, Math.round(dmg * SUPERVISOR_SPLASH_FACTOR));
  for (const o of splash) hurt(world, s, o, sd);
}

function hurt(world: World, s: Supervisor, u: Unit, dmg: number): void {
  const ko = u.takeDamage(dmg, s.x, s.y);
  let dx = u.x - s.x;
  let dy = u.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-3) {
    dx = Math.cos(u.id);
    dy = Math.sin(u.id);
  } else {
    dx /= d;
    dy /= d;
  }
  u.kx += dx * SUPERVISOR_KNOCK;
  u.ky += dy * SUPERVISOR_KNOCK;
  world.events.push({ kind: 'hit', x: u.x, y: u.y, team: u.team });
  if (ko) world.events.push({ kind: 'ko', x: u.x, y: u.y, team: u.team });
}

/** Les élèves ne traversent pas un surveillant : ceux qui le chevauchent sont repoussés. */
function pushStudentsAway(world: World, s: Supervisor): void {
  const r = SUPERVISOR_BODY + TUNING.unitRadius * 0.8;
  world.hash.query(s.x, s.y, r, (u) => {
    if (!u.alive) return;
    const dx = u.x - s.x;
    const dy = u.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d >= r) return;
    const k = d < 1e-3 ? 1 : (r - d) / d;
    const ux = d < 1e-3 ? Math.cos(u.id) * r : dx * k * 0.6;
    const uy = d < 1e-3 ? Math.sin(u.id) * r : dy * k * 0.6;
    if (world.grid.walkable(u.x + ux, u.y + uy)) {
      u.x += ux;
      u.y += uy;
    }
  });
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

let bestStudent: Unit | null = null;
let bestD = 0;

/** Élève vivant le plus proche à moins de `r` (et dans la zone de laisse `zone`, si donnée). */
function nearestStudent(world: World, x: number, y: number, r: number, zone: Vec2 | null): Unit | null {
  bestStudent = null;
  bestD = r * r;
  const L2 = SUPERVISOR_LEASH * SUPERVISOR_LEASH;
  world.hash.query(x, y, r, (u) => {
    if (!u.alive) return;
    const d = dist2(x, y, u.x, u.y);
    if (d < bestD && (!zone || dist2(u.x, u.y, zone.x, zone.y) <= L2)) {
      bestD = d;
      bestStudent = u;
    }
  });
  return bestStudent;
}
