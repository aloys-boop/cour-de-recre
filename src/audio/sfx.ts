/**
 * Petits sons synthétisés avec la Web Audio API (aucun fichier audio).
 * Le contexte est créé/relancé à la première interaction (exigence d'iOS).
 */
export type SfxName = 'punch' | 'hit' | 'ko' | 'capture' | 'select' | 'order' | 'victory' | 'defeat' | 'spawn';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private lastPlay = new Map<SfxName, number>();

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

  play(name: SfxName): void {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    // Anti-saturation : on limite la cadence par type de son.
    const now = performance.now();
    const minGap = name === 'punch' || name === 'hit' ? 45 : 80;
    const last = this.lastPlay.get(name) ?? -1e9;
    if (now - last < minGap) return;
    this.lastPlay.set(name, now);
    const t = this.ctx.currentTime;
    switch (name) {
      case 'punch':
        this.noise(t, 0.06, 900, 0.5);
        this.tone(t, 180, 60, 0.07, 'square', 0.25);
        break;
      case 'hit':
        this.noise(t, 0.09, 1600, 0.6);
        this.tone(t, 140, 50, 0.09, 'triangle', 0.5);
        break;
      case 'ko':
        this.tone(t, 420, 110, 0.35, 'sawtooth', 0.35);
        this.tone(t + 0.05, 300, 80, 0.3, 'square', 0.2);
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
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
}
