// Compteur d'images (v5.24, saison 2, « Performances a ») : mesure, image par image, l'intervalle
// entre deux images (ce que voit l'œil) et le travail du jeu (simulation + dessin, ce que le jeu
// coûte au téléphone). Sans navigateur, testé ; branché sur la boucle de `Game`, affiché par le
// réglage « Compteur d'images » de la pause et lu par `scripts/dev/perf-iphone.ts`.

/** Une image à 60 images par seconde dure 16,7 ms. */
export const FRAME_BUDGET_MS = 1000 / 60;
/**
 * Travail visé par image sur iPhone : la moitié du budget. Le reste revient au navigateur
 * (composition, interface HTML, son) et laisse de la marge aux pointes.
 */
export const WORK_TARGET_MS = FRAME_BUDGET_MS / 2;

export interface FrameSample {
  /** Temps écoulé depuis l'image précédente (ms). */
  interval: number;
  /** Simulation : pas du monde, IA, diplomatie, événements (ms). */
  sim: number;
  /** Dessin : cour, effets, mini-carte (ms). */
  render: number;
}

export interface FrameStats {
  frames: number;
  /** Images par seconde réellement affichées. */
  fps: number;
  /** Intervalle médian (ms) : 16,7 sur un écran 60 Hz, 8,3 sur un écran 120 Hz. */
  medianInterval: number;
  /** Images sautées : un intervalle de 2,4 fois le médian compte pour une ou deux images perdues. */
  dropped: number;
  /** Part des images sautées sur toutes les images qui auraient dû s'afficher (0 à 1). */
  droppedShare: number;
  /** Travail moyen par image (ms), simulation et dessin. */
  work: number;
  sim: number;
  render: number;
  /** 95e centile et pire travail par image (ms). */
  workP95: number;
  workWorst: number;
}

export type FrameVerdict = 'fluide' | 'juste' | 'saccade';

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

/** Fenêtre glissante des dernières images (4 s à 60 i/s par défaut). */
export class FrameMeter {
  private buf: FrameSample[] = [];
  private at = 0;

  constructor(readonly capacity = 240) {}

  record(s: FrameSample): void {
    if (!(s.interval > 0) || !Number.isFinite(s.interval)) return;
    // Un onglet revenu de veille : intervalle de plusieurs secondes, sans rapport avec la fluidité.
    if (s.interval > 1000) return;
    if (this.buf.length < this.capacity) this.buf.push(s);
    else this.buf[this.at] = s;
    this.at = (this.at + 1) % this.capacity;
  }

  reset(): void {
    this.buf = [];
    this.at = 0;
  }

  get size(): number {
    return this.buf.length;
  }

  stats(): FrameStats {
    const n = this.buf.length;
    if (!n) return { frames: 0, fps: 0, medianInterval: 0, dropped: 0, droppedShare: 0, work: 0, sim: 0, render: 0, workP95: 0, workWorst: 0 };
    let total = 0;
    let sim = 0;
    let render = 0;
    const intervals: number[] = [];
    const works: number[] = [];
    for (const s of this.buf) {
      total += s.interval;
      sim += s.sim;
      render += s.render;
      intervals.push(s.interval);
      works.push(s.sim + s.render);
    }
    intervals.sort((a, b) => a - b);
    works.sort((a, b) => a - b);
    const median = quantile(intervals, 0.5);
    let dropped = 0;
    for (const i of intervals) dropped += Math.max(0, Math.round(i / median) - 1);
    return {
      frames: n,
      fps: 1000 / (total / n),
      medianInterval: median,
      dropped,
      droppedShare: dropped / (n + dropped),
      work: (sim + render) / n,
      sim: sim / n,
      render: render / n,
      workP95: quantile(works, 0.95),
      workWorst: works[n - 1],
    };
  }
}

/**
 * Verdict affiché par le compteur : « fluide » si presque aucune image ne saute et que le jeu
 * tient dans la moitié du budget ; « saccadé » si plus d'une image sur dix saute ou si le jeu
 * dépasse à lui seul le budget d'une image ; « juste » entre les deux.
 */
export function frameVerdict(s: FrameStats): FrameVerdict {
  if (s.frames === 0) return 'fluide';
  if (s.droppedShare > 0.1 || s.workP95 > FRAME_BUDGET_MS) return 'saccade';
  if (s.droppedShare > 0.02 || s.workP95 > WORK_TARGET_MS) return 'juste';
  return 'fluide';
}

const nf1 = (x: number) => x.toFixed(1).replace('.', ',');

/** Texte du compteur, par exemple « 60 i/s · 3,2 ms ». */
export function meterLabel(s: FrameStats): string {
  if (s.frames === 0) return '… i/s';
  return `${Math.round(s.fps)} i/s · ${nf1(s.work)} ms`;
}

/** Couleur de la pastille du compteur selon le verdict. */
export const VERDICT_COLORS: Record<FrameVerdict, string> = {
  fluide: '#5fd068',
  juste: '#ffb23e',
  saccade: '#ff5a4e',
};
