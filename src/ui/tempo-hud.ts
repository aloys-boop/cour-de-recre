import './tempo.css';
import type { GameSpeed } from '../core/tempo';

export interface TempoHudHooks {
  /** Bouton (ou bandeau) touché : bascule la pause tactique, renvoie le nouvel état. */
  onToggle(): boolean;
}

/**
 * Rythme réglable (v5.14) : bouton de pause tactique en haut à droite, bandeau « Pause
 * tactique » et liseré bleu glacé autour de la cour figée.
 */
export class TempoHud {
  readonly button: HTMLButtonElement;
  readonly badge: HTMLButtonElement;
  private active = false;

  constructor(
    private root: HTMLElement,
    private hooks: TempoHudHooks,
  ) {
    const host = root.querySelector('.hud-top-right') ?? root;
    this.button = document.createElement('button');
    this.button.id = 'btn-tactical';
    this.button.className = 'icon-btn tactical-btn hidden';
    this.button.addEventListener('click', () => this.set(this.hooks.onToggle()));
    host.insertBefore(this.button, host.querySelector('#btn-sound'));
    this.badge = document.createElement('button');
    this.badge.id = 'tactical-badge';
    this.badge.className = 'tactical-badge hidden';
    this.badge.innerHTML = `${hourglassIcon('#0d2a40')}<span class="tb-text"><b>Pause tactique</b> · donne tes ordres</span><span class="tb-go">${playIcon('#0d2a40')}Reprendre</span>`;
    this.badge.setAttribute('aria-label', 'Reprendre la partie');
    this.badge.addEventListener('click', () => this.set(this.hooks.onToggle()));
    root.appendChild(this.badge);
    this.set(false);
  }

  /** Bouton visible (Facile ou Normal, et option « bouton affiché »). */
  setAvailable(on: boolean): void {
    this.button.classList.toggle('hidden', !on);
    if (!on && this.active) this.set(false);
  }

  get available(): boolean {
    return !this.button.classList.contains('hidden');
  }

  /** État affiché : cour figée ou non. */
  set(active: boolean): void {
    this.active = active;
    this.button.classList.toggle('on', active);
    this.button.innerHTML = active ? playIcon('#0d2a40') : hourglassIcon('#fff');
    this.button.setAttribute('aria-label', active ? 'Reprendre la partie' : 'Pause tactique');
    this.button.setAttribute('aria-pressed', String(active));
    this.badge.classList.toggle('hidden', !active);
    this.root.classList.toggle('tactical', active);
  }

  get isActive(): boolean {
    return this.active;
  }
}

export interface TempoSettings {
  allowed: boolean;
  speed: GameSpeed;
  tacticalButton: boolean;
}

/**
 * Bloc « Rythme » du menu pause : vitesse (normale, lente ×0,75) et bouton de pause tactique
 * (affiché ou masqué). En Difficile et Expert, une simple ligne explique qu'ils sont réservés
 * à Facile et Normal.
 */
export function tempoBlock(s: TempoSettings, onSpeed: (v: GameSpeed) => void, onButton: (v: boolean) => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'tempo-block';
  const title = document.createElement('div');
  title.className = 'tempo-title';
  title.textContent = 'Rythme';
  box.append(title);
  if (!s.allowed) {
    const note = document.createElement('p');
    note.className = 'tempo-note';
    note.textContent = 'Vitesse lente et pause tactique : en Facile et Normal seulement.';
    box.append(note);
    return box;
  }
  box.append(
    segmented('Vitesse', 'tempo-speed', [['normale', 'Normale'], ['lente', 'Lente ×0,75']], s.speed, (v) => onSpeed(v as GameSpeed)),
    segmented('Pause tactique', 'tempo-button', [['on', 'Bouton affiché'], ['off', 'Masqué']], s.tacticalButton ? 'on' : 'off', (v) => onButton(v === 'on')),
  );
  return box;
}

/**
 * Bloc « Sensations » du menu pause (v5.17) : tremblement de la caméra sur les KO et les camps
 * pris, activé par défaut. Disponible dans toutes les difficultés et dans le tutoriel.
 */
