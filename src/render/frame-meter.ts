// Pastille du compteur d'images (v5.24) : « 60 i/s · 3,2 ms », pastille colorée selon le verdict
// (vert fluide, orange juste, rouge saccadé). Dessinée en pixels d'écran, calée à droite sous le
// bouton de pause (jamais sur les puces d'équipe ni dans l'encoche), relue deux fois par seconde.
import { frameVerdict, meterLabel, VERDICT_COLORS, type FrameMeter, type FrameStats } from '../core/frame-meter';

let cached: { at: number; stats: FrameStats } | null = null;

/** Coin où caler la pastille : bord droit et bas du bouton de pause, en points d'écran. */
export interface MeterAnchor {
  right: number;
  top: number;
}

/**
 * `level` : cran du garde-fou de fluidité (v5.26) ; allégé, la pastille le dit (« allégé »,
 * « ×1,5 ») pour que le joueur qui regarde le compteur sache pourquoi les « Paf ! » ont disparu.
 */
export function drawFrameMeter(ctx: CanvasRenderingContext2D, dpr: number, width: number, meter: FrameMeter, anchor: MeterAnchor | null, level = 0): void {
  const now = performance.now();
  if (!cached || now - cached.at > 500 || now < cached.at) cached = { at: now, stats: meter.stats() };
  const s = cached.stats;
  const label = meterLabel(s) + (level >= 2 ? ' · ×1,5' : level === 1 ? ' · allégé' : '');
  const color = VERDICT_COLORS[frameVerdict(s)];
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  const tw = ctx.measureText(label).width;
  const h = 18;
  const w = tw + 26;
  const right = anchor ? anchor.right : width - 8;
  const x = Math.round(right - w);
  const y = Math.round(anchor ? anchor.top + 6 : 56);
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = '#10182a';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 10, y + h / 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f6fb';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 18, y + h / 2 + 0.5);
  ctx.restore();
}
