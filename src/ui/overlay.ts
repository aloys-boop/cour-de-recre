import { teamMarkEl } from './team-mark';
import { TEAM_COLORS, TEAM_NAMES, TEAM_PLURALS } from '../config';
import { teamPlural } from '../core/diplomacy';
import { durationLine, type EndStats } from '../core/stats';
import { insecables } from '../core/tutorial';
import { bestIndex, countUp } from '../core/finale';
import { reducedMotion } from '../render/effects';

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

  /**
   * Écran « Comment jouer » : les règles en bref, consultable depuis le menu et la pause.
   * v5.15 : rangées en quatre chapitres ; une barre d'onglets collée en haut y saute
   * directement et suit le défilement.
   */
  howTo(onClose: () => void): void {
    const card = this.card('Comment jouer', '');
    card.classList.add('howto');
    card.querySelector('p')!.remove();
    const tabs = document.createElement('nav');
    tabs.className = 'howto-tabs';
    tabs.setAttribute('aria-label', 'Chapitres');
    const body = document.createElement('div');
    body.className = 'howto-body';
    const texts = new Map(HOW_TO);
    const heads: { tab: HTMLButtonElement; head: HTMLElement }[] = [];
    const select = (i: number) => heads.forEach((h, j) => h.tab.classList.toggle('on', i === j));
    for (const ch of HOW_TO_CHAPTERS) {
      const head = document.createElement('h2');
      head.className = 'howto-chapter';
      head.id = `howto-${ch.id}`;
      head.textContent = ch.title;
      body.append(head);
      for (const title of ch.sections) {
        const sec = document.createElement('section');
        if (title === TOOLS_TITLE) sec.className = 'howto-tools';
        const h = document.createElement('h3');
        h.textContent = title;
        const p = document.createElement('p');
        p.textContent = insecables(texts.get(title) ?? '');
        sec.append(h, p);
        body.append(sec);
      }
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'howto-tab';
      tab.dataset.chapter = ch.id;
      tab.textContent = ch.tab;
      const i = heads.length;
      tab.addEventListener('click', () => {
        select(i);
        // Défilement de la carte jusqu'au chapitre (sous la barre d'onglets collée).
        card.scrollTo?.({ top: Math.max(0, head.offsetTop - tabs.offsetHeight - 6), behavior: 'smooth' });
      });
      tabs.append(tab);
      heads.push({ tab, head });
    }
    select(0);
    card.addEventListener('scroll', () => {
      const y = card.scrollTop + tabs.offsetHeight + 12;
      let cur = 0;
      heads.forEach((h, j) => {
        if (h.head.offsetTop <= y) cur = j;
      });
      if (card.scrollTop + card.clientHeight >= card.scrollHeight - 4) cur = heads.length - 1;
      select(cur);
    });
    card.append(tabs, body, this.row([this.btn('Retour', onClose)]));
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
    // Meilleure équipe aux KO infligés et aux cases prises : étoile dorée (v5.21).
    const bestKo = bestIndex(stats.rows.map((r) => r.koDealt));
    const bestCap = bestIndex(stats.rows.map((r) => r.captured));
    const counters: HTMLElement[] = [];
    stats.rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.className = 'me';
      tr.style.setProperty('--i', String(i));
      const name = document.createElement('td');
      name.append(teamMarkEl(r.color, 13, false), document.createTextNode(`${TEAM_NAMES[r.color] ?? '?'}${r.isPlayer ? ' (toi)' : ''}`));
      tr.append(name);
      const values = [r.produced, r.koDealt, r.koTaken, r.captured];
      if (stats.supervisors) values.push(r.supKo ?? 0);
      values.forEach((v, j) => {
        const td = document.createElement('td');
        td.textContent = String(v);
        td.dataset.value = String(v);
        if ((j === 1 && i === bestKo) || (j === 3 && i === bestCap)) {
          td.classList.add('best');
          td.title = 'Meilleur score';
        }
        counters.push(td);
        tr.append(td);
      });
      table.append(tr);
    });
    const dur = document.createElement('div');
    dur.className = 'end-duration';
    dur.textContent = durationLine(stats);
    wrap.append(table, dur);
    if (stats.finalBlow) {
      const blow = document.createElement('div');
      blow.className = 'end-blow';
      blow.textContent = stats.finalBlow;
      wrap.append(blow);
    }
    animateCounters(counters);
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

