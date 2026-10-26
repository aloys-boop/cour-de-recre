import './camp.css';
import { TEAM_COLORS } from '../config';
import { campName, campNumber, stepCamp } from '../core/camps';
import { meritsOf } from '../core/merits';
import type { Tile } from '../core/tile';
import { CLASS_UNLOCK, defenseCost, GLOBAL_BRANCHES, globalCost, MAX_UPGRADE_LEVEL, teamUpgrades, UPGRADES, type GlobalBranch } from '../core/upgrades';
import type { Game } from '../game';

/** Section de la zone « Ce camp » (classe produite, pion, ralliement), redessinée à chaque rafraîchissement. */
export interface CampSection {
  el: HTMLElement;
  refresh(game: Game, camp: Tile): void;
}

/**
 * Bons points du joueur et panneau d'amélioration :
 *  - pastille « ★ 42 » en haut à droite (toucher : panneau, sur le camp principal) ;
 *  - tap sur un de ses camps : panneau en deux zones bien séparées,
 *    « Toute l'équipe » (Production, Uniformes, Entraînement, déblocage des classes) et
 *    « Ce camp » (Défense, pion, classe produite, ralliement), avec des flèches ‹ › pour passer
 *    d'un camp à l'autre sans fermer le panneau (la caméra glisse vers le camp affiché).
 */
