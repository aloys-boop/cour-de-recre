/**
 * Petits sons synthétisés avec la Web Audio API (aucun fichier audio).
 * Le contexte est créé/relancé à la première interaction (exigence d'iOS).
 */
export type SfxName =
  | 'punch'
  | 'hit'
  | 'ko'
  | 'capture'
  | 'select'
  | 'order'
  | 'victory'
  | 'defeat'
  | 'spawn'
  | 'coin'
  | 'upgrade'
  | 'deny'
  | 'bell'
  | 'snow'
  | 'snack';

/** Timbre des coups par couleur d'uniforme : hauteur et coupure du filtre. */
const TEAM_PITCH = [1, 1.14, 1.3, 0.84];
const TEAM_CUTOFF = [1, 1.25, 1.5, 0.75];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private lastPlay = new Map<SfxName, number>();

  /** Contexte audio (null tant qu'il n'a pas été déverrouillé ou s'il est indisponible). */
  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  /** Sortie générale (coupée par le bouton son) : la musique s'y branche. */
  get output(): GainNode | null {
    return this.master;
  }

  /** À appeler depuis un gestionnaire d'événement utilisateur. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  /** `color` : couleur d'uniforme de l'équipe concernée (timbre des coups et du KO). */
  play(name: SfxName, color = 0): void {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    // Anti-saturation : on limite la cadence par type de son.
    const now = performance.now();
    const minGap = name === 'punch' || name === 'hit' ? 45 : 80;
    const last = this.lastPlay.get(name) ?? -1e9;
    if (now - last < minGap) return;
    this.lastPlay.set(name, now);
    const t = this.ctx.currentTime;
    const pm = TEAM_PITCH[color] ?? 1;
    const cm = TEAM_CUTOFF[color] ?? 1;
    switch (name) {
      case 'punch':
        this.noise(t, 0.06, 900 * cm, 0.5);
        this.tone(t, 180 * pm, 60 * pm, 0.07, 'square', 0.25);
        break;
      case 'hit':
        this.noise(t, 0.09, 1600 * cm, 0.6);
        this.tone(t, 140 * pm, 50 * pm, 0.09, 'triangle', 0.5);
        break;
      case 'ko':
        // Choc sourd, éclat bruité puis « tuiii » descendant : bien distinct d'un simple coup.
        this.tone(t, 110, 38, 0.22, 'sine', 0.9);
        this.noise(t, 0.14, 2600 * cm, 0.75);
        this.tone(t + 0.03, 640 * pm, 150 * pm, 0.42, 'square', 0.26);
        this.tone(t + 0.07, 480 * pm, 110 * pm, 0.4, 'triangle', 0.34);
        break;
      case 'capture':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.07, f, f, 0.12, 'square', 0.3));
        break;
      case 'select':
        this.tone(t, 880, 1320, 0.05, 'square', 0.18);
        break;
      case 'order':
        this.tone(t, 660, 520, 0.06, 'triangle', 0.25);
        break;
      case 'spawn':
        this.tone(t, 500, 900, 0.08, 'sine', 0.15);
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(t + i * 0.12, f, f, 0.2, 'square', 0.35));
        break;
      case 'coin':
        // Petit « ding » de bons points.
        this.tone(t, 1320, 1320, 0.05, 'square', 0.14);
        this.tone(t + 0.05, 1760, 1760, 0.09, 'square', 0.14);
        break;
      case 'upgrade':
        [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.05, f, f * 1.02, 0.1, 'triangle', 0.32));
        break;
      case 'deny':
        this.tone(t, 220, 180, 0.12, 'square', 0.18);
        break;
      case 'bell':
        // Sonnerie d'école : trille aigu qui vibre.
        for (let i = 0; i < 10; i++) this.tone(t + i * 0.06, i % 2 ? 1180 : 1240, 1200, 0.07, 'square', 0.16);
        break;
      case 'snow':
        this.noise(t, 0.25, 900, 0.5);
        this.tone(t, 300, 90, 0.22, 'sine', 0.5);
        break;
      case 'snack':
        [659, 784, 988].forEach((f, i) => this.tone(t + i * 0.09, f, f, 0.14, 'sine', 0.3));
        break;
      case 'defeat':
        [440, 415, 392, 330].forEach((f, i) => this.tone(t + i * 0.22, f, f * 0.9, 0.3, 'sawtooth', 0.3));
        break;
    }
  }

  private tone(t: number, f0: number, f1: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, cutoff: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    if (!this.noiseBuf) {
      // Bruit blanc calculé une seule fois, puis réutilisé (aucune allocation par coup).
      const n = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.3, dur + 0.01);
  }
}
