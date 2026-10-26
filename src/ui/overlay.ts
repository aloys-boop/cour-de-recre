import { TEAM_COLORS, TEAM_NAMES, TEAM_PLURALS } from '../config';
import { teamPlural } from '../core/diplomacy';
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

  pause(onResume: () => void, onQuit: () => void, extras: HTMLElement[] = [], onHowTo?: () => void): void {
    const card = this.card('Pause', 'La partie est en pause.');
    const buttons = [this.btn('Reprendre', onResume)];
    if (onHowTo) buttons.push(this.btn('Comment jouer', onHowTo, 'btn-secondary btn-howto'));
    buttons.push(this.btn('Quitter', onQuit, 'btn-danger'));
    card.append(this.row(buttons), ...extras);
    this.show(card);
  }

  /** Premier lancement : proposer le tutoriel. */
  welcome(onTutorial: () => void, onLater: () => void): void {
    const card = this.card('Bienvenue dans la cour !', 'Première fois ici ? Le tutoriel t’apprend à jouer en quelques minutes, en jouant pour de vrai.');
    card.classList.add('welcome');
    card.append(this.row([this.btn('Faire le tutoriel', onTutorial, 'btn-tuto'), this.btn('Plus tard', onLater, 'btn-secondary')]));
    const note = document.createElement('p');
    note.className = 'welcome-note';
    note.textContent = 'Tu pourras le refaire à tout moment depuis le menu.';
    card.append(note);
    this.show(card);
  }

  /** Écran « Comment jouer » : les règles en bref, consultable depuis le menu et la pause. */
  howTo(onClose: () => void): void {
    const card = this.card('Comment jouer', '');
    card.classList.add('howto');
    card.querySelector('p')!.remove();
    const body = document.createElement('div');
    body.className = 'howto-body';
    for (const [title, text] of HOW_TO) {
      const sec = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = title;
      const p = document.createElement('p');
      p.textContent = text;
      sec.append(h, p);
      body.append(sec);
    }
    card.append(body, this.row([this.btn('Retour', onClose)]));
    this.show(card);
  }

  end(
    win: boolean,
    mapName: string,
    opts: {
      nextAvailable: boolean;
      onReplay: () => void;
      onNext: () => void;
      onMenu: () => void;
      stats?: EndStats;
      winText?: string;
      /** Titre de victoire (hors alliance) et texte de défaite propres au mode de jeu. */
      winTitle?: string;
      loseText?: string;
      extras?: HTMLElement[];
      /** Couleurs des équipes d'une alliance victorieuse (victoire partagée). */
      alliance?: number[];
    },
  ): void {
    const alliance = opts.alliance && opts.alliance.length > 1 ? opts.alliance : null;
    const names = alliance ? listFr(alliance.map((c) => teamPlural(c))) : '';
    const winText = win && opts.winText ? opts.winText : win ? `La cour « ${mapName} » est à toi.${opts.nextAvailable ? ' Une nouvelle carte est débloquée.' : ' Tu as terminé toutes les cartes !'}` : opts.loseText ?? 'Tes élèves ont été mis KO et tes cases reprises.';
    const card = this.card(
      win ? (alliance ? 'Victoire de l’alliance !' : opts.winTitle ?? 'Victoire !') : 'Défaite…',
      alliance ? (win ? `${names.charAt(0).toUpperCase()}${names.slice(1)} gagnent ensemble. ${winText}` : `L’alliance ${listFr(alliance.map((c) => `des ${TEAM_PLURALS[c] ?? '?'}`))} l’emporte.`) : winText,
    );
    card.classList.add(win ? 'win' : 'lose');
    if (alliance) {
      const row = document.createElement('div');
      row.className = 'alliance-row';
      for (const c of alliance) {
        const d = document.createElement('span');
        d.className = 'alliance-dot';
        d.style.background = TEAM_COLORS[c]?.ui ?? '#888';
        d.title = TEAM_NAMES[c] ?? '';
        row.append(d);
      }
      card.querySelector('h2')!.after(row);
    }
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
    wrap.className = stats.rows.length > 5 ? 'end-stats many' : 'end-stats';
    const table = document.createElement('table');
    const head = document.createElement('tr');
    const labels = ['Équipe', 'Élèves', 'KO infligés', 'KO subis', 'Cases prises'];
    if (stats.supervisors) labels.push('Surveillants KO');
    for (const label of labels) {
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
      const values = [r.produced, r.koDealt, r.koTaken, r.captured];
      if (stats.supervisors) values.push(r.supKo ?? 0);
      for (const v of values) {
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

/** « les Verts, les Jaunes et les Roses ». */
function listFr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Rubriques de l'écran « Comment jouer » (textes courts). */
export const HOW_TO: ReadonlyArray<[string, string]> = [
  ['Le but', 'Prends les cases et les camps des autres équipes. Tu gagnes quand tu es le dernier à avoir des élèves ou un camp, ou quand tu tiens tous les camps.'],
  ['Sélectionner', 'Touche un élève : lui et ses voisins sont choisis. Appui long puis glisse : rectangle de sélection. Double-tap : tous tes élèves à l’écran.'],
  ['Déplacer et attaquer', 'Touche le sol : tes élèves y courent sans se battre (mode Fuir). Touche un ennemi pour l’attaquer. La barre au-dessus d’une bagarre montre qui est le plus fort ; en haut, touche une mini-barre pour aller voir une bagarre hors de l’écran.'],
  ['Cases et camps', 'Reste sur une case blanche pour la capturer : ♥ vie, ♠ dégâts, ♣ production, ♦ vitesse. Ton camp produit des élèves, 30 au plus.'],
  ['Bons points ★', '+2 par ennemi mis KO, +10 par case prise, +25 par camp pris, +1 toutes les 10 s par case tenue.'],
  ['Améliorations', 'Sans sélection, touche ton camp (ou la pastille ★). « Toute l’équipe » : Production, Uniformes, Entraînement, classes, pour tous tes camps. « Ce camp » : Défense, pion, élèves produits, ralliement. ‹ › : camp suivant.'],
  ['Classes', 'Une fois débloquées pour l’équipe, chaque camp choisit Costaud (solide), Sprinteur (rapide, capture vite) ou Infirmier (soigne). Chaque élève spécial coûte des bons points.'],
  ['Pouvoirs', 'Boutons en bas : Sonnerie (fige les ennemis), Boules de neige (dégâts), Goûter (soins). Doigt posé sur un bouton : son aide. Glisse un bouton jusqu’à la carte et lâche pour le lancer (lâche sur le bouton pour annuler). Ou : touche le bouton, vise, puis touche la zone.'],
  ['Pion', 'Dans le panneau du camp : un surveillant à tes couleurs garde le camp et frappe les intrus. Il revient 60 s après un KO.'],
  ['Caméra', 'Glisse un doigt pour bouger la vue, pince pour zoomer, touche la mini-carte pour y aller.'],
  ['Ralliement', 'Chaque camp a son drapeau, où vont ses nouveaux élèves. Glisse depuis un camp jusqu’au point voulu, ou utilise « Ralliement » dans son panneau. Appui long sur le sol : camp le plus proche.'],
  ['Alliances', 'Touche la puce d’une équipe, en haut, pour lui proposer une alliance… ou la rompre.'],
];
