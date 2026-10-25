import './diplomacy-extras.css';
import { SUIT_GLYPH, type ActionResult, type DiplomacyExtras } from '../core/diplomacy-extras';
import { teamPlural } from '../core/diplomacy';
import type { World } from '../core/world';

/** Ce dont l'interface a besoin de la partie en cours (Game convient). */
export interface ExtrasHost {
  readonly world: World;
  readonly extras: DiplomacyExtras;
  readonly selected: Set<number>;
  readonly playerTeam: number;
  readonly paused: boolean;
  readonly over: boolean;
}

/** Panneau « Diplomatie » ouvert (Hud convient) : équipe affichée, -1 si fermé. */
export interface DiploPanelOwner {
  readonly diplomacyTeam: number;
}

const NB = ' ';

/**
 * Interface des options de diplomatie, greffée sur le HUD sans le modifier :
 *  - dans le panneau « Diplomatie » : « Donner des élèves » et « Céder une case » (allié, option
 *    Cadeaux), « Payer un tribut » (équipe non alliée, option Tribut) ;
 *  - bouton « SOS » contre le bord droit, au milieu (option Appel à l'aide), avec la recharge ;
 *  - carte de proposition de tribut d'une IA (Accepter / Refuser), en haut à droite ;
 *  - drapeau blanc et compte à rebours sur la puce d'une équipe en trêve.
 */
export class DiplomacyExtrasHud {
  readonly sosBtn: HTMLButtonElement;
  readonly offerCard: HTMLElement;
  readonly panelBox: HTMLElement;
  private giveBtn: HTMLButtonElement;
  private cedeBtn: HTMLButtonElement;
  private tributeBtn: HTMLButtonElement;
  private panelStatus: HTMLElement;
  private timer = 0;

  constructor(
    private root: HTMLElement,
    private getHost: () => ExtrasHost | null,
    private panel: DiploPanelOwner,
    private hint: (text: string, ms?: number) => void = () => undefined,
  ) {
    // Bouton SOS.
    this.sosBtn = document.createElement('button');
    this.sosBtn.type = 'button';
    this.sosBtn.id = 'btn-sos';
    this.sosBtn.className = 'sos-btn hidden';
    this.sosBtn.innerHTML = '<span class="sos-label">SOS</span><span class="sos-wait"></span><span class="sos-help"></span>';
    this.sosBtn.addEventListener('click', () => this.act((h) => h.extras.playerSos()));
    root.appendChild(this.sosBtn);

    // Proposition de tribut d'une IA (non bloquante).
    this.offerCard = document.createElement('div');
    this.offerCard.id = 'tribute-offer';
    this.offerCard.className = 'offer-card hidden';
    this.offerCard.setAttribute('role', 'alert');
    this.offerCard.innerHTML =
      '<p class="offer-text"></p><div class="offer-actions">' +
      '<button type="button" class="btn offer-accept">Accepter</button>' +
      '<button type="button" class="btn btn-secondary offer-refuse">Refuser</button>' +
      '<span class="offer-timer" aria-hidden="true"></span></div>';
    this.offerCard.querySelector('.offer-accept')!.addEventListener('click', () => this.act((h) => h.extras.acceptOffer()));
    this.offerCard.querySelector('.offer-refuse')!.addEventListener('click', () => this.act((h) => h.extras.refuseOffer()));
    root.appendChild(this.offerCard);

    // Actions supplémentaires dans le panneau « Diplomatie ».
    this.panelBox = document.createElement('div');
    this.panelBox.className = 'diplo-extras hidden';
    this.panelBox.innerHTML =
      '<p class="diplo-extra-status"></p><div class="diplo-extra-actions">' +
      '<button type="button" class="btn diplo-give">Donner des élèves</button>' +
      '<button type="button" class="btn diplo-cede">Céder une case</button>' +
      '<button type="button" class="btn diplo-tribute">Payer un tribut</button></div>';
    this.panelStatus = this.panelBox.querySelector('.diplo-extra-status')!;
    this.giveBtn = this.panelBox.querySelector('.diplo-give')!;
    this.cedeBtn = this.panelBox.querySelector('.diplo-cede')!;
    this.tributeBtn = this.panelBox.querySelector('.diplo-tribute')!;
    this.giveBtn.addEventListener('click', () => this.act((h) => h.extras.giftSelected(this.panel.diplomacyTeam, h.selected)));
    this.cedeBtn.addEventListener('click', () => this.act((h) => h.extras.playerCedeTile(this.panel.diplomacyTeam)));
    this.tributeBtn.addEventListener('click', () => this.act((h) => h.extras.payTribute(this.panel.diplomacyTeam)));
    const dp = root.querySelector('#diplo-panel');
    if (dp) dp.insertBefore(this.panelBox, dp.querySelector('.diplo-actions'));

    // Ouverture du panneau (toucher une puce) : mise à jour immédiate.
    root.querySelector('#team-chips')?.addEventListener('click', () => this.refresh());
    this.refresh();
    this.timer = window.setInterval(() => {
      if (!this.root.classList.contains('hidden')) this.refresh();
    }, 250);
  }

  destroy(): void {
    clearInterval(this.timer);
    this.sosBtn.remove();
    this.offerCard.remove();
    this.panelBox.remove();
  }

