// Bagarres : groupes d'élèves d'équipes ennemies au contact, détectés quelques fois par
// seconde (pas à chaque image) par regroupement spatial. Pour chaque bagarre : la force de
// chaque équipe impliquée (somme des PV restants × dégâts, bonus et améliorations compris)
// et la tendance (qui gagne du terrain sur les dernières secondes).
// Logique pure : le rendu est dans render/brawls.ts, l'alerte hors écran dans ui/brawl-hud.ts.
import { supervisorDamageBonus } from './supervisors';
import type { Unit } from './unit';
import type { World } from './world';

export const BRAWL = {
  /** Secondes entre deux détections. */
  every: 0.25,
  /** Distance (cellules) à laquelle deux ennemis sont « au contact ». */
  contact: 1.1,
  /** Distance de regroupement : deux combattants plus proches font partie de la même bagarre. */
  link: 1.6,
  /** Fenêtre de la tendance (secondes) et écart de part à partir duquel elle s'affiche. */
  trendWindow: 3,
  trendMin: 0.03,
  /** Distance maximale entre deux détections pour reconnaître la même bagarre. */
  follow: 3,
  /** Durée du fondu après la fin d'une bagarre. */
  fade: 0.8,
};

export interface Brawl {
  id: number;
  /** Centre (grille). */
  x: number;
  y: number;
  /** Combattant le plus « haut » à l'écran (plus petit x + y) : la barre se place au-dessus de lui. */
  top: { x: number; y: number };
  /** Équipes impliquées, de la plus forte à la plus faible. */
  teams: number[];
  /** Force par équipe (PV restants × multiplicateur de dégâts), dans l'ordre de `teams`. */
  strength: number[];
  /** Part de chaque équipe dans la force totale (somme = 1), même ordre. */
  shares: number[];
  /** Équipe qui gagne du terrain (sa part a monté d'au moins trendMin sur la fenêtre), ou -1. */
  trendTeam: number;
  trendDelta: number;
  size: number;
  /** Fin de la bagarre (temps du monde) ; null tant qu'elle dure. */
  endedAt: number | null;
  /** Historique des parts par équipe : [temps, Map équipe → part]. */
  history: Array<{ t: number; share: Map<number, number> }>;
}

export class BrawlState {
  list: Brawl[] = [];
  nextAt = 0;
  private nextId = 1;
  newId(): number {
    return this.nextId++;
  }
}

/** Force d'un élève dans une bagarre : PV restants × dégâts (équipe, classe, améliorations, bonus). */
export function fighterStrength(world: World, u: Unit): number {
  const dmg = world.mods[u.team].dmg * u.dmgMul * (world.damageScale[u.team] ?? 1) * supervisorDamageBonus(world, u.team);
  return Math.max(0, u.hp) * dmg;
}

