import type { Tile } from '../core/tile';
import type { Game } from '../game';
import type { CampSection } from './camp-panel';

const GLYPH: Record<string, string> = { heart: '♥', spade: '♠', club: '♣', diamond: '♦' };

/** Nom court de la case secourue, pour la ligne d'état. */
function targetName(t: Tile): string {
  if (t.isCamp) return 'un autre camp';
  if (t.kind === 'throne') return 'le trône';
  return `la case ${t.suit ? GLYPH[t.suit] : ''}`.trim();
}

/**
 * Rubrique « Renforts » de la zone « Ce camp » : interrupteur « Auto » (les nouveaux élèves
 * partent d'eux-mêmes vers la case menacée la plus urgente) et « Partout » (tous les camps).
 */
export class ReinforceSection implements CampSection {
  readonly el: HTMLElement;
  readonly toggleBtn: HTMLButtonElement;
  readonly allBtn: HTMLButtonElement;
  private status: HTMLElement;
  private game: Game | null = null;
  private camp: Tile | null = null;

  constructor(private hint: (text: string, ms?: number) => void = () => undefined) {
    this.el = document.createElement('div');
    this.el.className = 'camp-section reinforce-section';
    const h = document.createElement('h3');
    h.textContent = 'Renforts';
    const row = document.createElement('div');
    row.className = 'pion-row';
    this.status = document.createElement('span');
    this.status.className = 'pion-status';
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.type = 'button';
    this.toggleBtn.className = 'btn camp-buy reinforce-toggle';
    this.toggleBtn.setAttribute('role', 'switch');
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.allBtn = document.createElement('button');
    this.allBtn.type = 'button';
    this.allBtn.className = 'btn btn-secondary camp-buy reinforce-all';
    this.allBtn.textContent = 'Partout';
    this.allBtn.addEventListener('click', () => this.all());
    row.append(this.status, this.toggleBtn, this.allBtn);
    this.el.append(h, row);
  }

  private toggle(): void {
    const g = this.game;
    const camp = this.camp;
    if (!g || !camp) return;
    const on = !g.world.reinforceOn(camp);
    if (g.setReinforce(camp, on))
      this.hint(on ? 'Renforts automatiques : les nouveaux élèves de ce camp iront secourir la case menacée.' : 'Renforts automatiques coupés pour ce camp.', 2600);
    this.refresh(g, camp);
  }

  private all(): void {
    const g = this.game;
    const camp = this.camp;
    if (!g || !camp) return;
    const n = g.setReinforce(null, true);
    this.hint(n ? `Renforts automatiques activés dans ${n > 1 ? `${n} camps` : '1 camp'}.` : 'Tous tes camps sont déjà en renforts automatiques.', 2400);
    this.refresh(g, camp);
  }

  refresh(game: Game, camp: Tile): void {
    this.game = game;
    this.camp = camp;
    const on = game.world.reinforceOn(camp);
    const target = game.world.reinforceTargetOf(camp);
    const text = !on ? 'Coupés : ils suivent le ralliement.' : target ? `En route vers ${targetName(target)}.` : 'Prêts : rien de menacé.';
    if (this.status.textContent !== text) this.status.textContent = text;
    const label = on ? 'Auto ✓' : 'Auto';
    if (this.toggleBtn.textContent !== label) this.toggleBtn.textContent = label;
    this.toggleBtn.classList.toggle('on', on);
    this.toggleBtn.setAttribute('aria-checked', String(on));
    this.toggleBtn.setAttribute('aria-label', on ? 'Couper les renforts automatiques de ce camp' : 'Activer les renforts automatiques de ce camp');
    const camps = game.world.tiles.filter((t) => t.isCamp && t.owner === game.playerTeam);
    this.allBtn.disabled = camps.every((c) => game.world.reinforceOn(c));
  }
}