export class CampPanel {
  readonly pill: HTMLButtonElement;
  readonly panel: HTMLElement;
  private camp: Tile | null = null;
  private rows = new Map<GlobalBranch | 'classes' | 'def', HTMLElement>();
  private lastPoints = -1;
  private sections: CampSection[] = [];
  private campZone: HTMLElement;
  private campLabel: HTMLElement;
  readonly prevBtn: HTMLButtonElement;
  readonly nextBtn: HTMLButtonElement;

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
    this.pill.setAttribute('aria-label', 'Bons points. Toucher pour les améliorations');
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
    this.panel.setAttribute('aria-label', 'Améliorations');
    const head = document.createElement('div');
    head.className = 'camp-head';
    head.innerHTML = '<span class="dot"></span><span class="camp-title">Améliorations</span><span class="camp-balance"></span>';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'camp-close';
    close.setAttribute('aria-label', 'Fermer');
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());
    head.append(close);

    // Zone « Toute l'équipe ».
    const teamZone = document.createElement('section');
    teamZone.className = 'camp-zone zone-team';
    teamZone.innerHTML = '<h3 class="zone-title">Toute l’équipe <small>tous tes élèves, tous tes camps</small></h3>';
    const teamRows = document.createElement('div');
    teamRows.className = 'camp-rows';
    for (const b of GLOBAL_BRANCHES) teamRows.append(this.makeRow(b, UPGRADES[b].label, UPGRADES[b].effect, UPGRADES[b].color, () => this.buyGlobal(b)));
    teamRows.append(this.makeRow('classes', CLASS_UNLOCK.label, 'costaud, sprinteur, infirmier', '#ffd23f', () => this.buyClasses()));
    teamZone.append(teamRows);

    // Zone « Ce camp », avec navigation.
    this.campZone = document.createElement('section');
    this.campZone.className = 'camp-zone zone-camp';
    const nav = document.createElement('div');
    nav.className = 'camp-nav';
    this.prevBtn = navButton('‹', 'Camp précédent', () => this.step(-1));
    this.nextBtn = navButton('›', 'Camp suivant', () => this.step(1));
    this.campLabel = document.createElement('span');
    this.campLabel.className = 'camp-label';
    nav.append(this.prevBtn, this.campLabel, this.nextBtn);
    const campRows = document.createElement('div');
    campRows.className = 'camp-rows';
    campRows.append(this.makeRow('def', UPGRADES.def.label, UPGRADES.def.effect, UPGRADES.def.color, () => this.buyDefense()));
    this.campZone.append(nav, campRows);

    const zones = document.createElement('div');
    zones.className = 'camp-zones';
    zones.append(teamZone, this.campZone);
    this.panel.append(head, zones);
    root.appendChild(this.panel);
  }

  private makeRow(key: GlobalBranch | 'classes' | 'def', label: string, effect: string, color: string, onBuy: () => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'camp-row';
    row.dataset.branch = key;
    row.innerHTML = `<span class="camp-flag" style="background:${color}"></span><span class="camp-name">${label}<small><span class="camp-level"></span> ${effect}</small></span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn camp-buy';
    btn.addEventListener('click', onBuy);
    row.append(btn);
    this.rows.set(key, row);
    return row;
  }

  /** Ajoute une section à la zone « Ce camp » (classe produite, pion, ralliement). */
  addSection(section: CampSection): void {
    this.sections.push(section);
    this.campZone.append(section.el);
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

  /** Camp précédent ou suivant du joueur, sans fermer le panneau ; la caméra glisse vers lui. */
  step(dir: 1 | -1): void {
    const g = this.getGame();
    if (!g || !this.camp) return;
    const next = stepCamp(g.world, g.playerTeam, this.camp, dir);
    if (!next) return;
    this.camp = next;
    g.focusCamp(next);
    this.refresh();
  }

  private buyGlobal(branch: GlobalBranch): void {
    const g = this.getGame();
    if (!g) return;
    const cost = globalCost(g.world, g.playerTeam, branch);
    const r = g.buyTeamUpgrade(branch);
    if (r === 'pas-assez') this.hint(`Pas assez de bons points : il en faut ${cost}.`, 2200);
    else if (r === 'ok') this.hint(`${UPGRADES[branch].label} niveau ${teamUpgrades(g.world, g.playerTeam)[branch]} pour toute l’équipe !`, 1800);
    this.refresh();
  }

  private buyClasses(): void {
    const g = this.getGame();
    if (!g) return;
    const r = g.buyClasses();
    if (r === 'pas-assez') this.hint(`Pas assez de bons points : il en faut ${CLASS_UNLOCK.cost}.`, 2200);
    else if (r === 'ok') this.hint('Classes débloquées : chaque camp peut choisir ce qu’il produit.', 2400);
    this.refresh();
  }

  private buyDefense(): void {
    const g = this.getGame();
    const camp = this.camp;
    if (!g || !camp) return;
    const cost = defenseCost(camp);
    // L'achat peut refermer le panneau (tutoriel) : on garde le camp sous la main.
    const r = g.buyCampDefense(camp);
    if (r === 'pas-assez') this.hint(`Pas assez de bons points : il en faut ${cost}.`, 2200);
    else if (r === 'ok') this.hint(`Défense de ce camp : niveau ${camp.defense} !`, 1800);
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
      // Camp perdu : on passe à un autre camp du joueur s'il en reste.
      const other = stepCamp(g.world, g.playerTeam, camp, 1);
      this.hint('Camp perdu : son pion, sa Défense et son ralliement sont perdus.', 2600);
      if (!other) return this.close();
      this.camp = other;
      return this.refresh();
    }
    const color = g.world.teamColors[g.playerTeam];
    this.panel.querySelector<HTMLElement>('.dot')!.style.background = TEAM_COLORS[color].ui;
    setText(this.panel.querySelector('.camp-balance')!, `${points} ★`);
    const n = campNumber(g.world, g.playerTeam, camp);
    setText(this.campLabel, `Camp ${n?.index ?? 1}/${n?.count ?? 1} · ${campName(g.world, camp, g.playerTeam)}`);
    const single = (n?.count ?? 1) <= 1;
    this.prevBtn.disabled = single;
    this.nextBtn.disabled = single;
    const up = teamUpgrades(g.world, g.playerTeam);
    for (const b of GLOBAL_BRANCHES) this.fillRow(b, up[b], MAX_UPGRADE_LEVEL, globalCost(g.world, g.playerTeam, b), `+${pct(UPGRADES[b].perLevel)}`, points);
    this.fillRow('classes', up.classes ? 1 : 0, 1, up.classes ? null : CLASS_UNLOCK.cost, 'Débloquer', points, up.classes ? 'Débloquées' : undefined);
    this.fillRow('def', camp.defense, MAX_UPGRADE_LEVEL, defenseCost(camp), `+${pct(UPGRADES.def.perLevel)}`, points);
    for (const s of this.sections) s.refresh(g, camp);
  }

  private fillRow(key: GlobalBranch | 'classes' | 'def', lvl: number, max: number, cost: number | null, what: string, points: number, doneText = 'Max'): void {
    const row = this.rows.get(key)!;
    const lvlEl = row.querySelector('.camp-level')!;
    setText(lvlEl, max === 1 ? (lvl ? '✔' : '') : '★'.repeat(lvl) + '☆'.repeat(max - lvl));
    lvlEl.setAttribute('aria-label', `niveau ${lvl} sur ${max}`);
    const btn = row.querySelector<HTMLButtonElement>('.camp-buy')!;
    setText(btn, cost === null ? doneText : `${what} · ${cost} ★`);
    btn.disabled = cost === null;
    btn.classList.toggle('poor', cost !== null && points < cost);
  }
}

function navButton(text: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'camp-nav-btn';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
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
