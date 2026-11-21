import { releaseDelay } from '../core/feedback';

/**
 * Boutons qui s'enfoncent (v5.22) : au contact du doigt, le bouton touché prend la classe
 * `is-pressed` (il rapetisse et descend d'un pixel, voir style.css) et la garde au moins
 * PRESS_MIN_MS, pour qu'un tap très bref se voie aussi. Un seul écouteur pour toute la page :
 * menus, HUD, panneaux et fenêtres en profitent sans rien changer à leur code. Safari iOS
 * n'applique pas toujours `:active` au doigt : la classe le remplace.
 */
const SELECTOR = 'button, .btn, [role="button"]';

export function installPress(root: Document | HTMLElement = document): () => void {
  let pressed: HTMLElement | null = null;
  let since = 0;
  const release = (): void => {
    const el = pressed;
    if (!el) return;
    pressed = null;
    const wait = releaseDelay(performance.now() - since);
    if (wait <= 0) el.classList.remove('is-pressed');
    else setTimeout(() => el !== pressed && el.classList.remove('is-pressed'), wait);
  };
  const down = (e: Event): void => {
    const t = e.target as Element | null;
    const el = t && typeof t.closest === 'function' ? (t.closest(SELECTOR) as HTMLElement | null) : null;
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (pressed && pressed !== el) pressed.classList.remove('is-pressed');
    pressed = el;
    since = performance.now();
    el.classList.add('is-pressed');
  };
  root.addEventListener('pointerdown', down, { passive: true });
  root.addEventListener('pointerup', release, { passive: true });
  root.addEventListener('pointercancel', release, { passive: true });
  // Doigt qui glisse hors du bouton : il remonte (le clic n'aura pas lieu).
  const leave = (e: Event): void => {
    const to = (e as PointerEvent).relatedTarget as Node | null;
    if (pressed && e.target === pressed && !(to && pressed.contains(to))) release();
  };
  root.addEventListener('pointerout', leave, { passive: true });
  return () => {
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointerup', release);
    root.removeEventListener('pointercancel', release);
    root.removeEventListener('pointerout', leave);
  };
}
