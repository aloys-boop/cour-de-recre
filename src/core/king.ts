// Mode « Roi de la cour » : un trône 2 × 2 au centre de la cour. L'équipe qui le possède
// accumule du temps de règne ; la première à 2 minutes cumulées gagne (avec ses alliés,
// comme pour les camps). Les règles classiques de victoire restent valables en parallèle.
// Logique pure, sans DOM : appelée par World.update, testée par Vitest.
import { TEAM_PLURALS } from '../config';
import type { GameRules } from './rules';
import type { Tile } from './tile';
import { NO_TEAM, type MapDef, type TileDef } from './types';
import type { World } from './world';

export const KING = {
  /** Temps de règne cumulé qui donne la victoire (secondes). */
  winSeconds: 120,
  /** Annonces « Plus que… » quand il reste ce nombre de secondes de règne. */
  warnAt: [60, 20] as readonly number[],
  /** Cellules dégagées autour du trône (ni case bonus ni obstacle). */
  clearMargin: 1,
  /** Attrait de base du trône dans le choix de cible des IA. */
  aiScore: 1.3,
  /** Attrait supplémentaire quand son propriétaire approche de la victoire (× part du règne accompli). */
  aiUrgency: 1.2,
  /** Une IA vise le trône malgré la foule : on lui rend une partie de la pénalité « ennemis proches ». */
  aiCrowdRelief: 0.15,
  /** Garnison gardée sur le trône par l'IA qui le tient : part de ses élèves, avec un minimum. */
  aiGarrisonFrac: 0.3,
  aiGarrisonMin: 3,
};

/** Événements du mode Roi de la cour (ajoutés à la file d'événements du monde). */
export type KingEvent =
  | { kind: 'kingTake'; x: number; y: number; team: number }
  | { kind: 'kingSoon'; x: number; y: number; team: number; left: number }
  | { kind: 'kingWin'; x: number; y: number; team: number };

/** État du mode, porté par le monde. */
export class KingState {
  /** Case trône (trouvée au premier pas de simulation), ou null. */
  throne: Tile | null = null;
  /** Temps de règne cumulé par équipe (secondes). */
  reign: number[] = [];
  /** Équipe qui a atteint le temps de règne, ou NO_TEAM. */
  winner = NO_TEAM;
  /** Heure de jeu du dernier changement de propriétaire du trône. */
  changedAt = -Infinity;
  private lastOwner = NO_TEAM;
  private searched = false;

  /** Trône de la partie (recherché une fois). */
  find(world: World): Tile | null {
    if (!this.searched) {
      this.searched = true;
      this.throne = world.tiles.find((t) => t.kind === 'throne') ?? null;
    }
    return this.throne;
  }

  /** Mémorise le propriétaire courant ; vrai s'il vient de changer. */
  noteOwner(owner: number, time: number): boolean {
    if (owner === this.lastOwner) return false;
    this.lastOwner = owner;
    this.changedAt = time;
    return true;
  }

  reignOf(team: number): number {
    return this.reign[team] ?? 0;
  }
}

export function isKingMode(rules: GameRules | undefined): boolean {
  return rules?.mode === 'roi';
}

/** Coin nord du trône 2 × 2, centré sur la cour (demi-cellule sur une cour de côté impair). */
export function throneCorner(w: number, h: number): { x: number; y: number } {
  return { x: (w - 2) / 2, y: (h - 2) / 2 };
}

/**
 * Carte du mode Roi : ajoute le trône au centre et retire les cases bonus et obstacles qui
 * le chevauchent ou le touchent. Fonction pure de la carte, donc reproductible pour une même
 * graine ; la zone retirée est symétrique (rotation de 180°), l'équité de la carte est conservée.
 */
export function withThrone(map: MapDef): MapDef {
  if (map.tiles.some((t) => t.kind === 'throne')) return map;
  const c = throneCorner(map.w, map.h);
  const mx = map.w / 2;
  const my = map.h / 2;
  // Une cellule (x, y) couvre [x, x + 1] : elle touche le trône élargi de la marge si son centre
  // est à moins de 1 + marge + 0,5 du centre de la cour (distance de Tchebychev).
  const reach = 1 + KING.clearMargin + 0.5;
  const near = (x: number, y: number) => Math.max(Math.abs(x + 0.5 - mx), Math.abs(y + 0.5 - my)) < reach;
  const tiles: TileDef[] = map.tiles.filter((t) => t.kind !== 'bonus' || !near(t.x, t.y));
  tiles.push({ kind: 'throne', x: c.x, y: c.y });
  const obstacles = (map.obstacles ?? []).filter((o) => !near(o.x, o.y));
  return { ...map, tiles, obstacles };
}

/** L'équipe est-elle encore en vie (un élève ou un camp) ? */
function teamAlive(world: World, team: number): boolean {
  return world.teamUnitCount(team) > 0 || world.teamCampCount(team) > 0;
}

/**
 * Avance le mode d'un pas de temps. Le propriétaire du trône accumule du règne tant que
 * le trône n'est pas contesté (des ennemis dessus figent le compteur).
 */
