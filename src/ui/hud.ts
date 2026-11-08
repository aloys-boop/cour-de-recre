import { SUIT_BONUS, TEAM_COLORS, TEAM_NAMES, TEAM_PLURALS } from '../config';
import type { DiploView } from '../core/diplomacy';
import { teamPlural } from '../core/diplomacy';
import { chipCount, headcount, type Headcount } from '../core/headcount';
import type { Suit } from '../core/types';
import type { World } from '../core/world';
import { SUPERVISOR_BUFF, supervisorBuffLeft } from '../core/supervisors';

const SUIT_GLYPH: Record<Suit, string> = { heart: '\u2665', spade: '\u2660', club: '\u2663', diamond: '\u2666' };

export interface HudHooks {
  onSelectAll(): void;
  onCancel(): void;
  onPause(): void;
  onToggleSound(): boolean;
  /** Le détail des effectifs s'ouvre (son, vibration). */
  onCountsOpen?(): void;
  /** Diplomatie : état d'une équipe vue par le joueur, proposer, rompre. */
  diplomacy?: {
    view(team: number): DiploView | null;
    propose(team: number): void;
    breakOff(team: number): void;
  };
}

/** Au-delà de ce nombre d'équipes, les puces passent en version compacte (pastille + nombre). */
export const COMPACT_CHIPS_FROM = 5;

