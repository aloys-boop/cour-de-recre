import { TEAM_COLORS, TEAM_NAMES } from '../config';
import { formatDuration, type EndStats } from '../core/stats';

/** Fenêtres modales : pause, fin de partie, aide à l'installation. */
export class Overlay {
  constructor(private root: HTMLElement) {}

  hide(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private show(card: HTMLElement): void {
    this.root.innerHTML = '';
    this.root.append(card);
    this.root.classList.remove('hidden');
  }

  pause(onResume: () => void, onQuit: () => void, extras: HTMLElement[] = []): void {
    const card = this.card('Pause', 'La partie est en pause.');
    card.append(this.row([this.btn('Reprendre', onResume), this.btn('Quitter', onQuit, 'btn-danger')]), ...extras);
    this.show(card);
  }

  end(
    win: boolean,
    mapName: string,
    opts: { nextAvailable: boolean; onReplay: () => void; onNext: () => void; onMenu: () => void; stats?: EndStats; winText?: string; extras?: HTMLElement[] },
  ): void {
    const card = this.card(
      win ? 'Victoire !' : 'Défaite…',
      win && opts.winText ? opts.winText : win ? `La cour « ${mapName} » est à toi.${opts.nextAvailable ? ' Une nouvelle carte est débloquée.' : ' Tu as terminé toutes les cartes !'}` : 'Tes élèves ont été mis KO et tes cases reprises.',
    );
    card.classList.add(win ? 'win' : 'lose');
    if (opts.stats) card.append(this.statsTable(opts.stats));
    card.append(...(opts.extras ?? []));
    const buttons = [this.btn('Rejouer', opts.onReplay, win ? 'btn-secondary' : '')];
    if (win && opts.nextAvailable) buttons.push(this.btn('Carte suivante', opts.onNext));
    buttons.push(this.btn('Menu', opts.onMenu, 'btn-secondary'));
    card.append(this.row(buttons));
    this.show(card);
  }

  installHelp(onClose: () => void): void {
    const card = this.card('Installer sur iPhone', '');
    const p = card.querySelector('p')!;
    p.innerHTML =
      '1. Ouvre cette page dans <b>Safari</b>.<br>' +
      '2. Touche le bouton <b>Partager</b> (le carré avec une flèche).<br>' +
      '3. Choisis <b>« Sur l’écran d’accueil »</b> puis <b>Ajouter</b>.<br>' +
      'Le jeu se lance ensuite en plein écran et fonctionne hors ligne.';
    p.style.textAlign = 'left';
    card.append(this.row([this.btn('Fermer', onClose)]));
    this.show(card);
  }

  /** Tableau de fin de partie : une ligne par équipe, le joueur en évidence. */
  private statsTable(stats: EndStats): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'end-stats';
    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const label of ['Équipe', 'Élèves', 'KO infligés', 'KO subis', 'Cases prises']) {
      const th = document.createElement('th');
      th.textContent = label;
      head.append(th);
    }
    table.append(head);
    for (const r of stats.rows) {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.className = 'me';
      const name = document.createElement('td');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = TEAM_COLORS[r.color]?.ui ?? '#888';
      name.append(dot, document.createTextNode(`${TEAM_NAMES[r.color] ?? '?'}${r.isPlayer ? ' (toi)' : ''}`));
      tr.append(name);
      for (const v of [r.produced, r.koDealt, r.koTaken, r.captured]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.append(td);
      }
      table.append(tr);
    }
    const dur = document.createElement('div');
    dur.className = 'end-duration';
    dur.textContent = `Durée de la partie : ${formatDuration(stats.duration)}`;
    wrap.append(table, dur);
    return wrap;
  }

  private card(title: string, text: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'card';
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    card.append(h, p);
    return card;
  }

  private row(buttons: HTMLElement[]): HTMLElement {
    const r = document.createElement('div');
    r.className = 'row';
    r.append(...buttons);
    return r;
  }

  private btn(label: string, onClick: () => void, extra = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `btn ${extra}`.trim();
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
}
