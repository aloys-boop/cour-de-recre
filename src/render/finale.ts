import { finaleBars, finaleStamp } from '../core/finale';

/**
 * Mise en scène de la fin de partie (v5.21) : bandes de cinéma, vignette sombre
 * et tampon « Victoire ! » ou « Défaite… » au centre, par-dessus la cour au ralenti.
 * Dessiné en pixels CSS, sans tremblement.
 */
export function drawFinale(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  w: number,
  h: number,
  t: number,
  title: string,
  win: boolean,
  teamUi: string,
): void {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Vignette : les bords s'assombrissent, le coup décisif reste au centre.
  const k = Math.min(1, t / 0.4);
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(10,12,24,0)');
  g.addColorStop(1, `rgba(10,12,24,${(win ? 0.45 : 0.6) * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Bandes de cinéma.
  const bar = Math.round(h * finaleBars(t));
  if (bar > 0) {
    ctx.fillStyle = '#0b0d16';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
    ctx.fillStyle = teamUi;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, bar - 2, w, 2);
    ctx.fillRect(0, h - bar, w, 2);
    ctx.globalAlpha = 1;
  }
  // Tampon.
  const s = finaleStamp(t);
  if (s.alpha > 0) {
    const size = Math.round(Math.min(64, Math.max(34, h * 0.15)));
    ctx.translate(w / 2, h * 0.27);
    ctx.rotate(win ? -0.06 : 0.04);
    ctx.scale(s.scale, s.scale);
    ctx.globalAlpha = s.alpha;
    ctx.font = `900 ${size}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.round(size * 0.22);
    ctx.strokeStyle = '#1a1424';
    ctx.strokeText(title, 0, 0);
    if (win) {
      const gr = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      gr.addColorStop(0, '#fff3a6');
      gr.addColorStop(0.55, '#ffcf3a');
      gr.addColorStop(1, '#f39b12');
      ctx.fillStyle = gr;
    } else ctx.fillStyle = '#d9dcef';
    ctx.fillText(title, 0, 0);
    // Petit liseré à la couleur de l'équipe du joueur sous le titre.
    ctx.globalAlpha = s.alpha * 0.95;
    ctx.fillStyle = teamUi;
    const lw = ctx.measureText(title).width * 0.6;
    ctx.fillRect(-lw / 2, size * 0.62, lw, Math.max(3, size * 0.08));
  }
  ctx.restore();
}
