import { attackTicks, rippleRings, rippleStyle, type Ripple } from '../core/feedback';

/**
 * Ondes sous le doigt (v5.22) : anneaux cernés d'une ombre légère (lisibles sur le sable comme
 * sur l'herbe), et, pour l'attaque, quatre crans rouges qui se referment sur la cible.
 * Dessinées en pixels d'écran, sans le tremblement de la caméra : elles restent sous le doigt.
 */
export function drawRipples(ctx: CanvasRenderingContext2D, ripples: Ripple[], reduced: boolean, dpr: number): void {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  for (const r of ripples) {
    const s = rippleStyle(r.kind, r.team);
    for (const ring of rippleRings(r, reduced)) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, ring.radius, 0, Math.PI * 2);
      ctx.globalAlpha = ring.alpha * 0.45;
      ctx.strokeStyle = 'rgba(10, 16, 40, 1)';
      ctx.lineWidth = ring.width + 2.5;
      ctx.stroke();
      ctx.globalAlpha = ring.alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = ring.width;
      ctx.stroke();
    }
    const ticks = attackTicks(r, reduced);
    if (ticks) {
      const len = 9;
      for (let i = 0; i < 4; i++) {
        const a = ticks.angle + (i * Math.PI) / 2;
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(r.x + cx * ticks.dist, r.y + cy * ticks.dist);
        ctx.lineTo(r.x + cx * (ticks.dist + len), r.y + cy * (ticks.dist + len));
        ctx.globalAlpha = ticks.alpha * 0.45;
        ctx.strokeStyle = 'rgba(10, 16, 40, 1)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.globalAlpha = ticks.alpha;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
