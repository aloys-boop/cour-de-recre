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

  pause(onResume: () => void, onQuit: () => void, extras: HTMLElement[] = [], onHowTo?: () => void, onSurrender?: () => void): void {
    const card = this.card('Pause', 'La partie est en pause.');
    const buttons = [this.btn('Reprendre', onResume)];
    if (onHowTo) buttons.push(this.btn('Comment jouer', onHowTo, 'btn-secondary btn-howto'));
    if (onSurrender) buttons.push(this.btn('Abandonner', () => this.confirmSurrender(onSurrender, () => this.pause(onResume, onQuit, extras, onHowTo, onSurrender)), 'btn-secondary btn-surrender'));
    buttons.push(this.btn('Quitter', onQuit, 'btn-danger'));
    card.append(this.row(buttons), ...extras);
    this.show(card);
  }

  /** Confirmation dans la page (pas de confirm()) avant d'abandonner la partie. */
  confirmSurrender(onYes: () => void, onNo: () => void): void {
    const card = this.card('Abandonner la partie ?', 'La partie compte comme une défaite, mais tu verras quand même ses statistiques.');
    card.classList.add('surrender');
    card.append(this.row([this.btn('Non, je continue', onNo), this.btn('Oui, j’abandonne', onYes, 'btn-danger btn-surrender-yes')]));
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
      /** Titre de défaite (par défaut « Défaite… » ; « Abandon » après un abandon). */
      loseTitle?: string;
      extras?: HTMLElement[];
      /** Couleurs des équipes d'une alliance victorieuse (victoire partagée). */
      alliance?: number[];
    },
  ): void {
    const alliance = opts.alliance && opts.alliance.length > 1 ? opts.alliance : null;
    const names = alliance ? listFr(alliance.map((c) => teamPlural(c))) : '';
    const winText = win && opts.winText ? opts.winText : win ? `La cour « ${mapName} » est à toi.${opts.nextAvailable ? ' Une nouvelle carte est débloquée.' : ' Tu as terminé toutes les cartes !'}` : opts.loseText ?? 'Tes élèves ont été mis KO et tes cases reprises.';
    const card = this.card(
      win ? (alliance ? 'Victoire de l’alliance !' : opts.winTitle ?? 'Victoire !') : opts.loseTitle ?? 'Défaite…',
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
  ['Déplacer et attaquer', 'Touche le sol : tes élèves y courent sans se battre (mode Fuir) ; touché hors de la cour, l’ordre va au bord le plus proche. Touche un ennemi pour l’attaquer. La barre au-dessus d’une bagarre montre qui est le plus fort ; en haut, touche une mini-barre pour aller voir une bagarre hors de l’écran.'],
  ['Cases et camps', 'Reste sur une case blanche pour la capturer : ♥ vie, ♠ dégâts, ♣ production, ♦ vitesse. Ton camp produit des élèves, 30 au plus.'],
  ['Effectifs', 'En haut, chaque puce d’équipe donne son nombre d’élèves ; la tienne affiche « élèves / maximum » (en jaune quand ton camp ne peut plus produire). Brouillard activé : un œil devant le nombre, seuls les ennemis que tu vois en ce moment sont comptés. Touche ta puce pour le détail : élèves, cases et camps de chaque équipe.'],
  ['Bons points ★', '+2 par ennemi mis KO, +10 par case prise, +25 par camp pris, +1 toutes les 10 s par case tenue.'],
  ['Améliorations', 'Sans sélection, touche ton camp (ou la pastille ★). « Toute l’équipe » : Production, Uniformes, Entraînement, classes, pour tous tes camps. « Ce camp » : Défense, pion, élèves produits, ralliement, renforts. ‹ › : camp suivant.'],
  ['Classes', 'Une fois débloquées pour l’équipe, chaque camp choisit Costaud (solide), Sprinteur (rapide, capture vite) ou Infirmier (soigne). Chaque élève spécial coûte des bons points.'],
  ['Pouvoirs', 'Boutons en bas : Sonnerie (fige les ennemis), Boules de neige (dégâts), Goûter (soins). Doigt posé sur un bouton : son aide. Glisse un bouton jusqu’à la carte et lâche pour le lancer (lâche sur le bouton pour annuler). Ou : touche le bouton, vise, puis touche la zone.'],
  ['Garnisons', 'Sélectionne des élèves puis touche « Garder » (à gauche) : s’ils sont sur une case, ils la gardent aussitôt, sinon touche la case voulue. Ils restent sur place, chassent les intrus du cercle pointillé sans les poursuivre loin et reprennent la case si elle tombe. Retranchés dans ce cercle, ils encaissent un quart de coups en moins (« Paré ! »). L’écusson de la case compte les gardes ; un nouvel ordre les libère.'],
  ['Conquête', 'Sélectionne des élèves puis touche « Conquérir » (le drapeau, à gauche) : ils forment une escouade qui prend toute seule la case libre (sans propriétaire) la plus proche, puis la suivante, et ainsi de suite ; prendre les cases et les camps des autres reste ton affaire. Un drapeau planté montre la case visée. L’escouade ne voit que ce que tu vois et renonce à une case trop bien défendue pour sa taille. Un groupe 1, 2 ou 3 en conquête porte un petit drapeau. Retouche « Conquérir », ou donne un autre ordre, pour reprendre la main.'],
  ['Défense', 'Amène des élèves près de tes cases, puis touche « Défendre » (le bouclier bleu, à côté de « Conquérir ») : ils forment une garnison mobile qui tient jusqu’à quatre de tes cases autour d’eux. Des tirets relient les cases du secteur à leur poste (le petit bouclier planté). Dès qu’un ennemi entre sur une de ces cases, ou qu’elle tombe, l’escouade y court (bouclier bleu « ! »), chasse les intrus, reprend la case, puis revient au poste. Elle ne poursuit personne hors du secteur et ne se jette pas sur une case trop défendue pour sa taille. Un groupe 1, 2 ou 3 en défense porte un petit bouclier bleu. Retouche « Défendre », ou donne un autre ordre, pour reprendre la main.'],
  ['Alertes', 'Quand une de tes cases est attaquée, tombe, ou que ton camp est en danger, un bandeau apparaît en haut avec un petit « ding-dong ». Touche-le pour y aller. Plusieurs attaques en même temps sont regroupées.'],
  ['Pion', 'Dans le panneau du camp : un surveillant à tes couleurs garde le camp et frappe les intrus. Il revient 60 s après un KO.'],
  ['Caméra', 'Glisse un doigt pour bouger la vue, pince pour zoomer, touche la mini-carte pour y aller.'],
  ['Ralliement', 'Chaque camp a son drapeau, où vont ses nouveaux élèves. Glisse depuis un camp jusqu’au point voulu, ou utilise « Ralliement » dans son panneau. Appui long sur le sol : camp le plus proche.'],
  ['Renforts', 'Dans le panneau d’un camp, « Auto » : ses nouveaux élèves partent d’eux-mêmes secourir ta case la plus menacée (à 16 cases au plus), en se battant en chemin ; un pointillé à chevrons montre où ils vont. Si rien n’est menacé, ils vont au drapeau de ralliement ; si le camp lui-même est attaqué, ils restent le défendre. « Partout » : tous tes camps.'],
  ['Les IA', 'Comme toi, les équipes de l’ordinateur ont une attention limitée : un nombre d’ordres par minute selon la difficulté, et une ou deux cases secourues à la fois (le menu donne les chiffres). Attaque sur deux fronts pour les déborder.'],
  ['Alliances', 'Touche la puce d’une équipe, en haut, pour lui proposer une alliance… ou la rompre. Une rupture est annoncée 30\u00a0s à l’avance\u00a0: le compte à rebours s’affiche sous la puce, et un rappel tombe 10\u00a0s avant.'],
  ['Mode Équipes', 'En escarmouche, « Équipes fixes » forme des équipes dès le départ (2 contre 2, 3 contre 3, 2 contre 2 contre 2…). Tes coéquipiers IA ont les camps voisins du tien ; l’alliance tient toute la partie et vous gagnez ensemble.'],
  ['Abandonner', 'Dans la pause, « Abandonner » termine la partie en défaite, mais affiche quand même ses statistiques.'],
];
