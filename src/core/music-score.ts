/**
 * Partitions de la musique (v5.18), sans navigateur : thèmes, couches et humeur.
 *
 * La musique est synthétisée par Web Audio (`src/audio/music.ts`) à partir de ces partitions :
 * aucune donnée audio, aucun fichier. Quatre thèmes originaux :
 * - « Récré » (menu) : sautillant, en do majeur, clochettes et basse qui rebondit ;
 * - « Bagarre » (partie) : en la mineur, par couches qui s'ajoutent quand la cour s'échauffe
 *   (basse et accords au calme, puis charleston, mélodie pleine, batterie, arpèges de mêlée) ;
 * - « Victoire » : fanfare courte, roulement de caisse et cymbale ;
 * - « Défaite » : trois notes qui descendent, un peu de tendresse.
 *
 * L'intensité (0 à 1) vient de l'humeur de la partie (`MusicMood`) : chaleur des bagarres
 * visibles, alertes récentes, fin de partie serrée. Elle monte vite et retombe lentement,
 * pour que la musique ne fasse pas le yoyo au rythme de chaque coup.
 */

export type ThemeId = 'menu' | 'partie' | 'victoire' | 'defaite';

export type Layer = 'basse' | 'accords' | 'charleston' | 'melodie' | 'batterie' | 'arpege';

export type Voice = 'ton' | 'grosse-caisse' | 'caisse-claire' | 'charleston' | 'cymbale';

export interface NoteEvent {
  layer: Layer;
  voice: Voice;
  /** Note MIDI (voix « ton » seulement). */
  midi?: number;
  wave?: OscillatorType;
  /** Durée en pas (doubles croches). */
  dur: number;
  /** Volume relatif, déjà multiplié par le niveau de la couche. */
  gain: number;
}

export interface ThemeDef {
  id: ThemeId;
  /** Nom affichable du morceau. */
  title: string;
  bpm: number;
  /** Nombre de pas (doubles croches) avant de boucler ou de s'arrêter. */
  length: number;
  loop: boolean;
  /** Volume du thème (avant le volume général des effets). */
  volume: number;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  menu: { id: 'menu', title: 'Récré', bpm: 108, length: 64, loop: true, volume: 0.15 },
  partie: { id: 'partie', title: 'Bagarre', bpm: 132, length: 64, loop: true, volume: 0.15 },
  victoire: { id: 'victoire', title: 'Victoire', bpm: 140, length: 36, loop: false, volume: 0.2 },
  defaite: { id: 'defaite', title: 'Défaite', bpm: 92, length: 28, loop: false, volume: 0.17 },
};

/** Durée d'un pas (double croche), en secondes. */
export function stepSeconds(theme: ThemeId): number {
  return 60 / THEMES[theme].bpm / 4;
}

/** Durée totale d'un thème (une boucle, ou le jingle entier), en secondes. */
export function themeSeconds(theme: ThemeId): number {
  return THEMES[theme].length * stepSeconds(theme);
}

/**
 * Couches du thème de partie : seuil d'entrée sur l'intensité, plancher (niveau au calme) et
 * rampe. Basse et accords sont toujours là ; la mélodie murmure au calme et chante en bagarre.
 */
export const LAYERS: Record<Layer, { on: number; floor: number }> = {
  basse: { on: 0, floor: 1 },
  accords: { on: 0, floor: 1 },
  melodie: { on: 0.15, floor: 0.45 },
  charleston: { on: 0.2, floor: 0 },
  batterie: { on: 0.45, floor: 0 },
  arpege: { on: 0.72, floor: 0 },
};
const RAMP = 0.15;

/** Niveau (0 à 1) d'une couche pour une intensité donnée. Hors partie, tout joue à plein. */
export function layerLevel(theme: ThemeId, layer: Layer, intensity: number): number {
  if (theme !== 'partie') return 1;
  const spec = LAYERS[layer];
  const x = Math.max(0, Math.min(1, (clamp01(intensity) - spec.on) / RAMP));
  const s = x * x * (3 - 2 * x);
  return spec.floor + (1 - spec.floor) * s;
}

