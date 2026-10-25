// Camps fantômes (option d'escarmouche `rules.ghostCamps`) : des camps sans propriétaire
// au départ, ajoutés à la carte générée. Capturé, un camp fantôme produit des élèves comme
// un camp normal et compte comme un camp pour la victoire. Logique pure, testée par Vitest.
import { mapForCode, type MapCode } from './mapcode';
import { Rng } from './rng';
import type { GameRules } from './rules';
import type { Tile } from './tile';
import { NO_TEAM, type MapDef, type TileDef } from './types';
import type { World } from './world';

/** Nombre de camps fantômes ajoutés selon la taille de la cour (côté en cellules). */
export function ghostCountFor(w: number): number {
  if (w < 16) return 1;
  if (w < 22) return 2;
  return 3;
}

/** Bonus de score accordé par l'IA à un camp fantôme neutre ou ennemi. */
export const GHOST_AI_NEUTRAL = 0.8;
export const GHOST_AI_ENEMY = 0.4;

type Corner = { x: number; y: number };

/** Graine dérivée de celle de la carte, propre aux camps fantômes (ne touche pas au tirage de la carte). */
function ghostSeed(seed: number): number {
  return (Math.imul((seed >>> 0) ^ 0x6705, 0x9e3779b1) + 0x1f05) >>> 0;
}

/** Distance (en cellules, Tchebychev) entre une cellule et un rectangle 2 × 2 de coin `c` : 0 si dedans. */
function rectDist(c: Corner, x: number, y: number): number {
  const dx = Math.max(c.x - x, 0, x - (c.x + 1));
  const dy = Math.max(c.y - y, 0, y - (c.y + 1));
  return Math.max(dx, dy);
}

const cheb = (a: Corner, b: Corner) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Ajoute à une carte générée ses camps fantômes (1 à 3 selon la taille de la cour) :
 *  - jamais sur une case bonus, un obstacle ou un autre camp (avec si possible une cellule libre autour) ;
 *  - placés équitablement : chaque équipe a à peu près la même distance à son camp fantôme
 *    le plus proche, de préférence vers le centre ;
 *  - symétriques (rotation de 180°) quand la carte l'est (nombre pair d'équipes) ;
 *  - entièrement déterminés par la carte (donc par sa graine et ses réglages).
 * La carte d'origine n'est pas modifiée.
 */