export function updateKing(world: World, dt: number): void {
  if (!isKingMode(world.rules)) return;
  const k = world.king;
  const t = k.find(world);
  if (!t || k.winner !== NO_TEAM) return;
  const owner = t.owner;
  if (k.noteOwner(owner, world.time) && owner !== NO_TEAM) world.events.push({ kind: 'kingTake', x: t.cx, y: t.cy, team: owner });
  if (owner === NO_TEAM || t.contested || !teamAlive(world, owner)) return;
  const before = k.reignOf(owner);
  const after = Math.min(KING.winSeconds, before + dt);
  k.reign[owner] = after;
  for (const left of KING.warnAt) {
    const at = KING.winSeconds - left;
    if (before < at && after >= at) world.events.push({ kind: 'kingSoon', x: t.cx, y: t.cy, team: owner, left });
  }
  if (after >= KING.winSeconds) {
    k.winner = owner;
    world.events.push({ kind: 'kingWin', x: t.cx, y: t.cy, team: owner });
  }
}

/**
 * Vainqueurs par le trône (null si personne n'a atteint le temps de règne) : le roi et ses
 * alliés encore en vie, comme une alliance qui tient tous les camps.
 */
export function kingVictors(world: World): number[] | null {
  if (!isKingMode(world.rules)) return null;
  const w = world.king.winner;
  if (w === NO_TEAM) return null;
  const out = [w];
  for (let t = 0; t < world.numTeams; t++) if (world.isAllied(w, t) && teamAlive(world, t)) out.push(t);
  return out.sort((a, b) => a - b);
}

/** Équipe en tête au règne (la plus petite en cas d'égalité), ou NO_TEAM si personne n'a régné. */
export function reignLeader(world: World): number {
  let best = NO_TEAM;
  let bv = 0;
  for (let t = 0; t < world.numTeams; t++) {
    const v = world.king.reignOf(t);
    if (v > bv) {
      bv = v;
      best = t;
    }
  }
  return best;
}

// ---------------------------------------------------------------- IA

/** Bonus de score accordé par l'IA au trône quand elle choisit une cible (0 pour les autres cases). */
export function kingAiScore(world: World, t: Tile, enemyNear: number): number {
  if (t.kind !== 'throne' || !isKingMode(world.rules)) return 0;
  let s = KING.aiScore + KING.aiCrowdRelief * enemyNear;
  if (t.owner !== NO_TEAM) s += (KING.aiUrgency * world.king.reignOf(t.owner)) / KING.winSeconds;
  return s;
}

/**
 * L'IA doit-elle reconsidérer sa cible ? Oui si elle ne vise pas le trône alors qu'il a
 * changé de main depuis son choix et qu'il n'est ni à elle ni à un allié.
 */
export function kingRetarget(world: World, team: number, target: Tile, since: number): boolean {
  if (!isKingMode(world.rules)) return false;
  const t = world.king.find(world);
  if (!t || t === target || world.isFriend(t.owner, team)) return false;
  return world.king.changedAt > since;
}

/** Renfort de défense demandé pour le trône menacé (en plus de la règle des cases). */
export function kingDefenseExtra(world: World, t: Tile, threat: number, capturing: boolean): number {
  if (t.kind !== 'throne' || !isKingMode(world.rules)) return 0;
  return threat * 0.6 + (capturing ? 3 : 0);
}

/** Garnison à garder sur le trône quand l'équipe le tient : la case et le nombre d'élèves, ou null. */
export function kingGarrison(world: World, team: number, unitCount: number): { tile: Tile; size: number } | null {
  if (!isKingMode(world.rules)) return null;
  const t = world.king.find(world);
  if (!t || t.owner !== team) return null;
  return { tile: t, size: Math.min(unitCount, Math.max(KING.aiGarrisonMin, Math.ceil(unitCount * KING.aiGarrisonFrac))) };
}

// ---------------------------------------------------------------- textes

/** « 1:05 ». */
export function formatReign(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function plural(color: number): string {
  return `les ${TEAM_PLURALS[color] ?? 'Autres'}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Texte de l'annonce à afficher au joueur pour un événement du mode, ou null. */
export function kingAnnouncement(ev: { kind: string; team: number; left?: number }, playerTeam: number, teamColors: readonly number[]): string | null {
  const me = ev.team === playerTeam;
  const who = plural(teamColors[ev.team] ?? ev.team);
  if (ev.kind === 'kingTake') return me ? 'Tu prends le trône !' : `${cap(who)} prennent le trône !`;
  if (ev.kind === 'kingSoon' && ev.left !== undefined) {
    const left = ev.left >= 60 && ev.left % 60 === 0 ? (ev.left === 60 ? 'une minute' : `${ev.left / 60} minutes`) : `${ev.left} s`;
    const lead = left === 'une minute' ? 'Plus qu’une minute' : `Plus que ${left}`;
    return me ? `${lead} de règne pour toi !` : `${lead} pour ${who} !`;
  }
  return null;
}
