import { meritsOf } from '../core/merits';
import { PION, pionOf, pionRespawnLeft, type PionResult } from '../core/pion';
import type { Tile } from '../core/tile';
import type { Game } from '../game';
import type { CampSection } from './camp-panel';

/** Rubrique « Pion » du panneau du camp : achat unique, état (debout, PV, retour après un KO). */
export class PionSection implements CampSection {
  readonly el: HTMLElement;
  private btn: HTMLButtonElement;
  private status: HTMLElement;
  private game: Game | null = null;
  private camp: Tile | null = null;

  constructor(private hint: (text: string, ms?: number) => void = () => undefined) {
    this.el = document.createElement('div');
    this.el.className = 'camp-section pion-section';
    const h = document.createElement('h3');
    h.textContent = 'Pion';
    const row = document.createElement('div');
    row.className = 'pion-row';
    this.status = document.createElement('span');
    this.status.className = 'pion-status';
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'btn camp-buy pion-buy';
    this.btn.addEventListener('click', () => this.buy());
    row.append(this.status, this.btn);
    this.el.append(h, row);
  }

  private buy(): void {
    if (!this.game || !this.camp) return;
    const r: PionResult = this.game.buyCampPion(this.camp);
    if (r === 'pas-assez') this.hint(`Pas assez de bons points : le pion coûte ${PION.cost}.`, 2200);
    else if (r === 'ok') this.hint('Un pion garde maintenant ce camp et frappe les intrus.', 2400);
    this.refresh(this.game, this.camp);
  }

  refresh(game: Game, camp: Tile): void {
    this.game = game;
    this.camp = camp;
    let text: string;
    if (!camp.pionBought) text = `Surveillant à tes couleurs, ${PION.hp} PV : il garde ce camp et frappe les intrus. Revient 60 s après un KO.`;
    else {
      const p = pionOf(game.world, camp);
      text = p ? `Ton pion garde le camp (${Math.ceil(p.hp)} / ${p.maxHp} PV).` : `Pion KO : retour dans ${Math.ceil(pionRespawnLeft(game.world, camp))} s.`;
    }
    if (this.status.textContent !== text) this.status.textContent = text;
    const label = camp.pionBought ? 'Acheté' : `Engager · ${PION.cost} ★`;
    if (this.btn.textContent !== label) this.btn.textContent = label;
    this.btn.disabled = camp.pionBought;
    this.btn.classList.toggle('poor', !camp.pionBought && meritsOf(game.world, game.playerTeam) < PION.cost);
  }
}
