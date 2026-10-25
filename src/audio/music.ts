import type { Sfx } from './sfx';

/**
 * Petite boucle chiptune synthétisée (Web Audio, aucun fichier) : quatre mesures
 * do, la mineur, fa, sol, mélodie en carré et basse en triangle, à volume bas.
 * Branchée sur la sortie des effets : le bouton son la coupe aussi.
 * Tolérante à l'absence d'AudioContext (rien ne se passe).
 */

const BPM = 126;
const STEP = 60 / BPM / 2; // croches
const VOLUME = 0.16;

// Mélodie (notes MIDI, 0 = silence), 8 croches par mesure.
const LEAD = [
  72, 0, 76, 0, 79, 0, 76, 0,
  76, 0, 72, 0, 69, 0, 72, 0,
  69, 0, 72, 0, 77, 0, 76, 74,
  74, 0, 71, 0, 67, 0, 0, 0,
];
const ROOTS = [48, 45, 41, 43];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Music {
  private enabled = true;
  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private bus: GainNode | null = null;
  private busCtx: AudioContext | null = null;
  private nextTime = 0;
  private step = 0;

  constructor(private sfx: Sfx) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  /** À appeler après une interaction de l'utilisateur (le contexte audio doit exister). */
  start(): void {
    this.started = true;
    this.refresh();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.refresh();
  }

  /** À rappeler quand le son général change (coupé : on n'ordonnance plus rien). */
  refresh(): void {
    const ctx = this.sfx.audioContext;
    const want = this.started && this.enabled && !this.sfx.muted && !!ctx && !!this.sfx.output;
    if (want && !this.timer) {
      this.ensureBus();
      this.nextTime = 0;
      this.timer = setInterval(() => this.schedule(), 60);
      this.schedule();
    } else if (!want && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      if (this.bus && ctx) {
        // Coupure franche des notes déjà programmées.
        const t = ctx.currentTime;
        this.bus.gain.cancelScheduledValues(t);
        this.bus.gain.setValueAtTime(0, t);
        this.bus.disconnect();
        this.bus = null;
      }
    }
  }

  private ensureBus(): void {
    const ctx = this.sfx.audioContext;
    const out = this.sfx.output;
    if (!ctx || !out) return;
    if (this.bus && this.busCtx === ctx) return;
    const g = ctx.createGain();
    g.gain.value = VOLUME;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    g.connect(f).connect(out);
    this.bus = g;
    this.busCtx = ctx;
  }

  private schedule(): void {
    const ctx = this.sfx.audioContext;
    if (!ctx || !this.bus || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Retour d'arrière-plan : on reprend proprement au lieu de rattraper le retard.
    if (this.nextTime < now) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.25) {
      this.note(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % LEAD.length;
    }
  }

  private note(step: number, t: number): void {
    const lead = LEAD[step];
    if (lead) this.voice(midi(lead), t, STEP * 0.9, 'square', 0.22);
    const root = ROOTS[Math.floor(step / 8)];
    this.voice(midi(step % 2 === 0 ? root : root + 12), t, STEP * 0.8, 'triangle', 0.5);
  }

  private voice(freq: number, t: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.sfx.audioContext;
    if (!ctx || !this.bus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
