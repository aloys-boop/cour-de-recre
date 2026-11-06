import type { Alert } from '../core/alerts';

/**
 * Bandeau d'alerte (case attaquée, case perdue, camp en danger), en haut au centre, sous les
 * mini-barres de bagarre. Toucher le bandeau emmène la caméra sur la case ; il s'efface seul.
 */
export class AlertBanner {
  readonly el: HTMLButtonElement;
  private timer = 0;
  private current: Alert | null = null;

  constructor(
    root: HTMLElement,
    private onGo: (a: Alert) => void,
  ) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'alert-banner';
    b.className = 'alert-banner hidden';
    b.innerHTML = '<span class="ab-icon" aria-hidden="true"></span><span class="ab-text"></span><span class="ab-go" aria-hidden="true">Y aller</span>';
    b.addEventListener('click', () => {
      const a = this.current;
      this.hide();
      if (a) this.onGo(a);
    });
    root.appendChild(b);
    this.el = b;
  }

  show(a: Alert, ms = 4500): void {
    this.current = a;
    const b = this.el;
    b.dataset.kind = a.kind;
    b.querySelector('.ab-icon')!.innerHTML = alertIcon(a.kind);
    b.querySelector('.ab-text')!.textContent = a.text;
    b.setAttribute('aria-label', `${a.text} Toucher pour y aller.`);
    // Relance l'animation d'entrée.
    b.classList.add('hidden');
    void b.offsetWidth;
    b.classList.remove('hidden');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    clearTimeout(this.timer);
    this.current = null;
    this.el.classList.add('hidden');
  }
}

/** Icône du bandeau : drapeau de camp, case barrée ou point d'exclamation. */
function alertIcon(kind: Alert['kind']): string {
  if (kind === 'camp')
    return '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 18L10 4l7 14z" fill="#fff" stroke="#5a0d00" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 4V1l4 1.5L10 4" fill="#ffd23f" stroke="#5a0d00" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  if (kind === 'perdue')
    return '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2l8 8-8 8-8-8z" fill="#fff" stroke="#3a0a0a" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 6l8 8M14 6l-8 8" stroke="#c9361d" stroke-width="2.2" stroke-linecap="round"/></svg>';
  return '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#fff" stroke="#5a3a00" stroke-width="1.6"/><path d="M10 5v6" stroke="#5a3a00" stroke-width="2.6" stroke-linecap="round"/><circle cx="10" cy="14.6" r="1.5" fill="#5a3a00"/></svg>';
}