/** Recalcule les bagarres si l'heure est venue (appelé par World.update). */
export function updateBrawls(world: World): void {
  const st = world.brawls;
  // Bagarres terminées : retirées après le fondu.
  st.list = st.list.filter((b) => b.endedAt === null || world.time - b.endedAt < BRAWL.fade);
  if (world.time < st.nextAt) return;
  st.nextAt = world.time + BRAWL.every;
  const clusters = detectClusters(world);
  const alive = st.list.filter((b) => b.endedAt === null);
  const matched = new Set<Brawl>();
  for (const c of clusters) {
    // Même bagarre que la précédente la plus proche (si elle partage une équipe).
    let prev: Brawl | null = null;
    let bd = BRAWL.follow * BRAWL.follow;
    for (const b of alive) {
      if (matched.has(b)) continue;
      const d = (b.x - c.x) ** 2 + (b.y - c.y) ** 2;
      if (d < bd && b.teams.some((t) => c.strength.has(t))) {
        bd = d;
        prev = b;
      }
    }
    const teams = [...c.strength.keys()].sort((a, b) => c.strength.get(b)! - c.strength.get(a)! || a - b);
    const strength = teams.map((t) => c.strength.get(t)!);
    const total = strength.reduce((a, b) => a + b, 0) || 1;
    const shares = strength.map((s) => s / total);
    const share = new Map(teams.map((t, i) => [t, shares[i]]));
    const b: Brawl = prev ?? { id: st.newId(), x: 0, y: 0, top: c.top, teams, strength, shares, trendTeam: -1, trendDelta: 0, size: 0, endedAt: null, history: [] };
    if (prev) matched.add(prev);
    Object.assign(b, { x: c.x, y: c.y, top: c.top, teams, strength, shares, size: c.size });
    b.history.push({ t: world.time, share });
    while (b.history.length > 1 && world.time - b.history[0].t > BRAWL.trendWindow) b.history.shift();
    // Tendance : la plus forte hausse de part depuis le début de la fenêtre.
    const old = b.history[0].share;
    b.trendTeam = -1;
    b.trendDelta = 0;
    for (const t of teams) {
      const d = share.get(t)! - (old.get(t) ?? 0);
      if (d > b.trendDelta) {
        b.trendDelta = d;
        b.trendTeam = t;
      }
    }
    if (b.trendDelta < BRAWL.trendMin) b.trendTeam = -1;
    if (!prev) st.list.push(b);
  }
  // Bagarres qui n'ont plus de combattants : fondu.
  for (const b of alive) if (!matched.has(b)) b.endedAt = world.time;
}

interface Cluster {
  x: number;
  y: number;
  top: { x: number; y: number };
  size: number;
  strength: Map<number, number>;
}

/**
 * Combattants : élèves debout à moins de `contact` d'un ennemi. Ils sont regroupés de proche en
 * proche (distance `link`) ; un groupe où deux équipes ennemies se font face est une bagarre.
 */
export function detectClusters(world: World): Cluster[] {
  const fighters: Unit[] = [];
  const c2 = BRAWL.contact * BRAWL.contact;
  for (const u of world.units) {
    if (!u.alive) continue;
    let hit = false;
    world.hash.query(u.x, u.y, BRAWL.contact, (o) => {
      if (hit || o === u || !o.alive || world.isFriend(o.team, u.team)) return;
      if ((o.x - u.x) ** 2 + (o.y - u.y) ** 2 <= c2) hit = true;
    });
    if (hit) fighters.push(u);
  }
  if (fighters.length === 0) return [];
  // Regroupement : union-find sur les combattants proches.
  const index = new Map<Unit, number>();
  fighters.forEach((u, i) => index.set(u, i));
  const parent = fighters.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const l2 = BRAWL.link * BRAWL.link;
  for (const u of fighters) {
    const i = index.get(u)!;
    world.hash.query(u.x, u.y, BRAWL.link, (o) => {
      const j = index.get(o);
      if (j === undefined || j === i) return;
      if ((o.x - u.x) ** 2 + (o.y - u.y) ** 2 <= l2) parent[find(i)] = find(j);
    });
  }
  const groups = new Map<number, Unit[]>();
  for (let i = 0; i < fighters.length; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(fighters[i]);
  }
  const out: Cluster[] = [];
  for (const g of groups.values()) {
    const strength = new Map<number, number>();
    let x = 0;
    let y = 0;
    let top = g[0];
    for (const u of g) {
      strength.set(u.team, (strength.get(u.team) ?? 0) + fighterStrength(world, u));
      x += u.x;
      y += u.y;
      if (u.x + u.y < top.x + top.y) top = u;
    }
    const teams = [...strength.keys()];
    let hostile = false;
    for (let i = 0; i < teams.length && !hostile; i++) for (let j = i + 1; j < teams.length; j++) if (!world.isFriend(teams[i], teams[j])) hostile = true;
    if (!hostile) continue;
    out.push({ x: x / g.length, y: y / g.length, top: { x: top.x, y: top.y }, size: g.length, strength });
  }
  return out;
}

/** Bagarres en cours (non terminées) où l'équipe est impliquée. */
export function brawlsOf(world: World, team: number): Brawl[] {
  return world.brawls.list.filter((b) => b.endedAt === null && b.teams.includes(team));
}
