// Rythme de partie : case dorée périodique et épuisement des équipes sans camp.
// Logique pure, sans DOM : appelée par World.update, testée par Vitest.
import { RHYTHM } from '../config';
import type { Tile } from './tile';
import { NO_TEAM } from './types';
import type { World } from './world';

/** Événements émis par le rythme de partie (ajoutés à la file d'événements du monde). */
export type RhythmEvent =
  | { kind: 'golden'; x: number; y: number; team: number; tile: Tile }
  | { kind: 'goldenEnd'; x: number; y: number; team: number; tile: Tile }
  | { kind: 'noCamp'; x: number; y: number; team: number };

/** État du rythme de partie, porté par le monde. */
export class RhythmState {
  /** Case dorée en cours, ou null. */
  golden: Tile | null = null;
  /** Secondes restantes de la case dorée en cours. */
  goldenLeft = 0;
  /** Heure de jeu d'apparition de la case dorée en cours. */
  goldenStartedAt = -Infinity;
  /** Heure de jeu (secondes) de la prochaine case dorée. */
  nextGoldenAt: number = RHYTHM.goldenFirstAt;
  /** Dernière case dorée (évite de redorer deux fois de suite la même). */
  lastGolden: Tile | null = null;
  /** Équipes qui n'ont plus aucun camp (leurs élèves s'épuisent). */
  starving: boolean[] = [];

  /** Le bonus de cette case compte-t-il double en ce moment ? */
  isGolden(t: Tile): boolean {
    return this.golden === t;
  }
}

/** Poids d'une case dans le décompte des bonus de son propriétaire (2 si dorée). */
export function bonusWeight(world: World, t: Tile): number {
  return world.rhythm.golden === t ? RHYTHM.goldenMultiplier : 1;
}

/** Bonus de score accordé par l'IA à une case qu'elle envisage d'attaquer. */
export function goldenAiBonus(world: World, t: Tile): number {
  return world.rhythm.golden === t ? RHYTHM.goldenAiScore : 0;
}

/**
 * Choisit la prochaine case dorée : une case bonus de préférence centrale et contestable,
 * c'est-à-dire à peu près à égale distance des camps encore tenus. Tirage parmi les meilleures.
 */
export function pickGoldenTile(world: World): Tile | null {
  const candidates = world.tiles.filter((t) => t.kind === 'bonus' && t !== world.rhythm.lastGolden);
  if (candidates.length === 0) return null;
  const mx = world.map.w / 2;
  const my = world.map.h / 2;
  const camps = world.tiles.filter((t) => t.isCamp && t.owner !== NO_TEAM);
  const scored = candidates.map((t) => {
    let score = -Math.hypot(t.cx - mx, t.cy - my);
    if (camps.length > 1) {
      // Écart entre le camp le plus proche et le deuxième : faible = disputée.
      const d = camps.map((c) => Math.hypot(c.cx - t.cx, c.cy - t.cy)).sort((a, b) => a - b);
      score -= 0.5 * (d[1] - d[0]);
    }
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const pool = scored.slice(0, Math.min(3, scored.length));
  return pool[Math.floor(world.rng.next() * pool.length)].t;
}

/**
 * Avance le rythme de partie d'un pas de temps.
 * Retourne vrai si les bonus des équipes doivent être recalculés (case dorée apparue ou éteinte).
 */
export function updateRhythm(world: World, dt: number): boolean {
  const r = world.rhythm;
  let changed = false;

  // --- Case dorée ---------------------------------------------------------
  if (r.golden) {
    r.goldenLeft -= dt;
    if (r.goldenLeft <= 0) {
      const t = r.golden;
      r.golden = null;
      r.goldenLeft = 0;
      world.events.push({ kind: 'goldenEnd', x: t.cx, y: t.cy, team: t.owner, tile: t });
      changed = true;
    }
  }
  if (!r.golden && world.time >= r.nextGoldenAt) {
    const jitter = (world.rng.next() * 2 - 1) * RHYTHM.goldenJitter;
    r.nextGoldenAt = world.time + RHYTHM.goldenInterval + jitter;
    const t = pickGoldenTile(world);
    if (t) {
      r.golden = t;
      r.lastGolden = t;
      r.goldenLeft = RHYTHM.goldenDuration;
      r.goldenStartedAt = world.time;
      world.events.push({ kind: 'golden', x: t.cx, y: t.cy, team: t.owner, tile: t });
      changed = true;
    }
  }

  // --- Équipes sans camp : les élèves s'épuisent -----------------------------
  for (let team = 0; team < world.numTeams; team++) {
    const starving = world.teamCampCount(team) === 0;
    if (starving && !r.starving[team] && world.teamUnitCount(team) > 0) {
      const u = world.units.find((x) => x.team === team && x.alive)!;
      world.events.push({ kind: 'noCamp', x: u.x, y: u.y, team });
    }
    r.starving[team] = starving;
  }
  const drain = RHYTHM.noCampDrainPerSec * dt;
  if (drain > 0) {
    for (const u of world.units) {
      if (!u.alive || !r.starving[u.team]) continue;
      if (u.hp - drain > 0) u.hp -= drain;
      else if (u.takeDamage(u.hp, u.x, u.y)) world.events.push({ kind: 'ko', x: u.x, y: u.y, team: u.team });
    }
  }
  return changed;
}

/**
 * L'IA doit-elle reconsidérer sa cible ? Oui quand une case dorée est apparue après le choix
 * de la cible courante (une seule fois : la case dorée entre alors dans l'évaluation).
 */
export function goldenRetarget(world: World, target: Tile, since: number): boolean {
  const r = world.rhythm;
  if (!r.golden || target === r.golden) return false;
  const startedAt = r.goldenStartedAt;
  return since < startedAt;
}

const SUIT_NAME = { heart: 'cœur', spade: 'pique', club: 'trèfle', diamond: 'carreau' } as const;

/** Texte de l'annonce à afficher au joueur pour un événement du rythme, ou null. */
export function rhythmAnnouncement(ev: { kind: string; team: number; tile?: Tile }, playerTeam: number): string | null {
  if (ev.kind === 'golden') {
    const suit = ev.tile?.suit ? ` Le ${SUIT_NAME[ev.tile.suit]} compte double pendant ${RHYTHM.goldenDuration}\u00a0s.` : '';
    return `Case dorée\u00a0!${suit}`;
  }
  if (ev.kind === 'noCamp' && ev.team === playerTeam) return 'Plus de camp\u00a0: tes élèves s’épuisent, reprends un camp\u00a0!';
  return null;
}
