import { TEAM_COLORS, TEAM_NAMES } from '../config';
import { MAPS } from '../core/maps';
import type { Progress } from '../core/save';
import type { Difficulty, TeamId } from '../core/types';

export interface MenuState {
  team: TeamId;
  difficulty: Difficulty;
  mapIndex: number;
}

export interface MenuHooks {
  onPlay(state: MenuState): void;
  onToggleSound(): boolean; // retourne le nouvel état « coupé »
  onInstallHelp(): void;
}

const DIFFS: Array<{ id: Difficulty; label: string }> = [
  { id: 'facile', label: 'Facile' },
  { id: 'normal', label: 'Normal' },
  { id: 'difficile', label: 'Difficile' },
];

/** Écran d'accueil : choix de l'équipe, de la difficulté et de la carte. */
export class Menu {
  state: MenuState;

  constructor(
    private root: HTMLElement,
    private progress: Progress,
    private hooks: MenuHooks,
  ) {
    this.state = {
      team: progress.lastTeam,
      difficulty: progress.lastDifficulty,
      mapIndex: Math.min(progress.unlocked - 1, MAPS.length - 1),
    };
  }

  setProgress(p: Progress): void {
    this.progress = p;
    this.state.mapIndex = Math.min(this.state.mapIndex, p.unlocked - 1);
  }

  show(): void {
    this.render();
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  private render(): void {
    const r = this.root;
    r.innerHTML = '';
    const inner = el('div', 'menu-inner');

    const title = el('div', 'menu-title');
    title.append(el('h1', '', 'Cour de Récré'), el('p', '', 'Stratégie en temps réel. Capture toutes les cases, élimine les autres équipes.'));
    inner.append(title);

    // Équipe.
    const teamSec = el('div', 'menu-section');
    teamSec.append(el('h2', '', 'Ton équipe'));
    const teamRow = el('div', 'team-row');
    const teamBtns: HTMLButtonElement[] = [];
    TEAM_NAMES.forEach((name, i) => {
      const b = document.createElement('button');
      b.className = 'team-btn' + (this.state.team === i ? ' active' : '');
      b.textContent = name;
      b.style.background = TEAM_COLORS[i].ui;
      b.style.color = TEAM_COLORS[i].text;
      b.addEventListener('click', () => {
        this.state.team = i as TeamId;
        teamBtns.forEach((x, j) => x.classList.toggle('active', j === i));
      });
      teamBtns.push(b);
      teamRow.append(b);
    });
    teamSec.append(teamRow);

    // Difficulté.
    const diffSec = el('div', 'menu-section');
    diffSec.append(el('h2', '', 'Difficulté des IA'));
    const diffRow = el('div', 'diff-row');
    const diffBtns: HTMLButtonElement[] = [];
    DIFFS.forEach((d) => {
      const b = document.createElement('button');
      b.className = 'diff-btn' + (this.state.difficulty === d.id ? ' active' : '');
      b.textContent = d.label;
      b.addEventListener('click', () => {
        this.state.difficulty = d.id;
        diffBtns.forEach((x, j) => x.classList.toggle('active', DIFFS[j].id === d.id));
      });
      diffBtns.push(b);
      diffRow.append(b);
    });
    diffSec.append(diffRow);

    const left = el('div');
    left.style.display = 'grid';
    left.style.gap = '10px';
    left.append(teamSec, diffSec);
    inner.append(left);

    // Cartes.
    const mapSec = el('div', 'menu-section');
    mapSec.append(el('h2', '', 'Carte'));
    const list = el('div', 'map-list');
    const mapBtns: HTMLButtonElement[] = [];
    MAPS.forEach((m, i) => {
      const locked = i >= this.progress.unlocked;
      const b = document.createElement('button');
      b.className = 'map-btn' + (this.state.mapIndex === i ? ' active' : '') + (locked ? ' locked' : '');
      const wins = this.progress.wins[m.id] ?? 0;
      const left = document.createElement('span');
      left.textContent = `${i + 1}. ${m.name}`;
      const right = document.createElement('small');
      right.textContent = locked
        ? 'Verrouillée'
        : `${m.w}×${m.h} · ${m.teams} équipes · ${m.tiles.length} cases${wins ? ` · ${wins} victoire${wins > 1 ? 's' : ''}` : ''}`;
      b.append(left, right);
      b.disabled = locked;
      b.addEventListener('click', () => {
        this.state.mapIndex = i;
        mapBtns.forEach((x, j) => x.classList.toggle('active', j === i));
      });
      mapBtns.push(b);
      list.append(b);
    });
    mapSec.append(list);
    inner.append(mapSec);

    // Actions.
    const actions = el('div', 'menu-actions');
    const play = document.createElement('button');
    play.className = 'btn btn-play';
    play.textContent = 'Jouer';
    play.addEventListener('click', () => this.hooks.onPlay({ ...this.state }));
    const sound = document.createElement('button');
    sound.className = 'btn btn-secondary';
    const setSoundLabel = (muted: boolean) => (sound.textContent = muted ? 'Son : coupé' : 'Son : actif');
    setSoundLabel(this.progress.muted);
    sound.addEventListener('click', () => setSoundLabel(this.hooks.onToggleSound()));
    actions.append(play, sound);
    inner.append(actions);

    const foot = el('div', 'menu-foot');
    foot.append(
      document.createTextNode('Tap : sélectionner · appui long + glisser : rectangle · deux doigts : zoom et caméra. '),
    );
    const install = document.createElement('button');
    install.textContent = 'Installer sur iPhone';
    install.addEventListener('click', () => this.hooks.onInstallHelp());
    foot.append(install);
    inner.append(foot);

    r.append(inner);
  }
}

function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
