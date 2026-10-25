import { SUIT_BONUS, TEAM_COLORS, TEAM_NAMES } from '../config';
import type { DiploView } from '../core/diplomacy';
import { teamPlural } from '../core/diplomacy';
import type { Suit } from '../core/types';
import type { World } from '../core/world';

const SUIT_GLYPH: Record<Suit, string> = { heart: '\u2665', spade: '\u2660', club: '\u2663', diamond: '\u2666' };

export interface HudHooks {
  onSelectAll(): void;
  onCancel(): void;
  onPause(): void;
  onToggleSound(): boolean;
  /** Diplomatie : état d'une équipe vue par le joueur, proposer, rompre. */
  diplomacy?: {
    view(team: number): DiploView | null;
    propose(team: number): void;
    breakOff(team: number): void;
  };
}

/** Au-delà de ce nombre d'équipes, les puces passent en version compacte (pastille + nombre). */
export const COMPACT_CHIPS_FROM = 5;

/** Barre de jeu : compteurs par équipe, boutons de sélection, pause et son. */
export class Hud {
  private chips: HTMLElement;
  private bonus: HTMLElement;
  private selCount: HTMLElement;
  private btnSound: HTMLButtonElement;
  private hint: HTMLElement;
  private hintTimer = 0;
  private chipEls: HTMLButtonElement[] = [];
  private panel: HTMLElement;
  private panelTeam = -1;
  private lastWorld: World | null = null;
  private lastPlayer = 0;
  private colors: number[] = [];

  constructor(
    private root: HTMLElement,
    private hooks: HudHooks,
    muted: boolean,
  ) {
    this.chips = root.querySelector('#team-chips')!;
    this.bonus = root.querySelector('#bonus-line')!;
    this.selCount = root.querySelector('#sel-count')!;
    this.hint = root.querySelector('#hint')!;
    this.btnSound = root.querySelector('#btn-sound')!;
    const btnPause = root.querySelector<HTMLButtonElement>('#btn-pause')!;
    const btnAll = root.querySelector<HTMLButtonElement>('#btn-select-all')!;
    const btnCancel = root.querySelector<HTMLButtonElement>('#btn-cancel')!;
    btnPause.innerHTML = pauseIcon();
    this.setSoundIcon(muted);
    btnAll.addEventListener('click', hooks.onSelectAll);
    btnCancel.addEventListener('click', hooks.onCancel);
    btnPause.addEventListener('click', hooks.onPause);
    this.btnSound.addEventListener('click', () => this.setSoundIcon(hooks.onToggleSound()));
    this.panel = this.buildPanel();
    root.appendChild(this.panel);
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.closeDiplomacy();
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.closeDiplomacy();
  }

  setSoundIcon(muted: boolean): void {
    this.btnSound.innerHTML = soundIcon(muted);
    this.btnSound.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
  }

  update(world: World, selected: number, playerTeam: number): void {
    this.lastWorld = world;
    this.lastPlayer = playerTeam;
    const stats = world.stats();
    const n = world.numTeams;
    const sameColors = this.colors.length === n && this.colors.every((c, i) => c === world.teamColors[i]);
    if (this.chipEls.length !== n || !sameColors) this.buildChips(world);
    this.chips.classList.toggle('compact', n >= COMPACT_CHIPS_FROM);
    for (let t = 0; t < n; t++) {
      const chip = this.chipEls[t];
      const s = stats[t];
      const ally = t !== playerTeam && world.isAllied(playerTeam, t);
      const view = t !== playerTeam ? this.hooks.diplomacy?.view(t) : null;
      chip.classList.toggle('me', t === playerTeam);
      chip.classList.toggle('dead', !s.alive);
      chip.classList.toggle('ally', ally);
      chip.classList.toggle('breaking', ally && view?.breakingIn != null);
      chip.classList.toggle('open', t === this.panelTeam);
      setText(chip.querySelector('.chip-count')!, String(s.units));
      setText(chip.querySelector('.chip-camps')!, s.camps > 1 ? `×${s.camps}` : '');
      const c = world.teamColors[t];
      const label = `${TEAM_NAMES[c]} : ${s.units} élève${s.units > 1 ? 's' : ''}${s.camps > 1 ? `, ${s.camps} camps` : ''}${ally ? ', allié' : ''}${t === playerTeam ? ' (toi)' : '. Toucher pour la diplomatie'}`;
      if (chip.getAttribute('aria-label') !== label) chip.setAttribute('aria-label', label);
    }
    this.refreshPanel();
    // Bonus actifs du joueur, par symbole.
    const m = world.mods[playerTeam];
    const bits: string[] = [];
    (Object.keys(SUIT_BONUS) as Suit[]).forEach((suit) => {
      const n = m.suits[suit];
      if (n > 0) bits.push(`${SUIT_GLYPH[suit]} ${SUIT_BONUS[suit].label} +${Math.round(SUIT_BONUS[suit].perTile * n * 100)} %`);
    });
    this.bonus.textContent = bits.join('   ');
    this.selCount.textContent = selected > 0 ? `${selected} sélectionné${selected > 1 ? 's' : ''}` : '';
  }

  /** Crée une puce (bouton) par équipe : toucher la puce d'une autre équipe ouvre la diplomatie. */
  private buildChips(world: World): void {
    this.chips.innerHTML = '';
    this.chipEls = [];
    this.colors = world.teamColors.slice(0, world.numTeams);
    for (let t = 0; t < world.numTeams; t++) {
      const c = world.teamColors[t];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.team = String(t);
      b.innerHTML =
        `<span class="dot" style="background:${TEAM_COLORS[c].ui}"></span>` +
        `<span class="chip-name">${TEAM_NAMES[c]}</span>` +
        `<span class="chip-count"></span><span class="chip-camps"></span>` +
        `<span class="chip-ally" aria-hidden="true">${handshakeIcon()}</span>`;
      b.addEventListener('click', () => this.toggleDiplomacy(t));
      this.chips.appendChild(b);
      this.chipEls.push(b);
    }
  }