/** Ouverture du filtre de la musique : feutrée au calme, brillante en mêlée (Hz). */
export function brightness(theme: ThemeId, intensity: number): number {
  if (theme !== 'partie') return 3200;
  return 1300 + 2700 * clamp01(intensity);
}

/** Volume du thème de partie selon l'intensité (un peu plus fort quand ça cogne). */
export function themeVolume(theme: ThemeId, intensity: number): number {
  const v = THEMES[theme].volume;
  return theme === 'partie' ? v * (0.85 + 0.3 * clamp01(intensity)) : v;
}

// ---------------------------------------------------------------- partitions

const _ = 0;

/** « Récré » : do, la mineur, fa, sol. Clochettes une octave au-dessus. */
const MENU_ROOTS = [48, 45, 41, 43];
const MENU_LEAD = [
  84, _, _, _, 79, _, _, _, 81, _, 79, _, 76, _, _, _,
  81, _, _, _, 76, _, _, _, 72, _, 76, _, 79, _, _, _,
  77, _, _, _, 81, _, _, _, 84, _, 81, _, 77, _, _, _,
  79, _, _, _, 74, _, 76, _, 77, _, 79, _, _, _, _, _,
];

/** « Bagarre » : la mineur, fa, do, sol. */
const FIGHT_ROOTS = [45, 41, 48, 43];
const FIGHT_CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [55, 60, 64],
  [55, 59, 62],
];
const FIGHT_LEAD = [
  76, _, _, _, 72, _, 74, _, 76, _, 79, _, 76, _, 74, _,
  72, _, _, _, 69, _, 72, _, 77, _, 76, _, 74, _, 72, _,
  72, _, _, _, 76, _, 79, _, 84, _, 79, _, 76, _, 79, _,
  79, _, 77, _, 76, _, 74, _, 71, _, 74, _, _, _, _, _,
];
/** Accords en coups syncopés (pas de la mesure). */
const STABS = [0, 6, 8, 14];

/** Fanfare : arpège qui monte, note tenue, envolée finale sur l'accord de do. */
const WIN_LEAD: Array<[number, number, number]> = [
  // [pas, note, durée]
  [6, 72, 2],
  [8, 76, 2],
  [10, 79, 2],
  [12, 84, 6],
  [18, 81, 2],
  [20, 84, 2],
  [22, 88, 14],
];

/** Défaite : trois notes qui descendent, puis une dernière qui s'éteint. */
const LOSE_LEAD: Array<[number, number, number]> = [
  [0, 67, 4],
  [4, 66, 4],
  [8, 65, 4],
  [12, 64, 14],
];
const LOSE_BASS: Array<[number, number, number]> = [
  [0, 48, 12],
  [12, 36, 14],
];

/** Durée d'une note de mélodie : jusqu'à la suivante, au plus `cap` pas. */
function holdOf(lead: number[], i: number, cap: number): number {
  let d = 1;
  while (d < cap && lead[(i + d) % lead.length] === 0) d++;
  return d;
}

/** Événements à jouer au pas `step` d'un thème, couches déjà dosées par l'intensité. */
export function themeEvents(theme: ThemeId, step: number, intensity = 0): NoteEvent[] {
  const def = THEMES[theme];
  if (step < 0 || (!def.loop && step >= def.length)) return [];
  const s = def.loop ? step % def.length : step;
  const raw = theme === 'menu' ? menuStep(s) : theme === 'partie' ? fightStep(s, clamp01(intensity)) : theme === 'victoire' ? winStep(s) : loseStep(s);
  const out: NoteEvent[] = [];
  for (const e of raw) {
    const g = e.gain * layerLevel(theme, e.layer, intensity);
    if (g > 0.004) out.push({ ...e, gain: g });
  }
  return out;
}

