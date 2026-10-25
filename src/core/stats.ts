import { MAX_TEAMS } from '../config';
import type { World, WorldEvent } from './world';

/** Compteurs d'une équipe pendant une partie. */
export interface TeamTally {
  /** Élèves produits par les camps (les élèves de départ ne comptent pas). */
  produced: number;
  /** KO infligés aux autres équipes. */
  koDealt: number;
  /** KO subis. */
  koTaken: number;
  /** Cases capturées (cases bonus et camps). */
  captured: number;
}

/** Statistiques de partie, alimentées par les événements du monde (logique pure). */
export class GameStats {
  readonly teams: TeamTally[] = [];

  constructor(numTeams = MAX_TEAMS) {
    for (let t = 0; t < numTeams; t++) this.teams.push({ produced: 0, koDealt: 0, koTaken: 0, captured: 0 });
  }

  private tally(team: number | undefined): TeamTally | undefined {
    return team === undefined || team < 0 ? undefined : this.teams[team];
  }

  record(ev: WorldEvent): void {
    switch (ev.kind) {
      case 'spawn': {
        const t = this.tally(ev.team);
        if (t) t.produced++;
        break;
      }
      case 'ko': {
        const victim = this.tally(ev.team);
        if (victim) victim.koTaken++;
        if (ev.by !== ev.team) {
          const by = this.tally(ev.by);
          if (by) by.koDealt++;
        }
        break;
      }
      case 'captured': {
        const t = this.tally(ev.team);
        if (t) t.captured++;
        break;
      }
    }
  }

  recordAll(events: readonly WorldEvent[]): void {
    for (const ev of events) this.record(ev);
  }
}

export interface EndStatsRow extends TeamTally {
  team: number;
  /** Couleur d'uniforme (index dans TEAM_COLORS / TEAM_NAMES). */
  color: number;
  isPlayer: boolean;
}

/** Résumé affiché sur l'écran de fin. */
export interface EndStats {
  /** Durée de la partie en secondes (temps de simulation, pauses exclues). */
  duration: number;
  rows: EndStatsRow[];
}

export function endStats(stats: GameStats, world: World, playerTeam: number): EndStats {
  const rows: EndStatsRow[] = [];
  for (let t = 0; t < world.numTeams; t++) {
    const tally = stats.teams[t] ?? { produced: 0, koDealt: 0, koTaken: 0, captured: 0 };
    rows.push({ ...tally, team: t, color: world.teamColors[t] ?? t, isPlayer: t === playerTeam });
  }
  return { duration: world.time, rows };
}

/** Durée lisible : « 45 s », « 3 min 05 s ». */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m === 0 ? `${r} s` : `${m} min ${String(r).padStart(2, '0')} s`;
}
