import { DIFFICULTIES, STAT_POINTS_MAX, SUIT_BONUS, TEAM_COLORS, TEAM_NAMES, TEAM_PROFILES } from '../config';
import { LEVELS } from '../core/maps';
import { decodeMapCode, describeSpec, normalizeCode, type MapCode } from '../core/mapcode';
import { DEFAULT_RULES, type GameRules } from '../core/rules';
import { DEFAULT_SKIRMISH, type SkirmishSettings } from '../core/skirmish';
import type { Progress } from '../core/save';
import type { Difficulty, TeamId } from '../core/types';
import { medalDots } from './share';
import { TUTORIAL_STEPS } from '../core/tutorial';
import { rulesPanel, skirmishPanel } from './skirmish';

export interface MenuState {
  team: TeamId;
  difficulty: Difficulty;
  mapIndex: number;
  /** Campagne (les 5 niveaux) ou escarmouche (réglages libres). */
  mode: 'campagne' | 'escarmouche';
  skirmish: SkirmishSettings;
  /** Options et mode de l'escarmouche. */
  rules: GameRules;
  /** Code de carte saisi : il prime sur le mode et la carte choisis. */
  code?: MapCode;
  /** Campagne : le tutoriel est choisi (en tête de la liste des cartes). */
  tutorial?: boolean;
}

export interface MenuHooks {
  onPlay(state: MenuState): void;
  onToggleSound(): boolean; // retourne le nouvel état « coupé »
  onToggleMusic?(): boolean; // retourne le nouvel état « musique coupée »
  onInstallHelp(): void;
  /** Écran « Comment jouer ». */
  onHowTo?(): void;
}

