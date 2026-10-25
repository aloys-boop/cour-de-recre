import type { Sfx } from './sfx';

/**
 * Coup de sifflet de surveillant (option « Surveillants »), synthétisé avec la Web Audio API
 * comme les autres sons : un bref « tuit » puis un long « tuiiit » roulé (la bille du sifflet
 * module la hauteur), avec un souffle filtré. Branché sur la sortie générale de Sfx (bouton son).
 */
let lastPlay = -1e9;
const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>();

export function playWhistle(sfx: Sfx): void {
  const ctx = sfx.audioContext;
  const out = sfx.output;
  if (sfx.muted || !ctx || !out || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - lastPlay < 300) return;
  lastPlay = now;
  const t = ctx.currentTime;
  blast(ctx, out, t, 0.11, 0.2);
  blast(ctx, out, t + 0.17, 0.42, 0.24);
}

function blast(ctx: AudioContext, out: AudioNode, t: number, dur: number, gain: number): void {
  // Ton aigu roulé : un oscillateur basse fréquence fait trembler la hauteur.
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(2750, t);
  o.frequency.linearRampToValueAtTime(2950, t + 0.04);
  o.frequency.linearRampToValueAtTime(2850, t + dur);
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 34;
  const depth = ctx.createGain();
  depth.gain.value = 170;
  lfo.connect(depth).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.setValueAtTime(gain, t + dur - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.02);
  lfo.stop(t + dur + 0.02);

  // Souffle : bruit passe-bande autour de la hauteur du sifflet.
  let buf = noiseBufs.get(ctx);
  if (!buf) {
    const n = Math.floor(ctx.sampleRate * 0.5);
    buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ctx, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3000;
  f.Q.value = 4;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain * 0.5, t);
  ng.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(f).connect(ng).connect(out);
  src.start(t, 0, dur + 0.01);
}
