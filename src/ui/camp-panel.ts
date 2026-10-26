import './camp.css';
import { TEAM_COLORS } from '../config';
import { meritsOf } from '../core/merits';
import type { Tile } from '../core/tile';
import { MAX_UPGRADE_LEVEL, upgradeCost, UPGRADE_BRANCHES, UPGRADES, type UpgradeBranch } from '../core/upgrades';
import type { Game } from '../game';

/** Section supplémentaire du panneau (classes d'élèves, pion…), redessinée à chaque rafraîchissement. */
export interface CampSection {
  el: HTMLElement;
  refresh(game: Game, camp: Tile): void;
}

/**
 * Bons points du joueur et panneau d'un camp :
 *  - pastille « ★ 42 » en haut à droite (toucher : panneau du camp principal) ;
 *  - tap sur un de ses camps : panneau d'amélioration propre à ce camp, 4 branches de 3 niveaux.
 */
export class CampPanel {
  readonly pill: HTMLButtonElement;
  readonly panel: HTMLElement;
  private camp: Tile | null = null;
  private rows = new Map<UpgradeBranch, HTMLElement>();
  private lastPoints = -1;
  private sections: CampSection[] = [];

  constructor(
    root: HTMLElement,
    private getGame: () => Game | null,
    private hint: (text: string, ms?: number) => void = () => undefined,
  ) {
    this.pill = document.createElement('button');
    this.pill.type = 'button';
    this.pill.id = 'merit-pill';
    this.pill.className = 'merit-pill';
    this.pill.innerHTML = `${starIcon(18)}<span class="merit-count">0</span>`;
    this.pill.setAttribute('aria-label', 'Bons points. Toucher pour améliorer ton camp');
    this.pill.addEventListener('click', () => {
      const g = this.getGame();
      if (!g) return;
      if (this.camp) return this.close();
      const c = g.mainCamp();
      if (c) g.openCamp(c);
      else this.hint('Tu n’as plus de camp à améliorer.');
    });
    const host = root.querySelector('.hud-top-right') ?? root;
    host.insertBefore(this.pill, host.firstChild);

    this.panel = document.createElement('div');
    this.panel.id = 'camp-panel';
    this.panel.className = 'camp-panel hidden';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Améliorations du camp');
    const head = document.createElement('div');
    head.className = 'camp-head';
    head.innerHTML = '<span class="dot"></span><span class="camp-title">Camp</span><span class="camp-balance"></span>';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'camp-close';
    close.setAttribute('aria-label', 'Fermer');
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());
    head.append(close);
    this.panel.append(head);
    const list = document.createElement('div');
    list.className = 'camp-rows';
    for (const b of UPGRADE_BRANCHES) {
      const row = document.createElement('div');
      row.className = 'camp-row';
      row.dataset.branch = b;
      const info = UPGRADES[b];
      row.innerHTML =
        `<span class="camp-flag" style="background:${info.color}"></span>` +
        `<span class="camp-name">${info.label}<small><span class="camp-level"></span> ${info.effect}</small></span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn camp-buy';
      btn.addEventListener('click', () => this.buy(b));
      row.append(btn);
      list.append(row);
      this.rows.set(b, row);
    }
    this.panel.append(list);
    root.appendChild(this.panel);
  }

  /** Ajoute une section sous les améliorations (classes, pion). */
  addSection(section: CampSection): void {
    this.sections.push(section);
    this.panel.append(section.el);
  }

  get openCamp(): Tile | null {
    return this.camp;
  }

  open(camp: Tile): void {
    this.camp = camp;
    this.panel.classList.remove('hidden');
    this.refresh();
  }

  close(): void {
    this.camp = null;
    this.panel.classList.add('hidden');
  }

  private buy(branch: UpgradeBranch): void {
    const g = this.getGame();
    const camp = this.camp;
    if (!g || !camp) return;
    // L'achat peut refermer le panneau (tutoriel) : on garde le camp sous la main.
    const r = g.upgradeCamp(camp, branch);
    if (r === 'pas-assez') this.hint(`Pas assez de bons points : il en faut ${upgradeCost(camp, branch)}.`, 2200);
    else if (r === 'ok') this.hint(`${UPGRADES[branch].label} : niveau ${camp.upgrades[branch]} !`, 1800);
    this.refresh();
  }

  /** Met à jour la pastille et le panneau ouvert (appelé avec le HUD). */
  refresh(): void {
    const g = this.getGame();
    if (!g) return this.close();
    const points = meritsOf(g.world, g.playerTeam);
    const count = this.pill.querySelector('.merit-count')!;
    if (count.textContent !== String(points)) count.textContent = String(points);
    if (this.lastPoints >= 0 && points > this.lastPoints) {
      this.pill.classList.remove('gain');
      void this.pill.offsetWidth;
      this.pill.classList.add('gain');
    }
    this.lastPoints = points;
    const camp = this.camp;
    if (!camp) return;
    if (camp.owner !== g.playerTeam) {
      this.close();
      this.hint('Camp perdu : ses améliorations sont perdues aussi.', 2600);
      return;
    }
    const color = g.world.teamColors[g.playerTeam];
    this.panel.querySelector<HTMLElement>('.dot')!.style.background = TEAM_COLORS[color].ui;
    setText(this.panel.querySelector('.camp-title')!, camp === g.mainCamp() ? 'Ton camp' : 'Camp conquis');
    setText(this.panel.querySelector('.camp-balance')!, `${points} ★`);
    for (const b of UPGRADE_BRANCHES) {
      const row = this.rows.get(b)!;
      const lvl = camp.upgrades[b];
      const lvlEl = row.querySelector('.camp-level')!;
      const stars = '★'.repeat(lvl) + '☆'.repeat(MAX_UPGRADE_LEVEL - lvl);
      setText(lvlEl, stars);
      lvlEl.setAttribute('aria-label', `niveau ${lvl} sur ${MAX_UPGRADE_LEVEL}`);
      const btn = row.querySelector<HTMLButtonElement>('.camp-buy')!;
      const cost = upgradeCost(camp, b);
      setText(btn, cost === null ? 'Max' : `+${pct(UPGRADES[b].perLevel)} · ${cost} ★`);
      btn.disabled = cost === null;
      btn.classList.toggle('poor', cost !== null && points < cost);
    }
    for (const s of this.sections) s.refresh(g, camp);
  }
}

function pct(x: number): string {
  return `${Math.round(x * 100)} %`;
}

function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** Étoile dorée (bons points). */
export function starIcon(size = 16): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">` +
    '<path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z" fill="#ffd23f" stroke="#a8780c" stroke-width="1.6" stroke-linejoin="round"/>' +
    '</svg>'
  );
}
