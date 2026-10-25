/** Flèche d'ordre tracée au doigt depuis un élève sélectionné (coordonnées écran). */
export interface OrderArrow {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Vrai quand le doigt est sur un ennemi : l'ordre sera une attaque. */
  attack: boolean;
}

/** Dessine la flèche (blanche pour un déplacement, rouge pour une attaque). */
export function drawArrow(ctx: CanvasRenderingContext2D, a: OrderArrow): void {
  const dx = a.x1 - a.x0;
  const dy = a.y1 - a.y0;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(18, len * 0.45);
  const color = a.attack ? '#ff3b2f' : '#ffffff';
  const bx = a.x1 - ux * head;
  const by = a.y1 - uy * head;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Contour sombre pour rester lisible sur le sol clair.
  for (const [style, width] of [
    ['rgba(20,20,30,0.55)', 9],
    [color, 5],
  ] as const) {
    ctx.strokeStyle = style;
    ctx.fillStyle = style;
    ctx.lineWidth = width;
    ctx.setLineDash(style === color ? [10, 7] : []);
    ctx.beginPath();
    ctx.moveTo(a.x0, a.y0);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(bx - uy * head * 0.6, by + ux * head * 0.6);
    ctx.lineTo(bx + uy * head * 0.6, by - ux * head * 0.6);
    ctx.closePath();
    ctx.fill();
    if (style !== color) ctx.stroke();
  }
  // Cible au point d'arrivée.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(a.x1, a.y1, a.attack ? 16 : 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