/** Intervalle (secondes de jeu) entre deux recomptes des effectifs visibles. */
export const HEADCOUNT_INTERVAL = 0.25;

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
  /** Effectifs vus par le joueur, recalculés quelques fois par seconde (pas à chaque image). */
  private counts: Headcount | null = null;
  private countsAt = -1;
  private countsWorld: World | null = null;
  private countPanel: HTMLElement;
  private countOpen = false;

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
    this.countPanel = this.buildCountPanel();
    root.appendChild(this.countPanel);
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.closeDiplomacy();
    this.closeCounts();
    this.counts = null;
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.closeDiplomacy();
    this.closeCounts();
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
    // Compteur d'élèves (v5.9) : 4 fois par seconde de jeu suffit, et c'est ce que voit le joueur.
    if (!this.counts || this.countsWorld !== world || this.counts.fog !== !!world.rules.fog || world.time - this.countsAt >= HEADCOUNT_INTERVAL || world.time < this.countsAt) {
      this.counts = headcount(world, playerTeam);
      this.countsAt = world.time;
      this.countsWorld = world;
    }
    const hc = this.counts;
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
      const breaking = ally && view?.breakingIn != null;
      chip.classList.toggle('breaking', breaking);
      // Compte à rebours de la rupture annoncée, bien visible sur la puce (v5.6).
      setText(chip.querySelector('.chip-timer')!, breaking ? `${Math.ceil(view!.breakingIn!)} s` : '');
      chip.classList.toggle('open', t === this.panelTeam || (t === playerTeam && this.countOpen));
      // Brouillard de guerre : pour les équipes non alliées, seulement les élèves que le joueur voit (œil).
      const row = hc.rows[t];
      const hidden = !!row && !row.known;
      chip.classList.toggle('fogged', hidden);
      chip.classList.toggle('full', t === playerTeam && hc.mine >= hc.cap);
      setText(chip.querySelector('.chip-count')!, chipCount(hc, t));
      setText(chip.querySelector('.chip-camps')!, s.camps > 1 ? `×${s.camps}` : '');
      const c = world.teamColors[t];
      const seen = row?.units ?? 0;
      const count =
        t === playerTeam
          ? `${hc.mine} élève${hc.mine > 1 ? 's' : ''} sur ${hc.cap} au plus`
          : hidden
            ? `${seen} élève${seen > 1 ? 's' : ''} en vue`
            : `${s.units} élève${s.units > 1 ? 's' : ''}`;
      const label = `${TEAM_NAMES[c]} : ${count}${s.camps > 1 ? `, ${s.camps} camps` : ''}${ally ? ', allié' : ''}${t === playerTeam ? ' (toi). Toucher pour les effectifs' : '. Toucher pour la diplomatie'}`;
      if (chip.getAttribute('aria-label') !== label) chip.setAttribute('aria-label', label);
    }
    this.refreshPanel();
    this.refreshCounts();
    // Bonus actifs du joueur, par symbole.
    const m = world.mods[playerTeam];
    const bits: string[] = [];
    (Object.keys(SUIT_BONUS) as Suit[]).forEach((suit) => {
      const n = m.suits[suit];
      if (n > 0) bits.push(`${SUIT_GLYPH[suit]} ${SUIT_BONUS[suit].label} +${Math.round(SUIT_BONUS[suit].perTile * n * 100)} %`);
    });
    // Option « Surveillants » : bonus de dégâts après un KO.
    const buff = Math.ceil(supervisorBuffLeft(world, playerTeam));
    if (buff > 0) bits.push(`Surveillant KO\u00a0: dégâts +${Math.round(SUPERVISOR_BUFF * 100)}\u00a0% (${buff}\u00a0s)`);
    setText(this.bonus, bits.join('   '));
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
        `<span class="chip-eye" aria-hidden="true">${eyeIcon()}</span>` +
        `<span class="chip-count"></span><span class="chip-camps"></span>` +
        `<span class="chip-ally" aria-hidden="true">${handshakeIcon()}</span>` +
        `<span class="chip-timer" aria-hidden="true"></span>`;
      b.addEventListener('click', () => this.toggleDiplomacy(t));
      this.chips.appendChild(b);
      this.chipEls.push(b);
    }
  }

  /** Ouvre (ou referme) le panneau « Diplomatie » pour une équipe. */
  toggleDiplomacy(team: number): void {
    // Sa propre puce ouvre le détail des effectifs (v5.9).
    if (team === this.lastPlayer) return this.toggleCounts();
    this.closeCounts();
    if (!this.hooks.diplomacy) return this.closeDiplomacy();
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
    setText(this.panel.querySelector('.diplo-title')!, `${v.locked && v.allied ? 'Coéquipiers' : 'Diplomatie'}\u00a0: ${teamPlural(c)}`);
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
    if (v.locked) {
      // Mode « Équipes » : pas de diplomatie, les équipes sont fixées pour toute la partie.
      setText(status, v.allied ? 'Coéquipiers pour toute la partie : vous gagnez ensemble.' : 'Équipe adverse : en mode Équipes, pas d’alliance possible.');
      action.classList.add('hidden');
      return;
    }
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

  /** Ouvre (ou referme) le détail « Effectifs » : élèves, cases et camps de chaque équipe. */
  toggleCounts(): void {
    if (this.countOpen) return this.closeCounts();
    this.closeDiplomacy();
    this.countOpen = true;
    this.countPanel.classList.remove('hidden');
    this.chipEls[this.lastPlayer]?.classList.add('open');
    this.hooks.onCountsOpen?.();
    this.refreshCounts();
  }

  closeCounts(): void {
    if (!this.countOpen) return;
    this.countOpen = false;
    this.countPanel.classList.add('hidden');
    this.chipEls[this.lastPlayer]?.classList.remove('open');
  }

  get countsOpen(): boolean {
    return this.countOpen;
  }

  private buildCountPanel(): HTMLElement {
    const p = document.createElement('div');
    p.id = 'count-panel';
    p.className = 'diplo counts hidden';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Effectifs');
    p.innerHTML =
      '<div class="diplo-head"><span class="diplo-title">Effectifs</span><span class="counts-cap"></span>' +
      '<button type="button" class="counts-close diplo-close" aria-label="Fermer">\u00d7</button></div>' +
      '<table class="counts-table"><thead><tr><th scope="col">Équipe</th><th scope="col">Élèves</th><th scope="col">Cases</th><th scope="col">Camps</th></tr></thead><tbody></tbody></table>' +
      '<p class="diplo-status counts-note"></p>';
    p.querySelector('.diplo-close')!.addEventListener('click', () => this.closeCounts());
    return p;
  }

  private refreshCounts(): void {
    const hc = this.counts;
    if (!this.countOpen || !hc) return;
    setText(this.countPanel.querySelector('.counts-cap')!, `Toi\u00a0: ${hc.mine}/${hc.cap} élèves`);
    const body = this.countPanel.querySelector('tbody')!;
    let html = '';
    for (const r of hc.rows) {
      const name = r.isPlayer ? 'Toi' : (TEAM_PLURALS[r.color] ?? '?');
      const units = r.known ? String(r.units) : `<span class="counts-eye" aria-label="en vue">${eyeIcon()}</span>${r.units}`;
      const cls = [r.isPlayer ? 'me' : '', r.ally ? 'ally' : '', r.alive ? '' : 'dead'].filter(Boolean).join(' ');
      html +=
        `<tr${cls ? ` class="${cls}"` : ''}><th scope="row"><span class="dot" style="background:${TEAM_COLORS[r.color].ui}"></span>${name}</th>` +
        `<td>${units}</td><td>${r.tiles}</td><td>${r.camps}</td></tr>`;
    }
    if (body.innerHTML !== html) body.innerHTML = html;
    setText(
      this.countPanel.querySelector('.counts-note')!,
      hc.fog ? 'Brouillard\u00a0: l’œil compte les ennemis en vue, et leurs cases telles que tu les as vues.' : 'Tout ce qui est dans la cour en ce moment.',
    );
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

/** Œil : effectif « en vue » sous le brouillard. */
function eyeIcon(): string {
  return (
    '<svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">' +
    '<path d="M1 5c1.6-2.6 3.7-4 6-4s4.4 1.4 6 4c-1.6 2.6-3.7 4-6 4S2.6 7.6 1 5z" fill="none" stroke="#fff" stroke-width="1.5"/>' +
    '<circle cx="7" cy="5" r="1.9" fill="#fff"/></svg>'
  );
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
