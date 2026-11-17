import type { Sfx } from './sfx';
import { brightness, midiToHz, stepSeconds, THEMES, themeEvents, themeVolume, type NoteEvent, type ThemeId } from '../core/music-score';

/**
 * Musique synthétisée (Web Audio, aucun fichier), v5.18 : un thème par moment du jeu
 * (menu, partie, victoire, défaite, voir `core/music-score.ts`), et un thème de partie qui
 * s'intensifie avec les bagarres (couches, filtre qui s'ouvre, volume).
 * Branchée sur la sortie des effets : le bouton son la coupe aussi.
 * Tolérante à l'absence d'AudioContext (rien ne se passe, mais le thème courant est suivi).
 */

const LOOKAHEAD = 0.25;
const FADE = 0.18;

export class Music {
  private enabled = true;
  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private busCtx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private nextTime = 0;
  private step = 0;
  private current: ThemeId = 'menu';
  private intensity = 0;
  /** Le jingle (victoire, défaite) est fini : silence jusqu'au prochain thème. */
  private done = false;

  constructor(private sfx: Sfx) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  /** Thème en cours (suivi même sans audio). */
  get theme(): ThemeId {
    return this.current;
  }

  get level(): number {
    return this.intensity;
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

  /** Change de thème (fondu court) ; un jingle repart du début même s'il vient d'être joué. */
  setTheme(theme: ThemeId): void {
    if (theme === this.current && THEMES[theme].loop) return;
    this.current = theme;
    this.step = 0;
    this.done = false;
    if (theme !== 'partie') this.intensity = 0;
    if (this.timer) {
      this.fadeOutBus();
      this.ensureBus();
      const ctx = this.sfx.audioContext;
      this.nextTime = ctx ? ctx.currentTime + 0.06 : 0;
    }
  }

  /** Intensité du thème de partie (0 calme, 1 mêlée), lissée par la partie. */
  setIntensity(x: number): void {
    this.intensity = x < 0 ? 0 : x > 1 ? 1 : x;
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
        this.filter = null;
      }
    }
  }

  private ensureBus(): void {
    const ctx = this.sfx.audioContext;
    const out = this.sfx.output;
    if (!ctx || !out) return;
    if (this.bus && this.busCtx === ctx) return;
    const g = ctx.createGain();
    g.gain.value = themeVolume(this.current, this.intensity);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = brightness(this.current, this.intensity);
    g.connect(f).connect(out);
    this.bus = g;
    this.filter = f;
    this.busCtx = ctx;
  }

  /** Fondu de sortie du bus courant (les notes déjà programmées s'éteignent en douceur). */
  private fadeOutBus(): void {
    const ctx = this.sfx.audioContext;
    const bus = this.bus;
    const filter = this.filter;
    this.bus = null;
    this.filter = null;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + FADE);
    setTimeout(() => (bus.disconnect(), filter?.disconnect()), (FADE + LOOKAHEAD + 0.2) * 1000);
  }

  private schedule(): void {
    const ctx = this.sfx.audioContext;
    if (!ctx || ctx.state !== 'running') return;
    this.ensureBus();
    if (!this.bus || !this.filter) return;
    const now = ctx.currentTime;
    // L'intensité ouvre le filtre et pousse un peu le volume, en douceur.
    this.filter.frequency.setTargetAtTime(brightness(this.current, this.intensity), now, 0.4);
    this.bus.gain.setTargetAtTime(themeVolume(this.current, this.intensity), now, 0.4);
    if (this.done) return;
    // Retour d'arrière-plan : on reprend proprement au lieu de rattraper le retard.
    if (this.nextTime < now) this.nextTime = now + 0.05;
    const def = THEMES[this.current];
    const step = stepSeconds(this.current);
    while (this.nextTime < now + LOOKAHEAD) {
      if (!def.loop && this.step >= def.length) {
        this.done = true;
        return;
      }
      for (const e of themeEvents(this.current, this.step, this.intensity)) this.play(e, this.nextTime, step);
      this.nextTime += step;
      this.step = def.loop ? (this.step + 1) % def.length : this.step + 1;
    }
  }

  private play(e: NoteEvent, t: number, step: number): void {
    const dur = e.dur * step;
    switch (e.voice) {
      case 'ton':
        this.tone(midiToHz(e.midi ?? 60), t, dur * 0.92, e.wave ?? 'square', e.gain);
        break;
      case 'grosse-caisse':
        this.kick(t, e.gain);
        break;
      case 'caisse-claire':
        this.noise(t, 0.12, 'bandpass', 2200, e.gain);
        this.tone(190, t, 0.07, 'triangle', e.gain * 0.5);
        break;
      case 'charleston':
        this.noise(t, 0.035, 'highpass', 7000, e.gain);
        break;
      case 'cymbale':
        this.noise(t, dur, 'highpass', 5000, e.gain);
        break;
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.sfx.audioContext;
    if (!ctx || !this.bus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.03, dur));
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private kick(t: number, gain: number): void {
    const ctx = this.sfx.audioContext;
    if (!ctx || !this.bus) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.18);
  }

  private noise(t: number, dur: number, type: BiquadFilterType, freq: number, gain: number): void {
    const ctx = this.sfx.audioContext;
    if (!ctx || !this.bus) return;
    if (!this.noiseBuf || this.noiseBuf.sampleRate !== ctx.sampleRate) {
      // Bruit blanc calculé une fois (2 s pour les cymbales), puis réutilisé.
      const n = Math.floor(ctx.sampleRate * 2);
      this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.02, dur));
    src.connect(f).connect(g).connect(this.bus);
    const len = Math.min(1.9, dur + 0.02);
    src.start(t, Math.random() * (1.95 - len), len);
  }
}
