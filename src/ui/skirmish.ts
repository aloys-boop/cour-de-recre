import { GAME_MODES, RULE_TOGGLES, type GameRules } from '../core/rules';
import {
  COUR_SIZES,
  SKIRMISH_TEAMS_MAX,
  SKIRMISH_TEAMS_MIN,
  SKIRMISH_TILES_MAX,
  SKIRMISH_TILES_MIN,
  clampSkirmish,
  minTilesFor,
  skirmishLevel,
  type SkirmishSettings,
} from '../core/skirmish';

/**
 * Réglages de l'escarmouche dans le menu : nombre d'équipes, taille de la cour,
 * nombre de cases bonus. `settings` est modifié sur place.
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
      setTiles(settings.tiles); // à partir de 5 équipes : au moins 20 cases
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
  box.append(row, range, summary);
  setTiles(settings.tiles);
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
