import { TEAM_COLORS } from '../config';
import { emblemFor, emblemSvg } from '../core/emblems';

/**
 * Pastille d'équipe (v5.19) : l'emblème de la couleur (rond, triangle, carré…) au lieu d'un
 * simple disque, pour reconnaître chaque équipe sans se fier à la couleur. `onDark` : cerné de
 * blanc pour les fonds sombres du bandeau, de sombre sinon.
 */
export function teamMarkHtml(color: number, size = 14, onDark = true): string {
  const pal = TEAM_COLORS[color] ?? TEAM_COLORS[0];
  return emblemSvg(emblemFor(color), pal.ui, onDark ? 'rgba(255,255,255,0.9)' : pal.dark, size);
}

export function teamMarkEl(color: number, size = 14, onDark = true): HTMLElement {
  const span = document.createElement('span');
  span.className = 'team-mark';
  span.innerHTML = teamMarkHtml(color, size, onDark);
  return span;
}
