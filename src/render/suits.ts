import type { Suit } from '../core/types';

/**
 * Symboles de cartes à jouer tracés en vectoriel (chemins canvas), centrés en (cx, cy),
 * inscrits dans un carré de côté `size`.
 */
export function drawSuit(ctx: CanvasRenderingContext2D, suit: Suit, cx: number, cy: number, size: number, color: string): void {
  const s = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (suit) {
    case 'heart': {
      ctx.moveTo(0, s * 0.95);
      ctx.bezierCurveTo(-s * 1.15, s * 0.15, -s * 0.85, -s * 0.95, 0, -s * 0.35);
      ctx.bezierCurveTo(s * 0.85, -s * 0.95, s * 1.15, s * 0.15, 0, s * 0.95);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'diamond': {
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.35, -s * 0.3, s * 0.8, 0);
      ctx.quadraticCurveTo(s * 0.35, s * 0.3, 0, s);
      ctx.quadraticCurveTo(-s * 0.35, s * 0.3, -s * 0.8, 0);
      ctx.quadraticCurveTo(-s * 0.35, -s * 0.3, 0, -s);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'spade': {
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.1, s * 1.1, s * 0.5, 0, s * 0.45);
      ctx.bezierCurveTo(-s * 1.1, s * 0.5, -s * 0.9, -s * 0.1, 0, -s);
      ctx.closePath();
      ctx.fill();
      // Pied.
      ctx.beginPath();
      ctx.moveTo(0, s * 0.2);
      ctx.quadraticCurveTo(s * 0.1, s * 0.75, s * 0.45, s);
      ctx.lineTo(-s * 0.45, s);
      ctx.quadraticCurveTo(-s * 0.1, s * 0.75, 0, s * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'club': {
      const r = s * 0.38;
      ctx.arc(0, -s * 0.5, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.42, s * 0.08, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.42, s * 0.08, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.1, s * 0.75, s * 0.45, s);
      ctx.lineTo(-s * 0.45, s);
      ctx.quadraticCurveTo(-s * 0.1, s * 0.75, 0, -s * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export const SUIT_COLORS: Record<Suit, string> = {
  spade: '#2a2a33',
  club: '#2a2a33',
  heart: '#d6303c',
  diamond: '#d6303c',
};
