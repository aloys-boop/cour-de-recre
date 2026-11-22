import { FLIP_MS } from '../core/menu-scene';
import { reducedMotion } from '../render/effects';

/**
 * Carte qui se retourne (v5.23) : le contenu change tout de suite (aucun choix n'attend
 * l'animation, un tap sur « Jouer » juste après part avec le bon réglage), puis la carte
 * arrive de la tranche, face visible, en FLIP_MS. Un nouveau retournement relance le mouvement.
 * « Réduire les animations » : le contenu change, sans mouvement.
 */
const pending = new WeakMap<HTMLElement, number>();

export function flipSwap(el: HTMLElement, update: () => void): void {
  update();
  if (reducedMotion()) return;
  const t = pending.get(el);
  if (t !== undefined) clearTimeout(t);
  el.classList.remove('flip-in');
  void el.offsetWidth; // relance l'animation même si la carte tournait déjà
  el.classList.add('flip-in');
  pending.set(
    el,
    window.setTimeout(() => {
      el.classList.remove('flip-in');
      pending.delete(el);
    }, FLIP_MS + 40),
  );
}

/** Vrai pendant un retournement (tests). */
export function isFlipping(el: HTMLElement): boolean {
  return pending.has(el);
}
