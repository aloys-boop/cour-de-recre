import { TEAM_COLORS } from '../config';
import { hopOffset, MenuScene, runFrame, SCENE, type SceneKid } from '../core/menu-scene';
import { reducedMotion } from '../render/effects';
import { buildSheet, FEET_Y, FRAME_H, FRAME_W, FRAME_WALK, FRAME_IDLE, type SheetCanvas } from '../render/sprites';

/** Hauteur de la bande de cour derrière le titre (px CSS, sans l'encoche). */
export const BACKDROP_H = 60;
/** Cadence de la bande : 30 images par seconde suffisent et ménagent la batterie. */
const FRAME_MS = 1000 / 30;

/**
 * Bande animée de l'accueil (v5.23) : des élèves jouent au chat derrière le titre.
 * Le canvas est posé en haut du menu et défile avec lui ; la boucle ne tourne que menu
 * affiché et page visible. « Réduire les animations » : une seule image, élèves immobiles.
 */
export class MenuBackdrop {
  readonly canvas: HTMLCanvasElement;
  scene: MenuScene;
  private sheets = new Map<number, SheetCanvas>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  /** Images dessinées et temps cumulé de mise à jour et de dessin, en ms (tests, mesures). */
  frames = 0;
  busyMs = 0;

  constructor(private parent: HTMLElement, seed = 7) {
    const c = document.createElement('canvas');
    c.className = 'menu-backdrop';
    c.setAttribute('aria-hidden', 'true');
    c.style.pointerEvents = 'none';
    this.canvas = c;
    this.scene = new MenuScene(this.cssWidth(), seed);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.running || this.resumeIfShown()));
  }

  private cssWidth(): number {
    return Math.max(200, this.parent.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 844));
  }

  /** (Re)pose le canvas en tête du menu (le menu se redessine entièrement à chaque affichage). */
  attach(): void {
    if (this.canvas.parentElement !== this.parent) this.parent.prepend(this.canvas);
    else if (this.parent.firstChild !== this.canvas) this.parent.prepend(this.canvas);
  }

  start(): void {
    this.attach();
    this.resize();
    this.running = true;
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.acc = FRAME_MS;
    if (reducedMotion()) {
      this.draw();
      return;
    }
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = now - this.last;
      this.last = now;
      this.acc += dt;
      if (this.acc < FRAME_MS) return;
      const t0 = performance.now();
      this.scene.step(Math.min(this.acc, 100) / 1000);
      this.acc = 0;
      this.draw();
      this.busyMs += performance.now() - t0;
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private resumeIfShown(): void {
    if (!this.parent.classList.contains('hidden') && this.canvas.isConnected) this.start();
  }

  /** Choix d'une équipe : son élève saute de joie. */
  cheer(team: number): void {
    if (reducedMotion()) return; // élèves immobiles : pas de saut figé ni de « Moi ! » qui reste
    this.scene.cheer(team);
  }

  private resize(): void {
    const w = this.cssWidth();
    const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const h = this.height();
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.scene.setWidth(w);
  }

  /** Hauteur totale : la bande, plus l'encoche du haut (lue dans la marge du menu). */
  private height(): number {
    const top = parseFloat(getComputedStyle(this.parent).paddingTop || '0') || 0;
    return BACKDROP_H + Math.max(0, top - 10);
  }

  private sheet(team: number): SheetCanvas {
    let s = this.sheets.get(team);
    if (!s) {
      s = buildSheet(team, (w, h) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      });
      this.sheets.set(team, s);
    }
    return s;
  }

  draw(): void {
    const c = this.canvas;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    this.frames++;
    const dpr = c.width / Math.max(1, parseFloat(c.style.width) || c.width);
    const w = c.width / dpr;
    const h = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    const ground = h - 9;
    // Sol de la cour : une bande sombre qui s'efface vers le haut, ligne de craie et marelle.
    const g = ctx.createLinearGradient(0, ground - 22, 0, h);
    g.addColorStop(0, 'rgba(10, 16, 40, 0)');
    g.addColorStop(1, 'rgba(10, 16, 40, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, ground - 22, w, h - ground + 22);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(0, ground + 2.5);
    ctx.lineTo(w, ground + 2.5);
    ctx.stroke();
    ctx.setLineDash([]);
    drawHopscotch(ctx, w * 0.1, ground - 4);
    drawHopscotch(ctx, w * 0.82, ground - 4);

    for (const k of this.scene.drawOrder()) this.drawKid(ctx, k, ground);
    for (const p of this.scene.pops) {
      const k = 1 - p.t / SCENE.popLife;
      const s = laneScale(p.lane);
      // À côté de la tête (la bande est trop basse pour écrire au-dessus), du côté le plus libre.
      const right = p.x < w - 80;
      const y = feetY(ground, p.lane) - FRAME_H * s * 0.62 - p.t * 10;
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 2));
      ctx.font = '900 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = right ? 'left' : 'right';
      const tx = p.x + (right ? 12 : -12) * s * 1.4;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1b1b24';
      ctx.strokeText(p.text, tx, y);
      ctx.fillStyle = '#ffe066';
      ctx.fillText(p.text, tx, y);
      ctx.globalAlpha = 1;
    }
  }

  private drawKid(ctx: CanvasRenderingContext2D, k: SceneKid, ground: number): void {
    const s = laneScale(k.lane);
    const f = runFrame(k);
    const frame = f < 0 ? FRAME_IDLE : FRAME_WALK + f;
    const dir = k.face > 0 ? 7 : 3; // profil droit, profil gauche
    const fy = feetY(ground, k.lane);
    const lift = hopOffset(k.hop);
    const dw = FRAME_W * s;
    const dh = FRAME_H * s;
    const x = k.x - dw / 2;
    const y = fy - FEET_Y * s - lift;
    // Ombre au sol (elle reste au sol pendant le saut).
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(k.x, fy, 9 * s * (1 - lift / 30), 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fond plus sombre (profondeur), devant plein.
    ctx.globalAlpha = 0.72 + 0.28 * k.lane;
    ctx.drawImage(this.sheet(k.team) as CanvasImageSource, frame * FRAME_W, dir * FRAME_H, FRAME_W, FRAME_H, x, y, dw, dh);
    ctx.globalAlpha = 1;
    if (k.role === 'chat') {
      // Le chat : étoile dorée au-dessus de la tête (elle tourne pendant qu'il compte).
      const sy = y + 2 - (k.freeze > 0 ? 0 : Math.abs(Math.sin(k.t * 6)) * 2);
      drawStar(ctx, k.x, sy, 5.5, k.freeze > 0 ? k.freeze * 6 : 0, TEAM_COLORS[k.team]?.ui ?? '#ffe066');
    }
  }

  destroy(): void {
    this.stop();
    this.canvas.remove();
  }
}

/** Taille des élèves selon la profondeur : plus petits au fond. */
export function laneScale(lane: number): number {
  return 0.7 + 0.16 * lane;
}

function feetY(ground: number, lane: number): number {
  return ground - (1 - lane) * 9;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, rim: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1b1b24';
  ctx.stroke();
  ctx.fillStyle = '#ffe066';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.restore();
}

/** Marelle à la craie, couchée en perspective. */
function drawHopscotch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.lineWidth = 1.2;
  const cw = 13;
  const ch = 5;
  // Colonnes : simple, simple, double, simple, double.
  [false, false, true, false, true].forEach((double, i) => {
    if (double) {
      ctx.strokeRect(x + i * cw, y - ch, cw, ch);
      ctx.strokeRect(x + i * cw, y, cw, ch);
    } else ctx.strokeRect(x + i * cw, y - ch, cw, ch * 2);
  });
  ctx.restore();
}

