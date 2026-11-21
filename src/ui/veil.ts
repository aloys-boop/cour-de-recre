import { transitionMs, type TransitionKind } from '../core/feedback';
import { reducedMotion } from '../render/effects';

/**
 * Fondus entre écrans (v5.22) : un voile bleu nuit couvre l'écran au moment du changement
 * (menu → partie, partie ou écran de fin → menu) puis se lève en douceur. Le changement d'écran
 * lui-même est immédiat : le voile ne retarde aucun bouton et ne bloque jamais le doigt.
 */
export class Veil {
  readonly el: HTMLElement;
  private timer = 0;
  /** Dernier fondu lancé (tests, captures). */
  last: { kind: TransitionKind; ms: number } | null = null;

  constructor(parent: HTMLElement = document.body) {
    const el = document.createElement('div');
    el.className = 'veil';
    el.setAttribute('aria-hidden', 'true');
    el.style.pointerEvents = 'none'; // jamais sous le doigt, même si la feuille de style tarde
    parent.append(el);
    this.el = el;
  }

  /** Couvre l'écran tout de suite, puis lève le voile en `transitionMs(kind)`. */
  lift(kind: TransitionKind): void {
    const ms = transitionMs(kind, reducedMotion());
    this.last = { kind, ms };
    const el = this.el;
    clearTimeout(this.timer);
    el.classList.remove('lifting');
    el.style.transitionDuration = '0ms';
    el.style.opacity = '1';
    el.classList.add('on', `to-${kind}`);
    void el.offsetWidth; // applique l'opacité pleine avant de lancer la transition
    requestAnimationFrame(() => {
      el.style.transitionDuration = `${ms}ms`;
      el.classList.add('lifting');
      el.style.opacity = '0';
    });
    this.timer = window.setTimeout(() => this.clear(), ms + 80);
  }

  /** Voile retiré (fin du fondu). */
  clear(): void {
    clearTimeout(this.timer);
    this.el.classList.remove('on', 'lifting', 'to-partie', 'to-menu', 'to-fin');
    this.el.style.opacity = '0';
  }

  get active(): boolean {
    return this.el.classList.contains('on');
  }
}