function menuStep(s: number): NoteEvent[] {
  const bar = Math.floor(s / 16);
  const b = s % 16;
  const root = MENU_ROOTS[bar];
  const out: NoteEvent[] = [];
  // Basse qui rebondit : fondamentale sur les temps forts, quinte sur les autres.
  if (b % 4 === 0) out.push({ layer: 'basse', voice: 'ton', midi: b % 8 === 0 ? root : root + 7, wave: 'triangle', dur: 3, gain: 0.5 });
  const lead = MENU_LEAD[s];
  if (lead) out.push({ layer: 'melodie', voice: 'ton', midi: lead, wave: 'triangle', dur: holdOf(MENU_LEAD, s, 4), gain: 0.32 });
  // Écho des clochettes, une octave plus bas et plus doux, une croche plus tard.
  const echo = MENU_LEAD[(s - 2 + 64) % 64];
  if (echo && b % 2 === 0) out.push({ layer: 'accords', voice: 'ton', midi: echo - 12, wave: 'square', dur: 1, gain: 0.07 });
  // Petit charleston à contretemps.
  if (b % 4 === 2) out.push({ layer: 'charleston', voice: 'charleston', dur: 1, gain: 0.18 });
  return out;
}

function fightStep(s: number, intensity: number): NoteEvent[] {
  const bar = Math.floor(s / 16);
  const b = s % 16;
  const root = FIGHT_ROOTS[bar];
  const chord = FIGHT_CHORDS[bar];
  const out: NoteEvent[] = [];
  // Basse en croches, octave alternée ; en mêlée, une double croche de relance en fin de mesure.
  if (b % 2 === 0) out.push({ layer: 'basse', voice: 'ton', midi: b % 4 === 0 ? root : root + 12, wave: 'triangle', dur: 2, gain: 0.55 });
  else if (b === 15 && intensity >= LAYERS.arpege.on) out.push({ layer: 'basse', voice: 'ton', midi: root + 12, wave: 'triangle', dur: 1, gain: 0.45 });
  // Accords syncopés, courts.
  if (STABS.includes(b)) for (const n of chord) out.push({ layer: 'accords', voice: 'ton', midi: n, wave: 'square', dur: 1, gain: 0.07 });
  // Mélodie.
  const lead = FIGHT_LEAD[s];
  if (lead) out.push({ layer: 'melodie', voice: 'ton', midi: lead, wave: 'square', dur: holdOf(FIGHT_LEAD, s, 4), gain: 0.2 });
  // Charleston : croches, puis doubles croches accentuées en mêlée.
  if (b % 2 === 0) out.push({ layer: 'charleston', voice: 'charleston', dur: 1, gain: b % 4 === 2 ? 0.26 : 0.16 });
  else if (intensity >= LAYERS.arpege.on) out.push({ layer: 'charleston', voice: 'charleston', dur: 1, gain: 0.1 });
  // Batterie : grosse caisse sur 1 et 3 (et une relance), caisse claire sur 2 et 4.
  if (b === 0 || b === 8 || b === 10) out.push({ layer: 'batterie', voice: 'grosse-caisse', dur: 2, gain: 0.85 });
  if (b === 4 || b === 12) out.push({ layer: 'batterie', voice: 'caisse-claire', dur: 2, gain: 0.5 });
  // Arpèges de mêlée : l'accord une octave au-dessus, en doubles croches.
  out.push({ layer: 'arpege', voice: 'ton', midi: chord[[0, 1, 2, 1][b % 4]] + 12 + (b >= 8 && b % 4 === 2 ? 12 : 0), wave: 'square', dur: 1, gain: 0.09 });
  return out;
}

