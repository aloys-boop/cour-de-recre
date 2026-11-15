/**
 * Mode Équipes, suite (v5.16) : quand le joueur est éliminé mais que ses coéquipiers tiennent
 * encore, il reste en spectateur jusqu'au bout et partage la victoire de son équipe.
 *
 * Logique pure, sans DOM, testée par Vitest. En partie libre (alliances au fil du jeu), rien
 * ne change : un joueur éliminé a perdu, même si un allié de circonstance gagne ensuite.
 */
import type { Vec2 } from './types';
import type { World } from './world';

export const SPECTATE = {
  /** Vitesse « Accélérer » du spectateur (temps de jeu par seconde réelle). */
  fastSpeed: 2,
};

/** État de fin de partie vu par le joueur. */
export type EndCheck =
  | { kind: 'running' }
  /** Joueur éliminé, au moins un coéquipier encore debout : la partie continue sans lui. */
  | { kind: 'spectate' }
  /** Partie finie ; `shared` : victoire de l'équipe obtenue alors que le joueur était éliminé. */
  | { kind: 'over'; result: 'victoire' | 'defaite'; shared: boolean };

/** Coéquipiers de `team` (mode Équipes), sans lui-même ; aucun en partie libre. */
export function teammatesOf(groups: readonly number[] | null, team: number): number[] {
  if (!groups) return [];
  const out: number[] = [];
  for (let t = 0; t < groups.length; t++) if (t !== team && groups[t] === groups[team]) out.push(t);
  return out;
}

/**
 * Fin de partie du point de vue de `player`.
 * @param victors équipes gagnantes (`World.victors()`), vide si la partie continue
 * @param alive   équipe encore en vie (un élève ou un camp), par numéro d'équipe
 * @param groups  groupes du mode Équipes, ou null en partie libre
 */
export function endCheck(victors: readonly number[], alive: readonly boolean[], player: number, groups: readonly number[] | null): EndCheck {
  const mates = teammatesOf(groups, player);
  if (victors.length > 0) {
    if (alive[player] && victors.includes(player)) return { kind: 'over', result: 'victoire', shared: false };
    if (mates.some((t) => victors.includes(t))) return { kind: 'over', result: 'victoire', shared: !alive[player] };
    return { kind: 'over', result: 'defaite', shared: false };
  }
  if (alive[player]) return { kind: 'running' };
  if (mates.some((t) => alive[t])) return { kind: 'spectate' };
  return { kind: 'over', result: 'defaite', shared: false };
}

/**
 * Point à regarder pour suivre un coéquipier : le centre de son plus gros paquet d'élèves
 * (élèves à moins de 3 cases les uns des autres), à défaut son premier camp. `turn` fait
 * passer d'un coéquipier vivant au suivant (bouton « Coéquipier » touché plusieurs fois).
 */
export function spectateFocus(world: World, groups: readonly number[] | null, player: number, turn = 0): { team: number; at: Vec2 } | null {
  const stats = world.stats();
  const mates = teammatesOf(groups, player).filter((t) => stats[t]?.alive);
  if (mates.length === 0) return null;
  const team = mates[((turn % mates.length) + mates.length) % mates.length];
  const units = world.units.filter((u) => u.alive && u.team === team && !u.pion);
  let best: Vec2 | null = null;
  let bestN = 0;
  for (const u of units) {
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (const o of units) {
      if (Math.hypot(o.x - u.x, o.y - u.y) > 3) continue;
      n++;
      sx += o.x;
      sy += o.y;
    }
    if (n > bestN) {
      bestN = n;
      best = { x: sx / n, y: sy / n };
    }
  }
  if (!best) {
    const camp = world.tiles.find((c) => c.isCamp && c.owner === team);
    if (camp) best = { x: camp.cx, y: camp.cy };
  }
  return best ? { team, at: best } : null;
}
