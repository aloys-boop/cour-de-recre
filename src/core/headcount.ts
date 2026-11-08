// Compteur d'élèves (v5.9, demande d'Aloys du 07/11) : combien d'élèves de chaque équipe le
// joueur voit dans la cour en ce moment. Sans brouillard, il voit tout ; avec le brouillard,
// seuls comptent les ennemis réellement visibles (les siens et ceux des alliés sont toujours connus).
import { tileView, unitVisible } from './fog';
import type { World } from './world';

/** Une ligne du détail « Effectifs ». */
export interface HeadcountRow {
  team: number;
  /** Couleur d'uniforme (index dans TEAM_COLORS / TEAM_NAMES). */
  color: number;
  isPlayer: boolean;
  ally: boolean;
  /** Élèves comptés : tous si l'effectif est connu, sinon seulement ceux que le joueur voit. */
  units: number;
  /** Effectif complet connu (soi, allié, ou pas de brouillard) ? Sinon `units` = élèves visibles. */
  known: boolean;
  /** Cases et camps tels que le joueur les connaît (dernière observation sous le brouillard). */
  tiles: number;
  camps: number;
  alive: boolean;
}

export interface Headcount {
  /** Élèves du joueur en jeu, et plafond de la carte. */
  mine: number;
  cap: number;
  /** Brouillard actif : les effectifs ennemis sont « visibles », pas complets. */
  fog: boolean;
  rows: HeadcountRow[];
}

/** Effectifs vus par `player` à l'instant présent. */
export function headcount(world: World, player: number): Headcount {
  const n = world.numTeams;
  const fog = !!world.rules.fog;
  const units = new Array<number>(n).fill(0);
  const tiles = new Array<number>(n).fill(0);
  const camps = new Array<number>(n).fill(0);
  for (const u of world.units) {
    if (!u.alive || u.pion || u.team < 0 || u.team >= n) continue;
    if (unitVisible(world, player, u)) units[u.team]++;
  }
  for (const t of world.tiles) {
    const owner = tileView(world, player, t).owner;
    if (owner < 0 || owner >= n) continue;
    if (t.isCamp) camps[owner]++;
    else tiles[owner]++;
  }
  const stats = world.stats();
  const rows: HeadcountRow[] = [];
  for (let t = 0; t < n; t++) {
    const isPlayer = t === player;
    const ally = !isPlayer && world.isAllied(player, t);
    const known = !fog || isPlayer || ally;
    rows.push({
      team: t,
      color: world.teamColors[t] ?? t,
      isPlayer,
      ally,
      units: known ? stats[t].units : units[t],
      known,
      tiles: known ? stats[t].tiles : tiles[t],
      camps: known ? stats[t].camps : camps[t],
      alive: stats[t].alive,
    });
  }
  return { mine: stats[player]?.units ?? 0, cap: world.map.unitCap, fog, rows };
}

/** Texte court d'une puce : « 18/30 » pour le joueur, sinon le nombre d'élèves (vus, sous le brouillard). */
export function chipCount(h: Headcount, team: number): string {
  const r = h.rows[team];
  if (!r) return '';
  if (r.isPlayer) return `${h.mine}/${h.cap}`;
  return String(r.units);
}