/**
 * Les nombres du tableau de fin montent de 0 à leur valeur (v5.21), ligne après ligne.
 * Le texte final est posé tout de suite : sans animation (ou sans navigateur), il reste juste.
 */
function animateCounters(cells: HTMLElement[]): void {
  if (typeof requestAnimationFrame !== 'function' || reducedMotion() || !cells.length) return;
  const start = performance.now();
  const rowDelay = 0.12;
  const tick = (now: number) => {
    const t = (now - start) / 1000;
    let running = false;
    for (const td of cells) {
      if (!td.isConnected && t > 0.05) continue;
      const v = Number(td.dataset.value ?? 0);
      const row = Number((td.parentElement as HTMLElement | null)?.style.getPropertyValue('--i') || 0);
      const local = t - 0.25 - row * rowDelay;
      const shown = local <= 0 ? 0 : countUp(v, local);
      td.textContent = String(shown);
      if (shown !== v) running = true;
    }
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** « les Verts, les Jaunes et les Roses ». */
function listFr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Rubriques de l'écran « Comment jouer » (textes courts), dans l'ordre des chapitres. */
export const HOW_TO: ReadonlyArray<[string, string]> = [
  ['Le but', 'Prends les cases et les camps des autres équipes. Tu gagnes quand tu es le dernier à avoir des élèves ou un camp, ou quand tu tiens tous les camps. À la fin, la cour passe au ralenti sur le coup décisif (touche l’écran pour passer), puis l’écran de fin compte les scores : une étoile dorée marque les meilleurs KO et les meilleures prises.'],
  ['Sélectionner', 'Touche un élève : lui et ses voisins sont choisis. Appui long puis glisse : rectangle de sélection. Double-tap : tous tes élèves à l’écran.'],
  ['Déplacer et attaquer', 'Touche le sol : tes élèves y courent sans se battre (mode Fuir) ; touché hors de la cour, l’ordre va au bord le plus proche. Touche un ennemi pour l’attaquer. La barre au-dessus d’une bagarre montre qui est le plus fort ; en haut, touche une mini-barre pour aller voir une bagarre hors de l’écran. Sous ton doigt, une onde dit l’ordre compris\u00a0: blanche pour un déplacement, orange pour une charge, rouge à quatre crans pour une attaque, à ta couleur pour une case ou une sélection.'],
  ['Bagarres', 'Un élève touché clignote en blanc et recule ; mis KO, il voit trente-six chandelles (étoiles qui tournent) avant de quitter la cour. Quand une grosse mêlée éclate à l’écran, la cour crie « Mêlée\u00a0! » et la caméra tremble d’autant plus fort que les KO s’enchaînent. La musique suit la cour : feutrée au calme, elle ajoute charleston, batterie puis arpèges quand ça cogne à l’écran ou qu’une alerte tombe. Dans la pause, « Sensations » coupe le tremblement ou la musique.'],
  ['Cases et camps', 'Reste sur une case blanche pour la capturer : ♥ vie, ♠ dégâts, ♣ production, ♦ vitesse. Ton camp produit des élèves, 30 au plus.'],
  ['Caméra', 'Glisse un doigt pour bouger la vue, pince pour zoomer, touche la mini-carte pour y aller.'],
  ['Effectifs', 'En haut, chaque puce d’équipe donne son nombre d’élèves ; la tienne affiche « élèves / maximum » (en jaune quand ton camp ne peut plus produire). Brouillard activé : un œil devant le nombre, seuls les ennemis que tu vois en ce moment sont comptés. Touche ta puce pour le détail : élèves, cases et camps de chaque équipe.'],
  ['Lisibilité', 'Chaque équipe a sa forme en plus de sa couleur\u00a0: Noirs rond, Verts triangle, Jaunes carré, Violets étoile, Rouges croix, Bleus hexagone, Oranges lune, Roses éclair. Les puces du haut la montrent toujours. Une case bonus prise se teinte légèrement de la couleur de son équipe. «\u00a0Motifs d\u2019équipe\u00a0» (bouton de l\u2019accueil, ou rubrique «\u00a0Lisibilité\u00a0» de la pause) affiche aussi les formes dans la cour\u00a0: grand emblème peint sur chaque camp et sur la mini-carte, petit emblème sur les cases prises, au début des jauges de capture et au bout de la barre de vie, et un liseré de couleur aux pieds de chaque élève pour démêler les mêlées. Pratique si deux couleurs se confondent pour toi. Dans la pause, «\u00a0Performances\u00a0» affiche un compteur d\u2019images sous le bouton de pause\u00a0: pastille verte quand tout est fluide, orange quand c\u2019est juste, rouge quand ça saccade.'],
  ['Bons points ★', '+2 par ennemi mis KO, +10 par case prise, +25 par camp pris, +1 toutes les 10 s par case tenue.'],
  ['Améliorations', 'Sans sélection, touche ton camp (ou la pastille ★). « Toute l’équipe » : Production, Uniformes, Entraînement, classes, pour tous tes camps. « Ce camp » : Défense, pion, élèves produits, ralliement, renforts. ‹ › : camp suivant.'],
  ['Classes', 'Une fois débloquées pour l’équipe, chaque camp choisit Costaud (solide), Sprinteur (rapide, capture vite) ou Infirmier (soigne). Chaque élève spécial coûte des bons points.'],
  ['Pouvoirs', 'Boutons en bas : Sonnerie (fige les ennemis), Boules de neige (dégâts), Goûter (soins). Doigt posé sur un bouton : son aide. Glisse un bouton jusqu’à la carte et lâche pour le lancer (lâche sur le bouton pour annuler). Ou : touche le bouton, vise, puis touche la zone.'],
  ['Pion', 'Dans le panneau du camp : un surveillant à tes couleurs garde le camp et frappe les intrus. Il revient 60 s après un KO.'],
  ['Ralliement', 'Chaque camp a son drapeau, où vont ses nouveaux élèves. Glisse depuis un camp jusqu’au point voulu, ou utilise « Ralliement » dans son panneau. Appui long sur le sol : camp le plus proche.'],
  ['Quel outil pour quoi ?', 'Une case à tenir : « Garder ». Les cases d’un coin de la cour : « Défendre ». Les cases libres à ramasser : « Conquérir ». Un groupe à protéger : « Suivre ». Des camps qui envoient seuls leurs élèves au front : renforts « Auto ». Les alertes te disent où regarder ; le sablier (Facile et Normal) fige la cour pour réfléchir. Tu donnes l’intention, tes élèves font le reste : garde tes doigts pour les grandes décisions.'],
  ['Garnisons', 'Sélectionne des élèves puis touche « Garder » (à gauche) : s’ils sont sur une case, ils la gardent aussitôt, sinon touche la case voulue. Ils restent sur place, chassent les intrus du cercle pointillé sans les poursuivre loin et reprennent la case si elle tombe. Retranchés dans ce cercle, ils encaissent un quart de coups en moins (« Paré ! »). L’écusson de la case compte les gardes ; un nouvel ordre les libère.'],
  ['Défense', 'Amène des élèves près de tes cases, puis touche « Défendre » (le bouclier bleu, à côté de « Conquérir ») : ils forment une garnison mobile qui tient jusqu’à quatre de tes cases autour d’eux. Des tirets relient les cases du secteur à leur poste (le petit bouclier planté). Dès qu’un ennemi entre sur une de ces cases, ou qu’elle tombe, l’escouade y court (bouclier bleu « ! »), chasse les intrus, reprend la case, puis revient au poste. Elle ne poursuit personne hors du secteur et ne se jette pas sur une case trop défendue pour sa taille. Un groupe 1, 2 ou 3 en défense porte un petit bouclier bleu. Retouche « Défendre », ou donne un autre ordre, pour reprendre la main.'],
  ['Conquête', 'Sélectionne des élèves puis touche « Conquérir » (le drapeau, à gauche) : ils forment une escouade qui prend toute seule la case libre (sans propriétaire) la plus proche, puis la suivante, et ainsi de suite ; prendre les cases et les camps des autres reste ton affaire. Un drapeau planté montre la case visée. L’escouade ne voit que ce que tu vois et renonce à une case trop bien défendue pour sa taille. Un groupe 1, 2 ou 3 en conquête porte un petit drapeau. Retouche « Conquérir », ou donne un autre ordre, pour reprendre la main.'],
  ['Escorte', 'Sélectionne des élèves, touche « Suivre » (le rond vert à double chevron, à droite de « Garder »), puis touche le groupe qu’ils doivent escorter : un de tes élèves (avec ses voisins, ou toute son escouade s’il est en conquête ou en défense), ou un bouton 1, 2, 3. L’escorte colle à ce groupe partout où il va, se jette sur les ennemis qui l’approchent, ne les poursuit pas loin, et l’aide à prendre les cases où il s’arrête. Un écusson vert flotte au-dessus du groupe escorté ; un groupe 1, 2 ou 3 en escorte porte un petit écusson vert. Quand il n’y a plus personne à suivre, l’escorte attend tes ordres. Retouche « Suivre », ou donne un autre ordre, pour reprendre la main.'],
  ['Renforts', 'Dans le panneau d’un camp, « Auto » : ses nouveaux élèves partent d’eux-mêmes secourir ta case la plus menacée (à 16 cases au plus), en se battant en chemin ; un pointillé à chevrons montre où ils vont. Si rien n’est menacé, ils vont au drapeau de ralliement ; si le camp lui-même est attaqué, ils restent le défendre. « Partout » : tous tes camps.'],
  ['Alertes', 'Quand une de tes cases est attaquée, tombe, ou que ton camp est en danger, un bandeau apparaît en haut avec un petit « ding-dong ». Touche-le pour y aller. Plusieurs attaques en même temps sont regroupées.'],
  ['Rythme', 'En Facile et Normal, le sablier en haut à droite déclenche la pause tactique : la cour se fige (liseré bleu), mais tu peux sélectionner, donner tes ordres, acheter et poser tes consignes ; touche ▶ ou le bandeau « Reprendre » pour relancer. Dans la pause, « Rythme » règle la vitesse (Normale ou Lente ×0,75) et peut masquer le sablier. En Difficile et Expert, la cour tourne toujours à pleine vitesse.'],
  ['Les IA', 'Comme toi, les équipes de l’ordinateur ont une attention limitée : un nombre d’ordres par minute selon la difficulté, et une ou deux cases secourues à la fois (le menu donne les chiffres). Attaque sur deux fronts pour les déborder.'],
  ['Alliances', 'Touche la puce d’une équipe, en haut, pour lui proposer une alliance… ou la rompre. Une rupture est annoncée 30\u00a0s à l’avance\u00a0: le compte à rebours s’affiche sous la puce, et un rappel tombe 10\u00a0s avant.'],
  ['Mode Équipes', 'En escarmouche, « Équipes fixes » forme des équipes dès le départ (2 contre 2, 3 contre 3, 2 contre 2 contre 2…). Tes coéquipiers IA ont les camps voisins du tien ; l’alliance tient toute la partie et vous gagnez ensemble. Si tu es KO alors qu’un coéquipier tient encore, tu deviens spectateur : « Regarder » suit tes coéquipiers, « ×2 » accélère, « Terminer » quitte. S’ils gagnent, la victoire est aussi la tienne.'],
  ['Abandonner', 'Dans la pause, « Abandonner » termine la partie en défaite, mais affiche quand même ses statistiques.'],
];

/** Titre de la rubrique de synthèse des outils (mise en valeur dans l'écran). */
export const TOOLS_TITLE = 'Quel outil pour quoi ?';

/** Chapitres de « Comment jouer » (v5.15) : titre, onglet court et rubriques. */
export const HOW_TO_CHAPTERS: ReadonlyArray<{ id: string; title: string; tab: string; sections: readonly string[] }> = [
  { id: 'bases', title: 'Les bases', tab: 'Bases', sections: ['Le but', 'Sélectionner', 'Déplacer et attaquer', 'Bagarres', 'Cases et camps', 'Caméra', 'Effectifs', 'Lisibilité'] },
  { id: 'progresser', title: 'Progresser', tab: 'Progresser', sections: ['Bons points ★', 'Améliorations', 'Classes', 'Pouvoirs', 'Pion', 'Ralliement'] },
  { id: 'outils', title: 'Moins de micro : tes outils', tab: 'Tes outils', sections: ['Quel outil pour quoi ?', 'Garnisons', 'Défense', 'Conquête', 'Escorte', 'Renforts', 'Alertes', 'Rythme'] },
  { id: 'autres', title: 'Les autres équipes', tab: 'Adversaires', sections: ['Les IA', 'Alliances', 'Mode Équipes', 'Abandonner'] },
];
