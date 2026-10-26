import './powers.css';
import { meritsOf } from '../core/merits';
import { POWER_IDS, POWERS, powerCooldown, type PowerId } from '../core/powers';
import type { Game } from '../game';

/**
 * Trois boutons de pouvoirs de récré, en bas au centre : icône, coût, recharge restante.
 * Toucher un bouton arme le pouvoir (aperçu de la zone sur la carte) ; le retoucher annule.
 */
export class PowersHud {
  readonly el: HTMLElement;
  readonly buttons = new Map<PowerId, HTMLButtonElement>();

  constructor(
    private root: HTMLElement,
    private getGame: () => Game | null,
    private hint: (text: string, ms?: number) => void = () => undefined,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'powers-bar';
    for (const id of POWER_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = `btn-power-${id}`;
      b.className = `power-btn power-${id}`;
      b.innerHTML = `${powerIcon(id)}<span class="power-cost">${POWERS[id].cost} ★</span><span class="power-wait"></span>`;
      b.setAttribute('aria-label', `${POWERS[id].label} : ${POWERS[id].blurb}, ${POWERS[id].cost} bons points`);
      b.addEventListener('click', () => this.press(id));
      this.el.appendChild(b);
      this.buttons.set(id, b);
    }
    root.appendChild(this.el);
    window.setInterval(() => {
      if (!this.root.classList.contains('hidden')) this.refresh();
    }, 250);
  }

  private press(id: PowerId): void {
    const g = this.getGame();
    if (!g || g.paused || g.over) return;
    const r = g.armPower(id);
    const info = POWERS[id];
    if (r === 'arme') this.hint(`${info.label} (${info.blurb.toLowerCase()}) : touche la carte pour viser, puis touche la zone pour lancer.`, 3600);
    else if (r === 'desarme') this.hint(`${info.label} annulé.`, 1400);
    else if (r === 'recharge') this.hint(`${info.label} se recharge encore ${Math.ceil(powerCooldown(g.world, g.playerTeam, id))} s.`, 2000);
    else this.hint(`Pas assez de bons points : ${info.label} coûte ${info.cost}.`, 2200);
    this.refresh();
  }

  refresh(): void {
    const g = this.getGame();
    for (const [id, b] of this.buttons) {
      const wait = g ? Math.ceil(powerCooldown(g.world, g.playerTeam, id)) : 0;
      const poor = !g || meritsOf(g.world, g.playerTeam) < POWERS[id].cost;
      b.classList.toggle('armed', !!g && g.armedPower === id);
      b.classList.toggle('cooling', wait > 0);
      b.classList.toggle('poor', wait === 0 && poor);
      const w = b.querySelector('.power-wait')!;
      const text = wait > 0 ? `${wait} s` : '';
      if (w.textContent !== text) w.textContent = text;
    }
  }
}

/** Icônes : cloche, boule de neige, part de gâteau. */
export function powerIcon(id: PowerId): string {
  if (id === 'sonnerie')
    return (
      '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
      '<path d="M5 19c1.5-1.5 2-3 2-6.5C7 8 9.5 5 13 5s6 3 6 7.5c0 3.5.5 5 2 6.5z" fill="#ffd23f" stroke="#7a5a08" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<circle cx="13" cy="21.5" r="2.3" fill="#7a5a08"/><path d="M2.5 9.5c.5-2 1.5-3.5 3-4.5M23.5 9.5c-.5-2-1.5-3.5-3-4.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</svg>'
    );
  if (id === 'neige')
    return (
      '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
      '<circle cx="13" cy="13" r="9" fill="#fff" stroke="#7fa6c4" stroke-width="2"/>' +
      '<path d="M9 10.5l2 1M15.5 9l1.5 2M11 16l2 .5" stroke="#bfe6ff" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>'
    );
  return (
    '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
    '<path d="M4 15l18-6v9H4z" fill="#c98a4a" stroke="#1e1e28" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M4 15l18-6v3.5L4 18z" fill="#ff9ec7" stroke="#1e1e28" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<circle cx="16" cy="7.5" r="2.4" fill="#e5302a" stroke="#1e1e28" stroke-width="1.2"/>' +
    '</svg>'
  );
}