  private act(fn: (h: ExtrasHost) => ActionResult): void {
    const h = this.getHost();
    if (!h || h.paused || h.over) return;
    const r = fn(h);
    if (r.text) this.hint(r.text, 2600);
    this.refresh();
  }

  /** Met à jour le bouton SOS, la carte de tribut, les puces en trêve et le panneau. */
  refresh(): void {
    const h = this.getHost();
    const rules = h?.world.rules;
    this.refreshSos(h);
    this.refreshChips(h);
    this.refreshPanel(h);
    const o = h && rules?.tribute ? h.extras.offer : null;
    this.offerCard.classList.toggle('hidden', !o);
    if (h && o) {
      const name = teamPlural(h.world.teamColors[o.from] ?? o.from);
      setText(this.offerCard.querySelector('.offer-text')!, `${cap(name)} proposent un tribut${NB}: une case ${SUIT_GLYPH[o.tile.suit!]} contre une trêve de 30${NB}s.`);
      setText(this.offerCard.querySelector('.offer-timer')!, `${Math.max(0, Math.ceil(o.expires - h.world.time))}${NB}s`);
    }
  }

  private refreshSos(h: ExtrasHost | null): void {
    const on = !!h && !!h.world.rules.sos;
    this.sosBtn.classList.toggle('hidden', !on);
    if (!h || !on) return;
    const wait = Math.ceil(h.extras.sosCooldownLeft(h.playerTeam));
    const helpers = h.extras.helpersFor(h.playerTeam);
    this.sosBtn.classList.toggle('cooling', wait > 0);
    setText(this.sosBtn.querySelector('.sos-wait')!, wait > 0 ? `${wait}${NB}s` : '');
    setText(this.sosBtn.querySelector('.sos-help')!, helpers > 0 ? String(helpers) : '');
    const label = wait > 0 ? `Appel à l’aide : disponible dans ${wait} secondes` : 'Appel à l’aide : tes alliés viennent défendre ton camp';
    if (this.sosBtn.getAttribute('aria-label') !== label) this.sosBtn.setAttribute('aria-label', label);
  }

  private refreshChips(h: ExtrasHost | null): void {
    const chips = this.root.querySelectorAll<HTMLElement>('#team-chips .chip');
    chips.forEach((chip) => {
      const t = Number(chip.dataset.team);
      const left = h && h.world.rules.tribute && t !== h.playerTeam ? Math.ceil(h.extras.truceLeft(t, h.playerTeam)) : 0;
      chip.classList.toggle('truce', left > 0);
      let badge = chip.querySelector<HTMLElement>('.chip-truce');
      if (left > 0 && !badge) {
        badge = document.createElement('span');
        badge.className = 'chip-truce';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = `${flagIcon()}<span class="chip-truce-s"></span>`;
        chip.appendChild(badge);
      }
      if (badge) setText(badge.querySelector('.chip-truce-s')!, left > 0 ? String(left) : '');
    });
  }

  private refreshPanel(h: ExtrasHost | null): void {
    const team = this.panel.diplomacyTeam;
    const w = h?.world;
    if (!h || !w || team < 0 || team >= w.numTeams || team === h.playerTeam) return this.panelBox.classList.add('hidden');
    const me = h.playerTeam;
    const alive = w.teamUnitCount(team) > 0 || w.teamCampCount(team) > 0;
    const allied = w.isAllied(me, team);
    const gifts = !!w.rules.gifts && allied;
    const tribute = !!w.rules.tribute && !allied;
    const truce = tribute ? Math.ceil(h.extras.truceLeft(team, me)) : 0;
    this.panelBox.classList.toggle('hidden', !alive || (!gifts && !tribute));
    this.giveBtn.classList.toggle('hidden', !gifts);
    this.cedeBtn.classList.toggle('hidden', !gifts);
    this.tributeBtn.classList.toggle('hidden', !tribute);
    const tile = gifts || tribute ? h.extras.nearestBonusTile(me, team) : null;
    const glyph = tile?.suit ? `${NB}${SUIT_GLYPH[tile.suit]}` : '';
    if (gifts) {
      const n = [...h.selected].filter((id) => w.unitById(id)?.team === me).length;
      setText(this.giveBtn, n > 0 ? `Donner ${n}${NB}élève${n > 1 ? 's' : ''}` : 'Donner des élèves');
      setText(this.cedeBtn, `Céder une case${glyph}`);
      setText(this.panelStatus, 'Cadeau : tes élèves sélectionnés, ou ta case bonus la plus proche de ton allié.');
    }
    if (tribute) {
      this.tributeBtn.disabled = truce > 0;
      setText(this.tributeBtn, truce > 0 ? `Trêve${NB}: ${truce}${NB}s` : `Payer un tribut${glyph}`);
      setText(
        this.panelStatus,
        truce > 0 ? `Trêve en cours${NB}: ni combat ni capture entre vous pendant encore ${truce}${NB}s.` : `Tribut${NB}: cède une case bonus contre 30${NB}s de trêve.`,
      );
    }
  }
}

function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Drapeau blanc (trêve). */
function flagIcon(): string {
  return (
    '<svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true">' +
    '<path d="M1.5 0.5v11" stroke="#0d2a40" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M2 1h7.5l-1.8 2.5L9.5 6H2z" fill="#fff" stroke="#0d2a40" stroke-width="0.9" stroke-linejoin="round"/>' +
    '</svg>'
  );
}
