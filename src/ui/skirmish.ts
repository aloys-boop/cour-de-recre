import { GAME_MODES, RULE_TOGGLES, type GameRules } from '../core/rules';
import {
  COUR_SIZES,
  SKIRMISH_TEAMS_MAX,
  SKIRMISH_TEAMS_MIN,
  SKIRMISH_TILES_MAX,
  SKIRMISH_TILES_MIN,
  clampSkirmish,
  evenSuits,
  minTilesFor,
  skirmishLevel,
  SUIT_ORDER,
  suitTotal,
  type SkirmishSettings,
} from '../core/skirmish';
import { SUIT_BONUS } from '../config';
import type { Suit } from '../core/types';

const SUIT_GLYPH: Record<Suit, string> = { heart: '♥', spade: '♠', club: '♣', diamond: '♦' };
/** Libellés courts (la grille tient à côté des boutons sur iPhone). */
const SUIT_SHORT: Record<Suit, string> = { heart: 'Vie', spade: 'Dégâts', club: 'Prod.', diamond: 'Vitesse' };

/**
 * Réglages de l'escarmouche dans le menu : nombre d'équipes, taille de la cour,
 * nombre de cases bonus (de 4 à 30), et leurs symboles : à parts égales, ou personnalisés
 * symbole par symbole. `settings` est modifié sur place.
 */
export function skirmishPanel(settings: SkirmishSettings): HTMLElement {
  const box = document.createElement('div');
  box.className = 'skirmish';
  const summary = document.createElement('div');
  summary.className = 'skirmish-summary';
  const refresh = () => {
    Object.assign(settings, clampSkirmish(settings));
    const l = skirmishLevel(settings);
    summary.textContent = `Cour de ${l.w}×${l.h}, jusqu’à ${l.unitCap} élèves par équipe. Les victoires ne comptent pas pour la campagne.`;
  };

  // Nombre d'équipes.
  const teams: Array<{ v: number; label: string }> = [];
  for (let n = SKIRMISH_TEAMS_MIN; n <= SKIRMISH_TEAMS_MAX; n++) teams.push({ v: n, label: `${n}` });
  box.append(
    optionRow('Équipes', teams, () => settings.teams, (v) => {
      settings.teams = v;
      refresh();
    }),
  );

  // Taille de la cour.
  box.append(
    optionRow(
      'Taille',
      COUR_SIZES.map((s, i) => ({ v: i, label: s.label })),
      () => settings.size,
      (v) => {
        settings.size = v;
        refresh();
      },
    ),
  );

  // Cases bonus : boutons − / + et curseur.
  const row = document.createElement('div');
  row.className = 'opt-line';
  const lab = document.createElement('span');
  lab.className = 'opt-label';
  lab.textContent = 'Cases bonus';
  const ctrl = document.createElement('div');
  ctrl.className = 'stepper';
  const minus = stepBtn('−', 'Moins de cases');
  const plus = stepBtn('+', 'Plus de cases');
  const value = document.createElement('output');
  value.className = 'stepper-value';
  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(SKIRMISH_TILES_MIN);
  range.max = String(SKIRMISH_TILES_MAX);
  range.step = '1';
  range.className = 'tiles-range';
  range.setAttribute('aria-label', 'Nombre de cases bonus');
  const setTiles = (n: number) => {
    const min = minTilesFor(settings.teams);
    settings.tiles = Math.max(min, Math.min(SKIRMISH_TILES_MAX, n));
    value.textContent = String(settings.tiles);
    range.value = String(settings.tiles);
    minus.disabled = settings.tiles <= min;
    plus.disabled = settings.tiles >= SKIRMISH_TILES_MAX;
    refresh();
  };
  minus.addEventListener('click', () => setTiles(settings.tiles - 1));
  plus.addEventListener('click', () => setTiles(settings.tiles + 1));
  range.addEventListener('input', () => setTiles(Number(range.value)));
  ctrl.append(minus, value, plus);
  row.append(lab, ctrl);

  // Symboles : à parts égales ou personnalisés (nombre de cases de chaque symbole).
  const custom = document.createElement('div');
  custom.className = 'suit-grid';
  const suitRows = SUIT_ORDER.map((s) => {
    const line = document.createElement('div');
    line.className = 'suit-line';
    line.dataset.suit = s;
    const name = document.createElement('span');
    name.className = 'suit-name';
    name.innerHTML = `<b class="suit-glyph">${SUIT_GLYPH[s]}</b> ${SUIT_SHORT[s]}`;
    name.title = SUIT_BONUS[s].label;
    const c = document.createElement('div');
    c.className = 'stepper';
    const m = stepBtn('−', `Moins de cases ${SUIT_GLYPH[s]}`);
    const p = stepBtn('+', `Plus de cases ${SUIT_GLYPH[s]}`);
    const v = document.createElement('output');
    v.className = 'stepper-value';
    m.addEventListener('click', () => changeSuit(s, -1));
    p.addEventListener('click', () => changeSuit(s, +1));
    c.append(m, v, p);
    line.append(name, c);
    custom.append(line);
    return { s, m, p, v };
  });
  const customNote = document.createElement('div');
  customNote.className = 'skirmish-summary suit-note';
  const syncCustom = () => {
    const on = !!settings.suits;
    custom.classList.toggle('hidden', !on);
    customNote.classList.toggle('hidden', !on);
    row.classList.toggle('hidden', on);
    range.classList.toggle('hidden', on);
    if (!settings.suits) return;
    const total = suitTotal(settings.suits);
    for (const r of suitRows) {
      r.v.textContent = String(settings.suits[r.s]);
      r.m.disabled = settings.suits[r.s] <= 0 || total <= SKIRMISH_TILES_MIN;
      r.p.disabled = total >= SKIRMISH_TILES_MAX;
    }
    customNote.textContent = `Total : ${total} case${total > 1 ? 's' : ''} bonus (de ${SKIRMISH_TILES_MIN} à ${SKIRMISH_TILES_MAX}).`;
  };
  const changeSuit = (s: Suit, d: number) => {
    if (!settings.suits) return;
    const next = { ...settings.suits, [s]: settings.suits[s] + d };
    const total = suitTotal(next);
    if (next[s] < 0 || total < SKIRMISH_TILES_MIN || total > SKIRMISH_TILES_MAX) return;
    settings.suits = next;
    settings.tiles = total;
    refresh();
    syncCustom();
  };
  const mode = optionRow(
    'Symboles',
    [
      { v: 0, label: 'Équilibrés' },
      { v: 1, label: 'Personnalisés' },
    ],
    () => (settings.suits ? 1 : 0),
    (v) => {
      if (v === 1 && !settings.suits) settings.suits = evenSuits(settings.tiles);
      if (v === 0 && settings.suits) {
        const total = suitTotal(settings.suits);
        delete settings.suits;
        setTiles(total);
      }
      refresh();
      syncCustom();
    },
  );
  mode.classList.add('suit-mode');
  box.append(row, range, mode, custom, customNote, summary);
  setTiles(settings.tiles);
  syncCustom();
  return box;
}