export function shakeBlock(on: boolean, onPick: (v: boolean) => void, music?: { on: boolean; onPick: (v: boolean) => void }): HTMLElement {
  const box = document.createElement('div');
  box.className = 'tempo-block sensations-block';
  const title = document.createElement('div');
  title.className = 'tempo-title';
  title.textContent = 'Sensations';
  box.append(title, segmented('Tremblement', 'shake-toggle', [['on', 'Activé'], ['off', 'Coupé']], on ? 'on' : 'off', (v) => onPick(v === 'on')));
  // Musique (v5.18) : la même que le bouton du menu principal, sans quitter la partie.
  if (music) box.append(segmented('Musique', 'music-toggle', [['on', 'Active'], ['off', 'Coupée']], music.on ? 'on' : 'off', (v) => music.onPick(v === 'on')));
  return box;
}

function segmented(label: string, cls: string, options: Array<[string, string]>, value: string, onPick: (v: string) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = `tempo-row ${cls}`;
  const l = document.createElement('span');
  l.className = 'tempo-label';
  l.textContent = label;
  const seg = document.createElement('div');
  seg.className = 'tempo-seg';
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', label);
  const buttons = options.map(([v, text]) => {
    const b = document.createElement('button');
    b.className = 'tempo-opt';
    b.dataset.value = v;
    b.textContent = text;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      for (const o of buttons) {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-checked', String(o === b));
      }
      onPick(v);
    });
    return b;
  });
  for (const b of buttons) {
    b.classList.toggle('on', b.dataset.value === value);
    b.setAttribute('aria-checked', String(b.dataset.value === value));
  }
  seg.append(...buttons);
  row.append(l, seg);
  return row;
}

function hourglassIcon(color: string): string {
  return (
    `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">` +
    `<path d="M5 2.5h10M5 17.5h10" stroke="${color}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M6.3 3v2.6c0 1.6 1.3 2.8 3.7 4.4 2.4-1.6 3.7-2.8 3.7-4.4V3M6.3 17v-2.6c0-1.6 1.3-2.8 3.7-4.4 2.4 1.6 3.7 2.8 3.7 4.4V17" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round"/>` +
    `<path d="M8 15.8h4l-2-2.2z" fill="${color}"/></svg>`
  );
}

function playIcon(color: string): string {
  return `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3l10 6-10 6z" fill="${color}" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}

/**
 * Bloc « Lisibilité » du menu pause (v5.19) : motifs d'équipe, un emblème par équipe (rond,
 * triangle, carré…) sur les camps, les cases, les jauges et au bout de la barre de vie des élèves,
 * pour jouer sans se fier aux seules couleurs. Masqués par défaut.
 */
export function readabilityBlock(on: boolean, onPick: (v: boolean) => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'tempo-block readability-block';
  const title = document.createElement('div');
  title.className = 'tempo-title';
  title.textContent = 'Lisibilité';
  box.append(title, segmented('Motifs d\u2019équipe', 'patterns-toggle', [['on', 'Affichés'], ['off', 'Masqués']], on ? 'on' : 'off', (v) => onPick(v === 'on')));
  return box;
}

/**
 * Bloc « Performances » du menu pause (v5.24) : compteur d'images en haut de l'écran
 * (images par seconde et travail du jeu par image, pastille verte, orange ou rouge).
 * v5.26 : « Allègement auto » (garde-fou de fluidité, activé par défaut) et une ligne qui dit ce
 * qui est allégé en ce moment.
 */
export function performanceBlock(
  on: boolean,
  onPick: (v: boolean) => void,
  auto?: { on: boolean; state: string; onPick: (v: boolean) => void },
): HTMLElement {
  const box = document.createElement('div');
  box.className = 'tempo-block performance-block';
  const title = document.createElement('div');
  title.className = 'tempo-title';
  title.textContent = 'Performances';
  box.append(title, segmented('Compteur d\u2019images', 'meter-toggle', [['on', 'Affiché'], ['off', 'Masqué']], on ? 'on' : 'off', (v) => onPick(v === 'on')));
  if (auto) {
    const note = document.createElement('div');
    note.className = 'tempo-note quality-state';
    const say = (enabled: boolean) => {
      note.textContent = enabled ? `En ce moment\u00a0: ${auto.state}.` : 'Tous les effets, même si l\u2019image saccade.';
    };
    say(auto.on);
    box.append(
      segmented('Allègement auto', 'quality-toggle', [['on', 'Activé'], ['off', 'Désactivé']], auto.on ? 'on' : 'off', (v) => {
        say(v === 'on');
        auto.onPick(v === 'on');
      }),
      note,
    );
  }
  return box;
}