function winStep(s: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  // Roulement de caisse claire avant l'arpège.
  if (s < 6) out.push({ layer: 'batterie', voice: 'caisse-claire', dur: 1, gain: 0.2 + s * 0.06 });
  for (const [at, midi, dur] of WIN_LEAD) if (at === s) out.push({ layer: 'melodie', voice: 'ton', midi, wave: 'square', dur, gain: 0.26 });
  if (s === 12 || s === 22) {
    out.push({ layer: 'batterie', voice: 'grosse-caisse', dur: 2, gain: 0.9 });
    out.push({ layer: 'basse', voice: 'ton', midi: 48, wave: 'triangle', dur: s === 22 ? 14 : 6, gain: 0.55 });
    for (const n of [60, 64, 67]) out.push({ layer: 'accords', voice: 'ton', midi: n, wave: 'triangle', dur: s === 22 ? 14 : 6, gain: 0.16 });
  }
  if (s === 22) out.push({ layer: 'batterie', voice: 'cymbale', dur: 12, gain: 0.35 });
  return out;
}

function loseStep(s: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (const [at, midi, dur] of LOSE_LEAD) if (at === s) out.push({ layer: 'melodie', voice: 'ton', midi, wave: 'triangle', dur, gain: 0.34 });
  for (const [at, midi, dur] of LOSE_BASS) if (at === s) out.push({ layer: 'basse', voice: 'ton', midi, wave: 'triangle', dur, gain: 0.45 });
  if (s === 12) for (const n of [55, 60, 63]) out.push({ layer: 'accords', voice: 'ton', midi: n, wave: 'square', dur: 12, gain: 0.05 });
  return out;
}

/** Fréquence d'une note MIDI. */
export function midiToHz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// ---------------------------------------------------------------- humeur

export const MOOD = {
  /** Montée de l'intensité, par seconde (vite : la musique suit l'action). */
  attack: 1.4,
  /** Retombée, par seconde (lentement : environ 8 s pour revenir au calme). */
  release: 0.12,
  /** La chaleur des bagarres visibles, multipliée, fixe la cible. */
  heatWeight: 1.6,
  /** Une alerte (case attaquée, perdue, camp en danger) maintient ce plancher quelques secondes. */
  danger: 0.5,
  dangerHold: 8,
  /** Fin de partie serrée : plancher de tension. */
  finale: 0.3,
};

export interface MoodInput {
  /** Chaleur des bagarres visibles (0 à 1, `BrawlHeat`). */
  heat: number;
  /** Fin de partie serrée (voir `isFinale`). */
  finale: boolean;
  /** Cour au calme forcé : pause, pause tactique, partie finie. */
  calm: boolean;
}

/** Humeur de la partie : l'intensité de la musique, lissée. */
export class MusicMood {
  level = 0;
  private dangerLeft = 0;

  /** Une alerte vient de tomber. */
  danger(): void {
    this.dangerLeft = MOOD.dangerHold;
  }

  target(input: MoodInput): number {
    if (input.calm) return 0;
    return Math.max(clamp01(input.heat * MOOD.heatWeight), this.dangerLeft > 0 ? MOOD.danger : 0, input.finale ? MOOD.finale : 0);
  }

  update(dt: number, input: MoodInput): number {
    const t = this.target(input);
    if (!input.calm) this.dangerLeft = Math.max(0, this.dangerLeft - dt);
    if (t > this.level) this.level = Math.min(t, this.level + MOOD.attack * dt);
    else this.level = Math.max(t, this.level - MOOD.release * dt);
    return this.level;
  }
}

/**
 * Fin de partie serrée : il ne reste que deux équipes en vie sur une carte qui en comptait
 * plus, ou une équipe encore en vie n'a plus aucun camp (son dernier carré).
 */
export function isFinale(stats: ReadonlyArray<{ alive: boolean; camps: number }>): boolean {
  const alive = stats.filter((s) => s.alive);
  if (alive.length < 2) return false;
  if (stats.length >= 3 && alive.length === 2) return true;
  return alive.some((s) => s.camps === 0);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
