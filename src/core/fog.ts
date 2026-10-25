/**
 * Brouillard de guerre (option d'escarmouche `rules.fog`).
 *
 * Visibilité par cellule de la grille, du point de vue d'une équipe et de ses alliés :
 *  - visible : à moins de FOG_VIEW_RADIUS d'un élève vivant de l'équipe ou d'un allié,
 *    ou à moins de FOG_TILE_RADIUS d'une case (ou d'un camp) qu'ils possèdent ;
 *  - déjà vu : cellule vue au moins une fois (sol et cases avec leur dernier propriétaire connu) ;
 *  - jamais vu : le reste.
 *
 * Le calcul est mis en cache par monde et par équipe, et refait au plus toutes les
 * FOG_INTERVAL secondes de jeu (pas à chaque image). Sans l'option, tout est visible.
 * Logique pure, sans navigateur : testée par Vitest.
 */
import type { Tile } from './tile';
import { NO_TEAM } from './types';
import type { Unit } from './unit';
import type { World } from './world';

/** Rayon de vue d'un élève, en cases. */
export const FOG_VIEW_RADIUS = 3.5;
/** Rayon de vue autour d'une case ou d'un camp possédé (mesuré depuis son bord). */
export const FOG_TILE_RADIUS = 2.5;
/** Intervalle minimal entre deux recalculs (secondes de jeu) : 10 fois par seconde au plus. */
export const FOG_INTERVAL = 0.1;

/** Visibilité d'une équipe (et de ses alliés) sur la grille. */
export class FogMap {
  readonly w: number;
  readonly h: number;
  /** 1 = visible maintenant. */
  readonly visible: Uint8Array;
  /** 1 = vue au moins une fois. */
  readonly seen: Uint8Array;
  /** Dernier propriétaire observé de chaque case (index dans world.tiles), -2 = jamais vue. */
  readonly knownOwner: Int16Array;
  /** Chaque case (index dans world.tiles) est-elle visible maintenant ? */
  readonly tileVisible: Uint8Array;
  /** Temps de jeu du dernier calcul (−∞ : jamais calculé). */
  time = -Infinity;
  /** Nombre de recalculs (pour les mesures). */
  computeCount = 0;

  constructor(
    w: number,
    h: number,
    tileCount: number,
    readonly team: number,
  ) {
    this.w = w;
    this.h = h;
    this.visible = new Uint8Array(w * h);
    this.seen = new Uint8Array(w * h);
    this.knownOwner = new Int16Array(tileCount).fill(-2);
    this.tileVisible = new Uint8Array(tileCount);
  }

  /** Cellule visible ? (hors de la grille : non). */
  cellVisible(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return false;
    return this.visible[cy * this.w + cx] === 1;
  }

  cellSeen(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return false;
    return this.seen[cy * this.w + cx] === 1;
  }

  /** Position continue (coordonnées grille) visible ? */
  visibleAt(x: number, y: number): boolean {
    return this.cellVisible(Math.floor(x), Math.floor(y));
  }

  /** Recalcule la visibilité de `team` (et de ses alliés) dans `world`. */
  compute(world: World): void {
    const { w, h, visible, seen } = this;
    visible.fill(0);
    const friend = (t: number) => t !== NO_TEAM && world.isFriend(t, this.team);
    // Élèves : disque de rayon FOG_VIEW_RADIUS autour de chacun.
    const r = FOG_VIEW_RADIUS;
    const r2 = r * r;
    for (const u of world.units) {
      if (!u.alive || !friend(u.team)) continue;
      const x0 = Math.max(0, Math.floor(u.x - r));
      const x1 = Math.min(w - 1, Math.floor(u.x + r));
      const y0 = Math.max(0, Math.floor(u.y - r));
      const y1 = Math.min(h - 1, Math.floor(u.y + r));
      for (let cy = y0; cy <= y1; cy++) {
        const dy = cy + 0.5 - u.y;
        const row = cy * w;
        for (let cx = x0; cx <= x1; cx++) {
          const dx = cx + 0.5 - u.x;
          if (dx * dx + dy * dy <= r2) visible[row + cx] = 1;
        }
      }
    }
    // Cases et camps possédés : tout ce qui est à moins de FOG_TILE_RADIUS de leur bord.
    const tr = FOG_TILE_RADIUS;
    const tr2 = tr * tr;
    for (const t of world.tiles) {
      if (!friend(t.owner)) continue;
      const ax = t.x;
      const ay = t.y;
      const bx = t.x + t.size;
      const by = t.y + t.size;
      const x0 = Math.max(0, Math.floor(ax - tr));
      const x1 = Math.min(w - 1, Math.floor(bx + tr));
      const y0 = Math.max(0, Math.floor(ay - tr));
      const y1 = Math.min(h - 1, Math.floor(by + tr));
      for (let cy = y0; cy <= y1; cy++) {
        const py = cy + 0.5;
        const dy = py < ay ? ay - py : py > by ? py - by : 0;
        const row = cy * w;
        for (let cx = x0; cx <= x1; cx++) {
          const px = cx + 0.5;
          const dx = px < ax ? ax - px : px > bx ? px - bx : 0;
          if (dx * dx + dy * dy <= tr2) visible[row + cx] = 1;
        }
      }
    }
    for (let i = 0; i < visible.length; i++) if (visible[i]) seen[i] = 1;
    // Cases : visibles si une de leurs cellules l'est ; on retient alors leur propriétaire.
    world.tiles.forEach((t, i) => {
      const vis = tileCellsVisible(this, t);
      this.tileVisible[i] = vis ? 1 : 0;
      if (vis) this.knownOwner[i] = t.owner;
    });
    this.time = world.time;
    this.computeCount++;
  }
}