function optionRow(
  label: string,
  options: Array<{ v: number; label: string }>,
  get: () => number,
  set: (v: number) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'opt-line';
  const lab = document.createElement('span');
  lab.className = 'opt-label';
  lab.textContent = label;
  const group = document.createElement('div');
  group.className = 'opt-group';
  const btns: HTMLButtonElement[] = [];
  for (const o of options) {
    const b = document.createElement('button');
    b.className = 'opt-btn' + (get() === o.v ? ' active' : '');
    b.textContent = o.label;
    b.addEventListener('click', () => {
      set(o.v);
      btns.forEach((x, j) => x.classList.toggle('active', options[j].v === o.v));
    });
    btns.push(b);
    group.append(b);
  }
  row.append(lab, group);
  return row;
}

function stepBtn(text: string, aria: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'opt-btn step-btn';
  b.textContent = text;
  b.setAttribute('aria-label', aria);
  return b;
}

/**
 * Mode et options de l'escarmouche (toutes désactivées par défaut). `rules` est modifié sur place.
 * Les entrées viennent de GAME_MODES et RULE_TOGGLES (src/core/rules.ts).
 */
export function rulesPanel(rules: GameRules): HTMLElement {
  const box = document.createElement('div');
  box.className = 'skirmish rules-panel';
  if (GAME_MODES.length > 1) {
    const modes = GAME_MODES.map((m, i) => ({ v: i, label: m.label }));
    const desc = document.createElement('div');
    desc.className = 'skirmish-summary';
    const sync = () => (desc.textContent = GAME_MODES.find((m) => m.id === (rules.mode ?? 'classique'))?.description ?? '');
    box.append(
      optionRow('Mode', modes, () => Math.max(0, GAME_MODES.findIndex((m) => m.id === (rules.mode ?? 'classique'))), (v) => {
        rules.mode = GAME_MODES[v].id;
        sync();
      }),
      desc,
    );
    sync();
  }
  if (RULE_TOGGLES.length) {
    const title = document.createElement('div');
    title.className = 'opt-label rules-title';
    title.textContent = 'Options';
    box.append(title);
    for (const t of RULE_TOGGLES) {
      const b = document.createElement('button');
      b.className = 'opt-btn rule-toggle' + (rules[t.key] ? ' active' : '');
      b.setAttribute('aria-pressed', String(!!rules[t.key]));
      const name = document.createElement('strong');
      name.textContent = t.label;
      const d = document.createElement('small');
      d.textContent = t.description;
      b.append(name, d);
      b.addEventListener('click', () => {
        rules[t.key] = !rules[t.key];
        b.classList.toggle('active', !!rules[t.key]);
        b.setAttribute('aria-pressed', String(!!rules[t.key]));
      });
      box.append(b);
    }
  }
  return box;
}
