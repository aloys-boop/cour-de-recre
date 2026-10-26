import type { Tile } from '../core/tile';
import type { Game } from '../game';
import type { CampSection } from './camp-panel';

/**
 * Rubrique « Ralliement » de la zone « Ce camp » : « Placer » (puis toucher la carte) et
 * « Supprimer » (les nouveaux élèves restent alors au camp). Raccourci : glisser depuis le camp.
 */
export class RallySection implements CampSection {
  readonly el: HTMLElement;
  readonly placeBtn: HTMLButtonElement;
  readonly clearBtn: HTMLButtonElement;
  private status: HTMLElement;
  private game: Game | null = null;
  private camp: Tile | null = null;

  constructor(private hint: (text: string, ms?: number) => void = () => undefined) {
    this.el = document.createElement('div');
    this.el.className = 'camp-section rally-section';
    const h = document.createElement('h3');
    h.textContent = 'Ralliement';
    const row = document.createElement('div');
    row.className = 'pion-row';
    this.status = document.createElement('span');
    this.status.className = 'pion-status';
    this.placeBtn = document.createElement('button');
    this.placeBtn.type = 'button';
    this.placeBtn.className = 'btn camp-buy rally-place';
    this.placeBtn.addEventListener('click', () => this.place());
    this.clearBtn = document.createElement('button');
    this.clearBtn.type = 'button';
    this.clearBtn.className = 'btn btn-secondary camp-buy rally-clear';
    this.clearBtn.textContent = 'Supprimer';
    this.clearBtn.addEventListener('click', () => this.clear());
    row.append(this.status, this.placeBtn, this.clearBtn);
    this.el.append(h, row);
  }

  private place(): void {
    const g = this.game;
    const camp = this.camp;
    if (!g || !camp) return;
    if (g.placingRally === camp) {
      g.startRallyPlacement(null);
      this.hint('Ralliement : placement annulé.', 1400);
    } else {
      g.startRallyPlacement(camp);
      this.hint('Touche la carte pour placer le drapeau de ralliement de ce camp.', 3000);
    }
    this.refresh(g, camp);
  }

  private clear(): void {
    const g = this.game;
    const camp = this.camp;
    if (!g || !camp) return;
    if (g.clearRally(camp)) this.hint('Ralliement supprimé : les nouveaux élèves de ce camp y restent.', 2400);
    this.refresh(g, camp);
  }

  refresh(game: Game, camp: Tile): void {
    this.game = game;
    this.camp = camp;
    const has = !!game.world.rallyFor(camp);
    const placing = game.placingRally === camp;
    const text = placing ? 'Touche la carte…' : has ? 'Nouveaux élèves au drapeau.' : 'Aucun : ils restent au camp.';
    if (this.status.textContent !== text) this.status.textContent = text;
    const label = placing ? 'Annuler' : has ? 'Déplacer' : 'Placer';
    if (this.placeBtn.textContent !== label) this.placeBtn.textContent = label;
    this.placeBtn.classList.toggle('armed', placing);
    this.clearBtn.disabled = !has;
  }
}
