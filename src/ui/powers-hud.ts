import './powers.css';
import { meritsOf } from '../core/merits';
import { POWER_IDS, POWERS, powerCooldown, type PowerId } from '../core/powers';
import type { Game } from '../game';

/** Appui long (ms) qui affiche l'aide d'un pouvoir, et seuil de mouvement (px) qui lance le glisser-déposer. */
export const HELP_HOLD_MS = 380;
export const DRAG_THRESHOLD = 12;

/** Texte d'aide d'un pouvoir, avec les valeurs réelles du code. */
export function powerHelpLines(id: PowerId, cooldownLeft: number, missing = 0): { title: string; lines: string[] } {
  const p = POWERS[id];
  const effect =
    id === 'sonnerie'
      ? `Fige les ennemis ${fr(p.power)}\u00a0s : ils ne bougent ni ne frappent.`
      : id === 'neige'
        ? `${fr(p.power)} dégâts à chaque ennemi de la zone.`
        : `Rend ${fr(p.power)}\u00a0PV à chacun de tes élèves dans la zone.`;
  return {
    title: p.label,
    lines: [
      effect,
      `Rayon : ${fr(p.radius)} case${p.radius >= 2 ? 's' : ''} · Durée : ${id === 'sonnerie' ? `${fr(p.power)}\u00a0s` : 'immédiat'}`,
      `Coût : ${p.cost}\u00a0★ · Recharge : ${p.cooldown}\u00a0s`,
      cooldownLeft > 0 ? `Encore ${Math.ceil(cooldownLeft)}\u00a0s avant de pouvoir le relancer.` : missing > 0 ? `Il te manque ${missing}\u00a0★.` : 'Prêt.',
      'Glisse le bouton jusqu’à la carte pour le lancer.',
    ],
  };
}