const DIFFS = DIFFICULTIES;

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
      mapIndex: Math.min(progress.unlocked - 1, LEVELS.length - 1),
      mode: 'campagne',
      skirmish: { ...DEFAULT_SKIRMISH },
      rules: { ...DEFAULT_RULES },
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

    // Équipe : chaque uniforme a ses forces et ses faiblesses.
    const teamSec = el('div', 'menu-section');
    teamSec.append(el('h2', '', 'Ton équipe'));
    const teamRow = el('div', 'team-row');
    const teamBtns: HTMLButtonElement[] = [];
    const profileBox = el('div', 'team-profile');
    const renderProfile = (i: number) => {
      const p = TEAM_PROFILES[i];
      profileBox.innerHTML =
        `<div class="team-blurb">${p.blurb}</div>` +
        statRow('Vie', p.points.hp) +
        statRow('Dégâts', p.points.dmg) +
        statRow('Production', p.points.prod) +
        statRow('Vitesse', p.points.speed);
    };
    TEAM_NAMES.forEach((name, i) => {
      const b = document.createElement('button');
      b.className = 'team-btn' + (this.state.team === i ? ' active' : '');
      b.textContent = name;
      b.style.background = TEAM_COLORS[i].ui;
      b.style.color = TEAM_COLORS[i].text;
      b.addEventListener('click', () => {
        this.state.team = i as TeamId;
        teamBtns.forEach((x, j) => x.classList.toggle('active', j === i));
        renderProfile(i);
      });
      teamBtns.push(b);
      teamRow.append(b);
    });
    renderProfile(this.state.team);
    teamSec.append(teamRow, profileBox);

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

    // Mode : campagne (cartes) ou escarmouche (réglages libres).
    const mapSec = el('div', 'menu-section');
    const tabs = el('div', 'mode-tabs');
    const campPane = el('div');
    const skirPane = el('div');
    const modes = [
      { id: 'campagne' as const, label: 'Campagne', pane: campPane },
      { id: 'escarmouche' as const, label: 'Escarmouche', pane: skirPane },
    ];
    const tabBtns = modes.map((m) => {
      const b = document.createElement('button');
      b.className = 'mode-btn';
      b.textContent = m.label;
      b.addEventListener('click', () => setMode(m.id));
      tabs.append(b);
      return b;
    });
    const setMode = (mode: MenuState['mode']) => {
      this.state.mode = mode;
      modes.forEach((m, i) => {
        tabBtns[i].classList.toggle('active', m.id === mode);
        m.pane.classList.toggle('hidden', m.id !== mode);
      });
    };
    campPane.append(el('h2', '', 'Carte (disposition tirée au sort à chaque partie)'));
    skirPane.append(skirmishPanel(this.state.skirmish), rulesPanel(this.state.rules));
    const list = el('div', 'map-list');
    const mapBtns: HTMLButtonElement[] = [];
    // Tutoriel, en tête de campagne : toujours disponible, rejouable.
    const tuto = document.createElement('button');
    tuto.className = 'tuto-btn' + (this.state.tutorial ? ' active' : '');
    const tl = document.createElement('span');
    tl.textContent = 'Tutoriel';
    const tr = document.createElement('small');
    tr.textContent = this.progress.tutorialDone ? 'Terminé ✓ · rejouable' : `${TUTORIAL_STEPS.length} étapes guidées · 11×11`;
    tuto.append(tl, tr);
    tuto.addEventListener('click', () => {
      this.state.tutorial = true;
      tuto.classList.add('active');
      mapBtns.forEach((x) => x.classList.remove('active'));
    });
    campPane.append(tuto);
    LEVELS.forEach((m, i) => {
      const locked = i >= this.progress.unlocked;
      const b = document.createElement('button');
      b.className = 'map-btn' + (this.state.mapIndex === i && !this.state.tutorial ? ' active' : '') + (locked ? ' locked' : '');
      const wins = this.progress.wins[m.id] ?? 0;
      const left = document.createElement('span');
      left.textContent = `${i + 1}. ${m.name}`;
      const meta = el('span', 'map-meta');
      const right = document.createElement('small');
      right.textContent = locked
        ? 'Verrouillée'
        : `${m.w}×${m.h} · ${m.teams} équipes · ${m.tiles} cases${wins ? ` · ${wins} victoire${wins > 1 ? 's' : ''}` : ''}`;
      meta.append(right);
      if (!locked) meta.append(medalDots(this.progress.medals?.[m.id]));
      b.append(left, meta);
      b.disabled = locked;
      b.addEventListener('click', () => {
        this.state.mapIndex = i;
        this.state.tutorial = false;
        tuto.classList.remove('active');
        mapBtns.forEach((x, j) => x.classList.toggle('active', j === i));
      });
      mapBtns.push(b);
      list.append(b);
    });
    campPane.append(list);
    mapSec.append(tabs, campPane, skirPane);
    setMode(this.state.mode);
    inner.append(mapSec);

    // Actions.
    const actions = el('div', 'menu-actions');
    const play = document.createElement('button');
    play.className = 'btn btn-play';
    play.textContent = 'Jouer';
    // Code de carte facultatif : rejouer exactement une disposition partagée.
    const codeWrap = el('label', 'code-field');
    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.className = 'code-input';
    codeInput.placeholder = 'Code de carte';
    codeInput.maxLength = 14;
    codeInput.autocomplete = 'off';
    codeInput.spellcheck = false;
    codeInput.setAttribute('autocapitalize', 'characters');
    codeInput.setAttribute('autocorrect', 'off');
    codeInput.setAttribute('enterkeyhint', 'go');
    codeInput.setAttribute('aria-label', 'Code de carte (facultatif)');
    const codeHint = el('div', 'code-hint');
    // Renvoie le code valide, null si le champ est vide, ou un message d'erreur.
    const readCode = (): MapCode | null | string => {
      const raw = normalizeCode(codeInput.value);
      if (!raw) return null;
      const code = decodeMapCode(raw);
      if (!code) return raw.length !== 6 && raw.length !== 10 ? 'Le code compte 6 caractères (10 pour une escarmouche personnalisée).' : 'Code de carte inconnu.';
      if (code.spec.kind === 'campagne' && code.spec.level >= this.progress.unlocked)
        return `Ce code correspond au niveau ${code.spec.level + 1}, pas encore débloqué.`;
      return code;
    };
    const showCode = () => {
      const c = readCode();
      codeHint.classList.toggle('error', typeof c === 'string' && normalizeCode(codeInput.value).length >= 6);
      codeHint.textContent = c === null ? 'Facultatif : saisis un code pour rejouer une carte partagée.' : typeof c === 'string' ? c : `Carte partagée : ${describeSpec(c.spec)}`;
    };
    codeInput.addEventListener('input', showCode);
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') play.click();
    });
    codeWrap.append(codeInput);
    showCode();
    play.addEventListener('click', () => {
      const c = readCode();
      if (typeof c === 'string') {
        codeHint.classList.add('error');
        codeHint.textContent = c;
        return;
      }
      codeInput.blur();
      this.hooks.onPlay({ ...this.state, skirmish: { ...this.state.skirmish }, rules: { ...this.state.rules }, code: c ?? undefined });
    });
    const sound = document.createElement('button');
    sound.className = 'btn btn-secondary';
    const setSoundLabel = (muted: boolean) => (sound.textContent = muted ? 'Son : coupé' : 'Son : actif');
    setSoundLabel(this.progress.muted);
    sound.addEventListener('click', () => setSoundLabel(this.hooks.onToggleSound()));
    actions.append(codeWrap, play, sound, codeHint);
    if (this.hooks.onHowTo) {
      const how = document.createElement('button');
      how.className = 'btn btn-secondary btn-howto';
      how.textContent = 'Comment jouer';
      how.addEventListener('click', () => this.hooks.onHowTo!());
      actions.append(how);
    }
    if (this.hooks.onToggleMusic) {
      const music = document.createElement('button');
      music.className = 'btn btn-secondary btn-music';
      const setMusicLabel = (off: boolean) => (music.textContent = off ? 'Musique : coupée' : 'Musique : active');
      setMusicLabel(!!this.progress.musicMuted);
      music.addEventListener('click', () => setMusicLabel(this.hooks.onToggleMusic!()));
      actions.append(music);
    }
    inner.append(actions);

    const foot = el('div', 'menu-foot');
    const bonusText = (['heart', 'spade', 'club', 'diamond'] as const)
      .map((s) => `${SUIT_GLYPHS[s]} ${SUIT_BONUS[s].label.toLowerCase()}`)
      .join(' · ');
    foot.append(
      el('div', '', `Prends les cases entre les camps : ${bonusText}. Capture le camp adverse pour couper sa production.`),
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

const SUIT_GLYPHS = { heart: '\u2665', spade: '\u2660', club: '\u2663', diamond: '\u2666' } as const;

/** Ligne de statistique : libellé + cinq cases, remplies selon le multiplicateur (1 = trois cases). */
/** Jauge d'une caractéristique : exactement les points de l'équipe (1 à 5). */
function statRow(label: string, points: number): string {
  const n = points;
  let boxes = '';
  for (let i = 0; i < STAT_POINTS_MAX; i++) boxes += `<i class="${i < n ? 'on' : ''}"></i>`;
  return `<div class="stat"><span>${label}</span><span class="boxes" data-points="${n}">${boxes}</span></div>`;
}

function el(tag: string, cls = '', text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