  /** Ouvre (ou referme) le panneau « Diplomatie » pour une équipe. */
  toggleDiplomacy(team: number): void {
    if (team === this.lastPlayer || !this.hooks.diplomacy) return this.closeDiplomacy();
    if (this.panelTeam === team) return this.closeDiplomacy();
    this.panelTeam = team;
    this.panel.classList.remove('hidden');
    this.chipEls.forEach((c, i) => c.classList.toggle('open', i === team));
    this.refreshPanel();
  }

  closeDiplomacy(): void {
    this.panelTeam = -1;
    this.panel.classList.add('hidden');
    this.chipEls.forEach((c) => c.classList.remove('open'));
  }

  get diplomacyTeam(): number {
    return this.panelTeam;
  }

  private buildPanel(): HTMLElement {
    const p = document.createElement('div');
    p.id = 'diplo-panel';
    p.className = 'diplo hidden';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Diplomatie');
    p.innerHTML =
      '<div class="diplo-head"><span class="dot"></span><span class="diplo-title"></span></div>' +
      '<p class="diplo-status"></p>' +
      '<div class="diplo-actions">' +
      '<button type="button" class="btn diplo-action"></button>' +
      '<button type="button" class="btn btn-secondary diplo-close">Fermer</button>' +
      '</div>';
    p.querySelector('.diplo-close')!.addEventListener('click', () => this.closeDiplomacy());
    p.querySelector('.diplo-action')!.addEventListener('click', () => {
      const team = this.panelTeam;
      const d = this.hooks.diplomacy;
      if (team < 0 || !d) return;
      const v = d.view(team);
      if (!v || !v.alive) return;
      if (v.allied) d.breakOff(team);
      else d.propose(team);
      this.refreshPanel();
    });
    return p;
  }

  private refreshPanel(): void {
    const team = this.panelTeam;
    const world = this.lastWorld;
    if (team < 0 || !world || !this.hooks.diplomacy) return;
    if (team >= world.numTeams) return this.closeDiplomacy();
    const v = this.hooks.diplomacy.view(team);
    if (!v) return this.closeDiplomacy();
    const c = world.teamColors[team];
    const dot = this.panel.querySelector<HTMLElement>('.dot')!;
    dot.style.background = TEAM_COLORS[c].ui;
    setText(this.panel.querySelector('.diplo-title')!, `Diplomatie\u00a0: ${teamPlural(c)}`);
    const status = this.panel.querySelector('.diplo-status')!;
    const action = this.panel.querySelector<HTMLButtonElement>('.diplo-action')!;
    const wait = Math.ceil(v.cooldown);
    this.panel.classList.toggle('allied', v.allied);
    if (!v.alive) {
      setText(status, 'Cette équipe est éliminée.');
      action.classList.add('hidden');
      return;
    }
    action.classList.remove('hidden');
    if (v.allied && v.breakingIn !== null) {
      setText(status, `Alliés, mais l’alliance sera rompue dans ${Math.ceil(v.breakingIn)}\u00a0s.`);
      setText(action, 'Rupture annoncée');
      action.disabled = true;
    } else if (v.allied) {
      setText(status, 'Alliés\u00a0: vous ne vous battez pas et vous vous laissez passer.');
      setText(action, wait > 0 ? `Rompre (dans ${wait}\u00a0s)` : 'Rompre l’alliance');
      action.disabled = wait > 0;
      action.classList.add('btn-danger');
    } else {
      setText(status, 'En guerre contre cette équipe.');
      setText(action, wait > 0 ? `Proposer (dans ${wait}\u00a0s)` : 'Proposer une alliance');
      action.disabled = wait > 0;
      action.classList.remove('btn-danger');
    }
  }

  showHint(text: string, ms = 2600): void {
    this.hint.textContent = text;
    this.hint.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hint.classList.add('hidden'), ms);
  }
}

function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** Poignée de main stylisée (marque des équipes alliées). */
export function handshakeIcon(): string {
  return (
    '<svg width="18" height="13" viewBox="0 0 20 14" aria-hidden="true">' +
    '<path d="M1 5.5L5 2l3.5 1.6L11 2.6h3.5L19 5.5l-3 4-5.2 3.4-2.6-1.8L5 10z" fill="#9fdcff" stroke="#0d2a40" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<path d="M7.6 7.4l2.6 2M9.4 6.3l2.8 2.3M11.2 5.4l2.4 2" stroke="#0d2a40" stroke-width="1.1" stroke-linecap="round"/>' +
    '</svg>'
  );
}

function pauseIcon(): string {
  return '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="2" width="4.5" height="14" rx="1" fill="#fff"/><rect x="10.5" y="2" width="4.5" height="14" rx="1" fill="#fff"/></svg>';
}

function soundIcon(muted: boolean): string {
  const speaker = '<path d="M2 7h3l4-3.5v11L5 11H2z" fill="#fff"/>';
  const waves = muted
    ? '<path d="M12 6l4 6M16 6l-4 6" stroke="#ff6a4a" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M11.5 6.5a3.5 3.5 0 010 5M13.5 4.5a6 6 0 010 9" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>';
  return `<svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true">${speaker}${waves}</svg>`;
}