export function addGhostCamps(map: MapDef, count = ghostCountFor(map.w)): MapDef {
  const { w, h } = map;
  const rng = new Rng(ghostSeed(map.seed ?? 1));
  const homes = map.tiles.filter((t) => t.kind === 'camp' && !t.ghost).map((t) => ({ x: t.x + 1, y: t.y + 1 }));
  const camps: Corner[] = map.tiles.filter((t) => t.kind === 'camp').map((t) => ({ x: t.x, y: t.y }));
  const bonus = map.tiles.filter((t) => t.kind === 'bonus');
  const obstacles = map.obstacles ?? [];
  const symmetric = map.teams % 2 === 0;
  const mirror = (c: Corner): Corner => ({ x: w - 2 - c.x, y: h - 2 - c.y });

  const valid = (c: Corner, gap: number): boolean => {
    if (c.x < 1 || c.y < 1 || c.x > w - 3 || c.y > h - 3) return false;
    if (camps.some((o) => cheb(o, c) < 4)) return false;
    if (bonus.some((b) => rectDist(c, b.x, b.y) < gap)) return false;
    if (obstacles.some((o) => rectDist(c, o.x, o.y) < gap)) return false;
    return true;
  };

  // Score d'un ensemble de camps fantômes (plus bas = mieux) : écart entre les équipes
  // (distance de chaque camp de départ au fantôme le plus proche) + éloignement du centre.
  const mx = w / 2;
  const my = h / 2;
  const score = (set: Corner[]): number => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of homes) {
      let d = Infinity;
      for (const c of set) d = Math.min(d, Math.hypot(c.x + 1 - p.x, c.y + 1 - p.y));
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    let central = 0;
    for (const c of set) central += Math.hypot(c.x + 1 - mx, c.y + 1 - my);
    return hi - lo + (0.35 * central) / set.length;
  };

  // Groupes de candidats : un camp seul, ou une paire de camps symétriques.
  type Group = { cs: Corner[]; jitter: number };
  const groupsFor = (gap: number): { singles: Group[]; pairs: Group[] } => {
    const singles: Group[] = [];
    const pairs: Group[] = [];
    for (let y = 1; y <= h - 3; y++) {
      for (let x = 1; x <= w - 3; x++) {
        const c = { x, y };
        if (!valid(c, gap)) continue;
        const jitter = rng.next() * 0.8;
        if (!symmetric) {
          singles.push({ cs: [c], jitter });
          continue;
        }
        const m = mirror(c);
        const d = cheb(c, m);
        // Au centre (ou presque, si la cour a un côté impair) : un camp seul.
        if (d <= 1) singles.push({ cs: [c], jitter });
        else if (d >= 4 && valid(m, gap) && (m.y > c.y || (m.y === c.y && m.x > c.x))) pairs.push({ cs: [c, m], jitter });
      }
    }
    return { singles, pairs };
  };

  // Choix glouton : à chaque étape, le groupe qui garde l'ensemble le plus équitable.
  const attempt = (gap: number, target: number, allowSingle: boolean): Corner[] => {
    const { singles, pairs } = groupsFor(gap);
    const chosen: Corner[] = [];
    const compatible = (cs: Corner[]) => cs.every((c) => chosen.every((o) => cheb(o, c) >= 4));
    const pickFrom = (groups: Group[]): boolean => {
      let best: Corner[] | null = null;
      let bs = Infinity;
      for (const g of groups) {
        if (!compatible(g.cs)) continue;
        const s = score([...chosen, ...g.cs]) + g.jitter;
        if (s < bs) {
          bs = s;
          best = g.cs;
        }
      }
      if (best) chosen.push(...best);
      return !!best;
    };
    if (symmetric) {
      if (target % 2 === 1 && allowSingle) pickFrom(singles);
      while (chosen.length + 2 <= target && pickFrom(pairs));
    } else {
      while (chosen.length < target && pickFrom(singles));
    }
    return chosen;
  };

  const withGhosts = (chosen: Corner[]): MapDef => {
    const extra: TileDef[] = chosen.map((c) => ({ kind: 'camp', x: c.x, y: c.y, ghost: true }));
    return { ...map, tiles: [...map.tiles, ...extra] };
  };

  let chosen: Corner[] = [];
  for (const gap of [2, 1]) {
    chosen = attempt(gap, count, true);
    if (chosen.length === count) return withGhosts(chosen);
  }
  // Carte symétrique dont le centre est pris (case bonus ou obstacle) : une paire de camps
  // symétriques plutôt qu'un camp décentré, pour rester équitable.
  if (symmetric && count % 2 === 1) {
    const target = count === 1 ? 2 : count - 1;
    for (const gap of [2, 1]) {
      const pairs = attempt(gap, target, false);
      if (pairs.length === target) return withGhosts(pairs);
    }
  }
  return chosen.length ? withGhosts(chosen) : map;
}

/** Carte d'une partie : celle du code, plus les camps fantômes si l'option est active (escarmouche seulement). */
export function mapWithRules(code: MapCode, rules?: GameRules): MapDef {
  const map = mapForCode(code);
  return code.spec.kind === 'escarmouche' && rules?.ghostCamps ? addGhostCamps(map) : map;
}

/** Camps fantômes d'une carte ou d'un monde. */
export function ghostCamps<T extends { kind: string; ghost?: boolean }>(tiles: readonly T[]): T[] {
  return tiles.filter((t) => t.kind === 'camp' && t.ghost === true);
}

/** Bonus de score de l'IA pour une case : un camp fantôme neutre ou ennemi est une cible de choix. */
export function ghostAiBonus(world: World, t: Tile, team: number): number {
  if (!t.ghost) return 0;
  if (t.owner === NO_TEAM) return GHOST_AI_NEUTRAL;
  return world.isFriend(t.owner, team) ? 0 : GHOST_AI_ENEMY;
}