function tileCellsVisible(fog: FogMap, t: Tile): boolean {
  for (let y = t.y; y < t.y + t.size; y++) for (let x = t.x; x < t.x + t.size; x++) if (fog.cellVisible(x, y)) return true;
  return false;
}

const cache = new WeakMap<World, Map<number, FogMap>>();

/** Le brouillard est-il actif dans cette partie ? */
export function fogEnabled(world: World): boolean {
  return !!world.rules.fog;
}

/**
 * Carte de visibilité de `team` (à jour à FOG_INTERVAL près), ou null si l'option est inactive.
 * `force` impose un recalcul immédiat.
 */
export function fogFor(world: World, team: number, force = false): FogMap | null {
  if (!fogEnabled(world)) return null;
  let byTeam = cache.get(world);
  if (!byTeam) {
    byTeam = new Map();
    cache.set(world, byTeam);
  }
  let fog = byTeam.get(team);
  if (!fog) {
    fog = new FogMap(world.map.w, world.map.h, world.tiles.length, team);
    byTeam.set(team, fog);
  }
  const age = world.time - fog.time;
  if (force || age >= FOG_INTERVAL || age < 0) fog.compute(world);
  return fog;
}

/** Une position (coordonnées grille) est-elle visible pour `team` ? Toujours vrai sans brouillard. */
export function pointVisible(world: World, team: number, x: number, y: number): boolean {
  const fog = fogFor(world, team);
  return !fog || fog.visibleAt(x, y);
}

/** `team` voit-il cet élève ? Ses élèves et ceux de ses alliés sont toujours visibles. */
export function unitVisible(world: World, team: number, u: Unit): boolean {
  if (world.isFriend(u.team, team)) return true;
  return pointVisible(world, team, u.x, u.y);
}

/** `team` peut-il attaquer cet élève (vivant, ennemi et visible) ? */
export function canTargetUnit(world: World, team: number, u: Unit): boolean {
  return u.alive && !world.isFriend(u.team, team) && unitVisible(world, team, u);
}

/** Ce que `team` sait d'une case : propriétaire affiché, visible maintenant, déjà vue. */
export interface TileView {
  owner: number;
  visible: boolean;
  seen: boolean;
}

/** Vue d'une case par `team` : dans le déjà-vu, le propriétaire est celui de la dernière observation. */
export function tileView(world: World, team: number, t: Tile): TileView {
  const fog = fogFor(world, team);
  if (!fog) return { owner: t.owner, visible: true, seen: true };
  const i = world.tiles.indexOf(t);
  if (i < 0 || fog.tileVisible[i]) return { owner: t.owner, visible: true, seen: true };
  const known = fog.knownOwner[i];
  return { owner: known === -2 ? NO_TEAM : known, visible: false, seen: known !== -2 };
}

/** Un événement (coup, KO, capture) situé en (x, y) est-il perçu par `team` (son, effet) ? */
export function eventPerceived(world: World, team: number, ev: { kind: string; x: number; y: number }): boolean {
  if (ev.kind !== 'punch' && ev.kind !== 'hit' && ev.kind !== 'ko' && ev.kind !== 'captured') return true;
  return pointVisible(world, team, ev.x, ev.y);
}