function fr(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Trois boutons de pouvoirs de récré, en bas au centre : icône, coût, recharge ou bons points manquants.
 *  - tap : arme le pouvoir (aperçu de la zone ; tap sur la carte pour viser, tap dans la zone pour lancer) ;
 *  - appui long sans bouger : bulle d'aide (nom, effet chiffré, rayon, durée, coût, recharge), tant
 *    que le doigt est posé ; elle ne sort jamais de l'écran ;
 *  - glisser au-delà d'un petit seuil : glisser-déposer, la zone suit le doigt, relâcher sur la
 *    carte lance le pouvoir, relâcher sur le bouton ou le HUD annule.
 */
export class PowersHud {
  readonly el: HTMLElement;
  readonly buttons = new Map<PowerId, HTMLButtonElement>();
  readonly tip: HTMLElement;
  private press: { id: PowerId; pointer: number; x: number; y: number; mode: 'wait' | 'help' | 'drag' | 'refused'; timer: number } | null = null;

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
      b.innerHTML = `${powerIcon(id)}<span class="power-cost">${POWERS[id].cost}\u00a0★</span><span class="power-wait"></span>`;
      b.setAttribute('aria-label', `${POWERS[id].label} : ${POWERS[id].blurb}, ${POWERS[id].cost} bons points. Appui long : aide ; glisser vers la carte : lancer`);
      b.addEventListener('pointerdown', (e) => this.down(id, b, e));
      b.addEventListener('pointermove', (e) => this.move(e));
      b.addEventListener('pointerup', (e) => this.up(e, false));
      b.addEventListener('pointercancel', (e) => this.up(e, true));
      // Clavier et lecteurs d'écran : un « clic » sans pointeur arme le pouvoir.
      b.addEventListener('click', (e) => {
        if (e.detail === 0) this.tapPower(id);
      });
      this.el.appendChild(b);
      this.buttons.set(id, b);
    }
    this.tip = document.createElement('div');
    this.tip.className = 'power-tip hidden';
    this.tip.setAttribute('role', 'tooltip');
    root.appendChild(this.el);
    root.appendChild(this.tip);
    window.setInterval(() => {
      if (!this.root.classList.contains('hidden')) this.refresh();
    }, 250);
  }

  private down(id: PowerId, b: HTMLButtonElement, e: PointerEvent): void {
    e.preventDefault();
    const g = this.getGame();
    if (!g || g.paused || g.over || this.press) return;
    b.setPointerCapture?.(e.pointerId);
    const timer = window.setTimeout(() => {
      if (this.press && this.press.mode === 'wait') {
        this.press.mode = 'help';
        this.showTip(id, b);
        this.getGame()?.powerHelpShown(id);
      }
    }, HELP_HOLD_MS);
    this.press = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, mode: 'wait', timer };
  }

  private move(e: PointerEvent): void {
    const p = this.press;
    if (!p || e.pointerId !== p.pointer) return;
    const g = this.getGame();
    if (!g) return;
    if (p.mode === 'wait' && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_THRESHOLD) {
      clearTimeout(p.timer);
      const r = g.beginPowerDrag(p.id);
      if (r === 'ok') p.mode = 'drag';
      else {
        // Glisser impossible : on dit pourquoi au lieu de lancer.
        p.mode = 'refused';
        this.hint(this.reason(p.id, r), 2400);
      }
    }
    if (p.mode === 'drag') {
      const c = document.getElementById('game')?.getBoundingClientRect();
      g.dragPowerTo(e.clientX - (c?.left ?? 0), e.clientY - (c?.top ?? 0), this.overHud(e.clientX, e.clientY));
    }
  }

  private up(e: PointerEvent, cancelled: boolean): void {
    const p = this.press;
    if (!p || e.pointerId !== p.pointer) return;
    clearTimeout(p.timer);
    this.press = null;
    this.hideTip();
    const g = this.getGame();
    if (!g) return;
    if (p.mode === 'wait' && !cancelled) this.tapPower(p.id);
    else if (p.mode === 'drag') {
      if (cancelled) g.cancelPowerDrag();
      else {
        g.dragPowerTo(e.clientX - (document.getElementById('game')?.getBoundingClientRect().left ?? 0), e.clientY - (document.getElementById('game')?.getBoundingClientRect().top ?? 0), this.overHud(e.clientX, e.clientY));
        const r = g.endPowerDrag();
        if (r === 'ok') this.fired(p.id);
        else if (r === 'annule') this.hint(`${POWERS[p.id].label} annulé.`, 1400);
      }
    }
    this.refresh();
  }

  /** Le point (coordonnées de la page) est-il sur un élément du HUD (bouton, panneau…) ? */
  private overHud(x: number, y: number): boolean {
    const el = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];
    return el.some((n) => n instanceof HTMLElement && n.id !== 'game' && n.id !== 'hud' && !!n.closest('#hud') && !n.classList.contains('layer'));
  }

  private reason(id: PowerId, r: 'recharge' | 'pas-assez'): string {
    const g = this.getGame();
    const info = POWERS[id];
    if (r === 'recharge' && g) return `${info.label} se recharge encore ${Math.ceil(powerCooldown(g.world, g.playerTeam, id))}\u00a0s.`;
    const have = g ? meritsOf(g.world, g.playerTeam) : 0;
    return `Pas assez de bons points : ${info.label} coûte ${info.cost}\u00a0★ (il t’en manque ${Math.max(0, info.cost - have)}).`;
  }

  /** Ancien mode : un tap arme le pouvoir, puis tap sur la carte pour viser, tap dans la zone pour lancer. */
  private tapPower(id: PowerId): void {
    const g = this.getGame();
    if (!g || g.paused || g.over) return;
    const r = g.armPower(id);
    const info = POWERS[id];
    if (r === 'arme') this.hint(`${info.label} : touche la carte pour viser, puis la zone pour lancer. Ou glisse le bouton jusqu’à la carte.`, 3600);
    else if (r === 'desarme') this.hint(`${info.label} annulé.`, 1400);
    else this.hint(this.reason(id, r), 2400);
    this.refresh();
  }

  /** Petit éclat sur le bouton au lancement (le son vient de l'événement du monde). */
  private fired(id: PowerId): void {
    const b = this.buttons.get(id)!;
    b.classList.remove('fired');
    void b.offsetWidth;
    b.classList.add('fired');
  }

  private showTip(id: PowerId, b: HTMLButtonElement): void {
    const g = this.getGame();
    const help = powerHelpLines(id, g ? powerCooldown(g.world, g.playerTeam, id) : 0, g ? Math.max(0, POWERS[id].cost - meritsOf(g.world, g.playerTeam)) : 0);
    this.tip.innerHTML = '';
    const h = document.createElement('strong');
    h.textContent = help.title;
    this.tip.append(h);
    for (const l of help.lines) {
      const p = document.createElement('span');
      p.textContent = l;
      this.tip.append(p);
    }
    this.tip.classList.remove('hidden');
    // Au-dessus du bouton, sans jamais sortir de l'écran.
    const r = b.getBoundingClientRect();
    const w = this.tip.offsetWidth || 240;
    const h2 = this.tip.offsetHeight || 120;
    const vw = window.innerWidth;
    const left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
    const top = Math.max(8, r.top - h2 - 10);
    this.tip.style.left = `${Math.round(left)}px`;
    this.tip.style.top = `${Math.round(top)}px`;
  }

  private hideTip(): void {
    this.tip.classList.add('hidden');
  }

  /** L'aide est-elle affichée (tests) ? */
  get tipVisible(): boolean {
    return !this.tip.classList.contains('hidden');
  }

  refresh(): void {
    const g = this.getGame();
    for (const [id, b] of this.buttons) {
      const wait = g ? Math.ceil(powerCooldown(g.world, g.playerTeam, id)) : 0;
      const missing = g ? Math.max(0, POWERS[id].cost - meritsOf(g.world, g.playerTeam)) : POWERS[id].cost;
      b.classList.toggle('armed', !!g && (g.armedPower === id || g.powerDrag?.id === id));
      b.classList.toggle('cooling', wait > 0);
      b.classList.toggle('poor', wait === 0 && missing > 0);
      const w = b.querySelector('.power-wait')!;
      // Recharge : compte à rebours ; bons points insuffisants : ce qu'il manque.
      const text = wait > 0 ? `${wait}\u00a0s` : missing > 0 ? `−${missing}` : '';
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
