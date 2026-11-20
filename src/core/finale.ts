import { TEAM_PLURALS } from '../config';
import type { WorldEvent } from './world';

/**
 * Fin de partie mise en scène (v5.21, saison 2, « Interface a ») : logique pure.
 *
 * Quand la partie se termine, la cour ne se fige plus d'un coup : la caméra glisse
 * vers le coup décisif (dernier camp pris ou dernier KO vus), zoome un peu, et le
 * temps passe au ralenti pendant que le tampon « Victoire ! » ou « Défaite… » tombe.
 * Puis l'écran de fin s'ouvre (un tap l'ouvre tout de suite).
 */
export const FINALE = {
  /** Durée totale du ralenti, en secondes réelles. */
  seconds: 1.8,
  /** Durée avec « réduire les animations » : pas de zoom, juste le tampon. */
  reducedSeconds: 1.0,
  /** Vitesse du temps de jeu au cœur du ralenti. */
  slow: 0.2,
  /** Le ralenti commence à relâcher à partir de cette fraction de la durée. */
  releaseFrom: 0.7,
  /** Vitesse atteinte en fin de ralenti. */
  releaseTo: 0.5,
  /** Zoom visé, relatif au zoom courant (borné par la caméra). */
  zoomBoost: 1.3,
  /** Durée du glissement et du zoom de la caméra. */
  focusSeconds: 0.55,
  /** Un coup plus ancien que ceci (temps de jeu) ne compte plus comme décisif. */
  window: 5,
} as const;

export interface FinalBlow {
  kind: 'ko' | 'camp';
  /** Position (cases). */
  x: number;
  y: number;
  /** KO : équipe de la victime ; camp : équipe qui le prend. */
  team: number;
  /** KO : équipe qui a frappé (si connue). */
  by?: number;
  /** Temps de jeu de l'événement. */
  time: number;
  /** Vu par le joueur (hors brouillard) au moment du coup. */
  seen: boolean;
}

/** Retient les derniers coups marquants de la partie pour en choisir le décisif. */
export class FinaleTracker {
  private lastKo: FinalBlow | null = null;
  private lastCamp: FinalBlow | null = null;

  note(ev: WorldEvent, time: number, seen: boolean): void {
    if (ev.kind === 'ko') {
      // Un coup vu ne se fait pas remplacer par un KO caché au même instant.
      if (!seen && this.lastKo?.seen && time - this.lastKo.time < 0.5) return;
      this.lastKo = { kind: 'ko', x: ev.x, y: ev.y, team: ev.team, by: ev.by, time, seen };
    } else if (ev.kind === 'captured' && ev.camp) {
      this.lastCamp = { kind: 'camp', x: ev.x, y: ev.y, team: ev.team, time, seen };
    }
  }

  /**
   * Le coup décisif à la fin de la partie : un camp pris dans les dernières secondes
   * passe avant un KO (c'est lui qui a fait basculer la partie), un coup vu avant un
   * coup caché. Rien de récent : null (la caméra ne bouge pas).
   */
  decisive(endTime: number): FinalBlow | null {
    const recent = (b: FinalBlow | null) => (b && endTime - b.time <= FINALE.window ? b : null);
    const camp = recent(this.lastCamp);
    const ko = recent(this.lastKo);
    const cands = [camp, ko].filter((b): b is FinalBlow => !!b);
    if (!cands.length) return null;
    const seen = cands.filter((b) => b.seen);
    return (seen.length ? seen : cands)[0];
  }
}

/** Vitesse du temps de jeu pendant le ralenti, à t secondes réelles du début. */
export function finaleTimeScale(t: number, duration: number = FINALE.seconds): number {
  const k = Math.max(0, Math.min(1, t / duration));
  if (k <= FINALE.releaseFrom) return FINALE.slow;
  const r = (k - FINALE.releaseFrom) / (1 - FINALE.releaseFrom);
  return FINALE.slow + (FINALE.releaseTo - FINALE.slow) * r * r;
}

/** Avancement adouci (0 → 1) du glissement et du zoom de la caméra. */
export function finaleFocus(t: number): number {
  const k = Math.max(0, Math.min(1, t / FINALE.focusSeconds));
  return k * k * (3 - 2 * k);
}

/**
 * Tampon du centre de l'écran : échelle (tombe de haut, rebondit), opacité.
 * Il arrive après 0,15 s, écrase à 1,25 puis se pose à 1.
 */
export function finaleStamp(t: number): { scale: number; alpha: number } {
  const s = t - 0.15;
  if (s <= 0) return { scale: 2.2, alpha: 0 };
  if (s < 0.18) {
    const k = s / 0.18;
    return { scale: 2.2 - (2.2 - 0.92) * k * k, alpha: k };
  }
  if (s < 0.36) {
    const k = (s - 0.18) / 0.18;
    return { scale: 0.92 + 0.08 * Math.sin(k * Math.PI * 0.5), alpha: 1 };
  }
  return { scale: 1, alpha: 1 };
}

/** Bandes de cinéma : part de la hauteur de l'écran couverte en haut et en bas. */
export function finaleBars(t: number): number {
  const k = Math.max(0, Math.min(1, t / 0.3));
  return 0.085 * k * (2 - k);
}

/** Texte du tampon selon le résultat. */
export function finaleTitle(result: 'victoire' | 'defaite', shared = false): string {
  return result === 'victoire' ? (shared ? 'Victoire de l’équipe !' : 'Victoire !') : 'Défaite…';
}

/** Ligne « Dernier coup » de l'écran de fin, ou null. */
export function finalBlowLine(blow: FinalBlow | null, playerTeam: number, colors: readonly number[]): string | null {
  if (!blow) return null;
  const plural = (t: number) => TEAM_PLURALS[colors[t] ?? t] ?? 'Autres';
  if (blow.kind === 'camp') {
    return blow.team === playerTeam ? 'Dernier coup : tu prends un camp.' : `Dernier coup : les ${plural(blow.team)} prennent un camp.`;
  }
  const victim = blow.team === playerTeam ? 'un de tes élèves' : `un élève des ${plural(blow.team)}`;
  if (blow.by === undefined || blow.by < 0) return `Dernier coup : ${victim} tombe KO.`;
  if (blow.by === playerTeam) return `Dernier coup : tu mets KO ${victim}.`;
  return `Dernier coup : les ${plural(blow.by)} mettent KO ${victim}.`;
}

/**
 * Meilleure équipe d'une colonne de l'écran de fin (étoile dorée) : seulement
 * un meilleur unique et non nul, sinon -1.
 */
export function bestIndex(values: readonly number[]): number {
  let best = -1;
  let max = 0;
  let tie = false;
  values.forEach((v, i) => {
    if (v > max) {
      max = v;
      best = i;
      tie = false;
    } else if (v === max && v > 0) tie = true;
  });
  return tie ? -1 : best;
}

/** Compteur qui monte en douceur (écran de fin) : valeur affichée à t secondes. */
export function countUp(value: number, t: number, duration = 0.7): number {
  if (t >= duration || value <= 0) return value;
  const k = Math.max(0, t / duration);
  return Math.round(value * (1 - (1 - k) ** 3));
}
