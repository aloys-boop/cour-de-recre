import { SUPERVISOR_SCALE, supervisorActive, supervisorsOf, type Supervisor } from '../core/supervisors';
import type { Dir, Vec2 } from '../core/types';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { FEET_Y, FRAME_H, FRAME_W, type SheetCanvas } from './sprites';

/**
 * Rendu des surveillants (option « Surveillants ») : adultes en blouse blanche à liseré
 * bleu canard, sifflet argenté au cordon rouge, dessinés pixel par pixel dans le style des
 * élèves (même taille d'image), puis affichés 1,45 fois plus grands (mini-boss).
 * Planche : 8 directions (lignes) × 10 images (repos, 4 de marche, coup de sifflet,
 * élan et coup de poing, chute et KO au sol avec le sifflet tombé).
 */
const SUP_FRAMES = 10;
const F_IDLE = 0;
const F_WALK = 1;
const F_WHISTLE = 5;
const F_WINDUP = 6;
const F_PUNCH = 7;
const F_FALL = 8;
const F_KO = 9;

const C = {
  outline: '#1b1b24',
  skin: '#f0c49c',
  skinShade: '#cf9a72',
  hair: '#7a7a82',
  hairLight: '#a3a3ab',
  hairDark: '#55555d',
  coat: '#f7f7f2',
  coatShade: '#d3d4cf',
  coatDark: '#a9aba6',
  trim: '#11898f',
  trousers: '#3b4a5c',
  trousersLight: '#52647a',
  shoes: '#222228',
  cord: '#d8322a',
  whistle: '#e8eef4',
  whistleDark: '#8a96a3',
  eye: '#1b1b24',
  mouth: '#a45a5a',
  sound: '#ffffff',
  star: '#ffe066',
};

const DIR_SIDE: Record<Dir, number> = { 0: 1, 1: 0, 2: -1, 3: -1, 4: -1, 5: 0, 6: 1, 7: 1 };
const DIR_FRONT: Record<Dir, number> = { 0: 0.7, 1: 1, 2: 0.7, 3: 0, 4: -0.7, 5: -1, 6: -0.7, 7: 0 };

type Ctx = CanvasRenderingContext2D;
interface Pen {
  ctx: Ctx;
  ox: number;
  oy: number;
}

function rect(p: Pen, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return;
  p.ctx.fillStyle = color;
  p.ctx.fillRect(p.ox + x, p.oy + y, w, h);
}

function blob(p: Pen, x: number, y: number, w: number, h: number, color: string, c = 2): void {
  for (let r = 0; r < h; r++) {
    const d = Math.min(r, h - 1 - r);
    const inset = d >= c ? 0 : c - d;
    rect(p, x + inset, y + r, w - inset * 2, 1, color);
  }
}

function blobO(p: Pen, x: number, y: number, w: number, h: number, color: string, c = 2): void {
  blob(p, x - 1, y - 1, w + 2, h + 2, C.outline, c);
  blob(p, x, y, w, h, color, Math.max(0, c - 1));
}

function rectO(p: Pen, x: number, y: number, w: number, h: number, color: string): void {
  rect(p, x - 1, y - 1, w + 2, h + 2, C.outline);
  rect(p, x, y, w, h, color);
}

/** Segment épais de carrés avec contour (bras plié). */
function thick(p: Pen, x0: number, y0: number, x1: number, y1: number, size: number, color: string): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (pass === 0) rect(p, x - 1, y - 1, size + 2, size + 2, C.outline);
      else rect(p, x, y, size, size, color);
    }
  }
}

/** Dessine un surveillant dans une case FRAME_W × FRAME_H (pieds sur FEET_Y). */
export function drawSupervisorFrame(ctx: Ctx, ox: number, oy: number, dir: Dir, frame: number): void {
  const p: Pen = { ctx, ox, oy };
  if (frame === F_KO) return drawLying(p, DIR_SIDE[dir] < 0 ? -1 : 1);
  if (frame === F_FALL) {
    // Chute : on dessine la pose de repos plus bas, penchée, puis on écrase (voir drawSupervisor).
    p.oy += 4;
    p.ox += DIR_SIDE[dir] < 0 ? 2 : -2;
  }
  const side = DIR_SIDE[dir];
  const front = DIR_FRONT[dir];
  const away = front < 0;
  const profile = front === 0;
  const walk = frame >= F_WALK && frame < F_WALK + 4 ? frame - F_WALK : -1;
  const blowing = frame === F_WHISTLE;
  const windup = frame === F_WINDUP;
  const punching = frame === F_PUNCH;
  const falling = frame === F_FALL;
  const bob = walk >= 0 ? [1, 0, 1, 0][walk] : 0;
  const liftL = walk >= 0 ? [0, 0, 2, 1][walk] : 0;
  const liftR = walk >= 0 ? [2, 1, 0, 0][walk] : 0;
  const armL = walk >= 0 ? [2, 1, -2, -1][walk] : 0;
  const armR = walk >= 0 ? [-2, -1, 2, 1][walk] : 0;

  // ---- Jambes longues (adulte) et chaussures.
  const legTop = 38 + bob;
  const leg = (x: number, lift: number, shoeX: number) => {
    const h = 15 - lift - bob;
    rectO(p, x, legTop + lift, 5, h, C.trousers);
    rect(p, x, legTop + lift, 1, h, C.trousersLight);
    rectO(p, shoeX, 53 - lift, 7, 2, C.shoes);
  };
  const legs: Array<[number, number, number]> = [
    [14, liftL, 13 + Math.round(side * liftL * 0.6)],
    [21, liftR, 20 + Math.round(side * liftR * 0.6)],
  ];
  if (side > 0) legs.reverse();
  for (const [x, lift, shoeX] of legs) leg(x, lift, shoeX);

  // ---- Bras arrière (manche de blouse).
  const shoulderY = 19 + bob;
  const backArmX = side > 0 ? 7 : 29;
  const frontArmX = side > 0 ? 29 : 7;
  const drawArm = (x: number, dy: number, lit: boolean) => {
    rectO(p, x, shoulderY + dy, 4, 18, C.coat);
    rect(p, x, shoulderY + dy, 1, 18, lit ? C.coat : C.coatShade);
    rect(p, x + 3, shoulderY + dy, 1, 18, C.coatShade);
    rect(p, x, shoulderY + dy + 15, 4, 1, C.trim); // poignet à liseré
    rectO(p, x + 1, shoulderY + dy + 18, 2, 3, C.skin);
  };
  drawArm(backArmX, side > 0 ? armL : armR, side <= 0);

  // ---- Blouse longue, liseré sur le devant et l'ourlet.
  const bodyY = 18 + bob;
  const bodyX = profile ? 12 : 11;
  const bodyW = profile ? 16 : 18;
  blobO(p, bodyX, bodyY, bodyW, 25, C.coat, 2);
  rect(p, bodyX + bodyW - 3, bodyY + 2, 2, 22, C.coatShade); // flanc dans l'ombre
  rect(p, bodyX + 1, bodyY + 23, bodyW - 2, 1, C.trim); // ourlet
  rect(p, bodyX + 1, bodyY + 24, bodyW - 2, 1, C.coatDark);
  if (!away) {
    // Revers en V, chemise bleu canard, liseré de la patte, poche.
    const mx = profile ? (side > 0 ? bodyX + bodyW - 5 : bodyX + 3) : 19 + Math.round(side * 2);
    rect(p, mx - 2, bodyY, 5, 4, C.trim);
    rect(p, mx - 1, bodyY + 4, 3, 2, C.trim);
    rect(p, mx, bodyY + 6, 1, 17, C.trim);
    if (!profile) {
      const px = side >= 0 ? bodyX + 3 : bodyX + bodyW - 7;
      rect(p, px, bodyY + 14, 4, 1, C.coatDark);
    }
    // Cordon rouge et sifflet sur la poitrine (sauf s'il est à la bouche).
    if (!blowing) {
      rect(p, mx - 3, bodyY + 1, 1, 6, C.cord);
      rect(p, mx + 3, bodyY + 1, 1, 6, C.cord);
      rect(p, mx - 2, bodyY + 7, 5, 1, C.cord);
      rectO(p, mx - 1, bodyY + 8, 4, 2, C.whistle);
      rect(p, mx - 1, bodyY + 9, 4, 1, C.whistleDark);
    }
  } else {
    rect(p, 19 + Math.round(side * 2), bodyY + 3, 1, 20, C.coatShade); // couture du dos
    rect(p, 15, bodyY + 1, 10, 1, C.cord); // cordon sur la nuque
  }

  // ---- Cou et tête (plus petite que celle d'un élève : proportions d'adulte).
  rect(p, 17, bodyY - 3, 6, 3, away ? C.hairDark : C.skinShade);
  const headY = 4 + bob;
  const headX = 14 + Math.round(side * (profile ? 1 : 0));
  blobO(p, headX, headY, 12, 13, C.skin, 3);
  rect(p, headX + 10, headY + 3, 1, 8, C.skinShade);
  if (away) {
    blobO(p, headX - 1, headY - 1, 14, 12, C.hair, 3);
    rect(p, headX + 1, headY, 10, 1, C.hairLight);
  } else {
    blobO(p, headX - 1, headY - 1, 14, 4, C.hair, 2); // cheveux courts grisonnants
    rect(p, headX + 1, headY, 9, 1, C.hairLight);
    rect(p, headX - 1, headY + 2, 1, 5, C.hair);
    rect(p, headX + 12, headY + 2, 1, 5, C.hair);
    if (profile) {
      const backX = side > 0 ? headX - 1 : headX + 8;
      rect(p, backX, headY + 2, 5, 7, C.hair);
    }
    // Sourcils sévères, yeux, moustache.
    if (profile) {
      const ex = side > 0 ? headX + 8 : headX + 2;
      rect(p, ex - 1, headY + 4, 3, 1, C.hairDark);
      rect(p, ex, headY + 6, 2, 2, C.eye);
      rect(p, side > 0 ? headX + 12 : headX - 1, headY + 7, 1, 2, C.skin); // nez
      rect(p, side > 0 ? headX + 8 : headX + 1, headY + 10, 3, 1, C.hairDark);
    } else {
      const ex = headX + 2 + Math.round(side * 1.5);
      rect(p, ex - 1, headY + 4, 3, 1, C.hairDark);
      rect(p, ex + 5, headY + 4, 3, 1, C.hairDark);
      rect(p, ex, headY + 6, 2, 2, C.eye);
      rect(p, ex + 6, headY + 6, 2, 2, C.eye);
      rect(p, headX + 3 + Math.round(side * 1.5), headY + 9, 6, 1, C.hairDark); // moustache
      if (windup || punching || falling) rect(p, headX + 4 + Math.round(side * 1.5), headY + 11, 4, 2, C.outline); // bouche ouverte
      else if (!blowing) rect(p, headX + 5 + Math.round(side * 1.5), headY + 11, 2, 1, C.mouth);
    }
  }

  // ---- Bras avant : le long du corps, poing levé ou lancé, ou main portant le sifflet à la bouche.
  if (windup || punching) {
    const sx = frontArmX + 1;
    const sy = shoulderY + 1;
    let ex: number;
    let ey: number;
    if (windup) {
      ex = side !== 0 ? sx - side * 4 : sx - 3;
      ey = shoulderY - 4;
    } else {
      ex = side !== 0 ? sx + side * 10 : 15;
      ey = shoulderY + 6 + Math.round(front * 4);
    }
    thick(p, sx, sy, ex, ey, 4, C.coat);
    rect(p, ex, ey, 4, 1, C.trim);
    rectO(p, ex - 1, ey - 1, 6, 5, C.skin); // gros poing
    rect(p, ex - 1, ey + 3, 6, 1, C.skinShade);
    if (punching) {
      // Traits de vitesse derrière le poing.
      const dx = side >= 0 ? -1 : 1;
      const bx = side !== 0 ? ex - side * 3 : ex - 2;
      rect(p, bx + dx * 2, ey - 3, 1, 3, C.sound);
      rect(p, bx + dx * 4, ey, 1, 3, C.sound);
      rect(p, bx + dx * 2, ey + 4, 1, 3, C.sound);
    }
  } else if (falling) {
    // Bras ballants, sifflet qui s'échappe.
    drawArm(frontArmX, 2, side > 0);
    rectO(p, side >= 0 ? 33 : 3, 40, 4, 2, C.whistle);
  } else if (blowing && !away) {
    const hx = profile ? (side > 0 ? headX + 10 : headX - 3) : headX + 4 + Math.round(side * 1.5);
    const hy = headY + 10;
    // Bras replié : coude près du flanc, avant-bras remontant vers la bouche.
    const ex = frontArmX + (side > 0 ? 1 : 0);
    const ey = shoulderY + 11;
    thick(p, frontArmX, shoulderY + 1, ex, ey, 4, C.coat);
    thick(p, ex, ey, hx, hy + 3, 4, C.coat);
    rectO(p, hx, hy + 1, 4, 3, C.skin);
    // Sifflet aux lèvres et petites ondes sonores.
    const wx = profile ? (side > 0 ? headX + 12 : headX - 4) : headX + 4 + Math.round(side * 1.5);
    rectO(p, wx, headY + 10, 4, 2, C.whistle);
    rect(p, wx, headY + 11, 4, 1, C.whistleDark);
    const dx = side >= 0 ? 1 : -1;
    const sxs = side >= 0 ? headX + 15 : headX - 4;
    rect(p, sxs, headY + 3, 1, 3, C.sound);
    rect(p, sxs + dx * 2, headY + 1, 1, 5, C.sound);
    rect(p, sxs + dx * 4, headY - 1, 1, 7, C.sound);
  } else {
    drawArm(frontArmX, side > 0 ? armR : armL, side > 0);
  }
}

/** Surveillant KO, allongé sur le dos, sifflet tombé à côté, étoiles au-dessus de la tête. */
function drawLying(p: Pen, flip: number): void {
  const X = (x: number, w: number) => (flip > 0 ? x : 40 - x - w);
  const y = 44;
  // Jambes et chaussures (pieds vers la gauche si flip > 0).
  rectO(p, X(3, 12), y + 3, 12, 4, C.trousers);
  rect(p, X(3, 12), y + 3, 12, 1, C.trousersLight);
  rectO(p, X(1, 2), y + 1, 2, 6, C.shoes);
  // Blouse.
  blobO(p, X(14, 15), y, 15, 9, C.coat, 2);
  rect(p, X(14, 15), y + 7, 15, 1, C.coatShade);
  rect(p, X(15, 1), y + 1, 1, 7, C.trim); // ourlet
  rect(p, X(22, 6), y + 3, 6, 1, C.trim); // liseré
  // Bras écarté.
  rectO(p, X(18, 4), y - 4, 4, 4, C.coat);
  rectO(p, X(18, 3), y - 7, 3, 3, C.skin);
  // Tête de profil, yeux en croix.
  blobO(p, X(29, 9), y - 1, 9, 9, C.skin, 3);
  blobO(p, X(36, 3), y - 1, 3, 9, C.hair, 1);
  const ex = X(31, 3);
  rect(p, ex, y + 2, 1, 1, C.eye);
  rect(p, ex + 2, y + 2, 1, 1, C.eye);
  rect(p, ex + 1, y + 3, 1, 1, C.eye);
  rect(p, ex, y + 4, 1, 1, C.eye);
  rect(p, ex + 2, y + 4, 1, 1, C.eye);
  rect(p, X(31, 4), y + 6, 4, 1, C.hairDark); // moustache
  // Sifflet tombé au sol, cordon rouge déroulé.
  rect(p, X(24, 6), y + 10, 6, 1, C.cord);
  rectO(p, X(19, 4), y + 9, 4, 2, C.whistle);
  rect(p, X(19, 4), y + 10, 4, 1, C.whistleDark);
  // Étoiles qui tournent au-dessus de la tête.
  for (const [sx, sy] of [
    [27, y - 9],
    [33, y - 12],
    [38, y - 8],
  ]) {
    const x = X(sx, 3);
    rect(p, x + 1, sy, 1, 3, C.star);
    rect(p, x, sy + 1, 3, 1, C.star);
  }
}

/** Construit la planche des surveillants (8 lignes × 10 images). */
export function buildSupervisorSheet(makeCanvas: (w: number, h: number) => SheetCanvas): SheetCanvas {
  const sheet = makeCanvas(FRAME_W * SUP_FRAMES, FRAME_H * 8);
  const ctx = sheet.getContext('2d') as Ctx;
  ctx.imageSmoothingEnabled = false;
  for (let d = 0; d < 8; d++)
    for (let f = 0; f < SUP_FRAMES; f++) {
      // Chaque image reste dans sa case (la chute déborde vers le bas).
      ctx.save();
      ctx.beginPath();
      ctx.rect(f * FRAME_W, d * FRAME_H, FRAME_W, FRAME_H);
      ctx.clip();
      drawSupervisorFrame(ctx, f * FRAME_W, d * FRAME_H, d as Dir, f);
      ctx.restore();
    }
  return sheet;
}

/**
 * Planche d'un pion : le même adulte, en blouse aux couleurs de son équipe (liseré sombre).
 * Les couleurs de la blouse sont remplacées le temps du dessin.
 */
export function buildPionSheet(makeCanvas: (w: number, h: number) => SheetCanvas, coat: { light: string; main: string; dark: string }): SheetCanvas {
  const saved = { coat: C.coat, coatShade: C.coatShade, coatDark: C.coatDark, trim: C.trim };
  Object.assign(C, { coat: coat.light, coatShade: coat.main, coatDark: coat.dark, trim: '#1e1e28' });
  try {
    return buildSupervisorSheet(makeCanvas);
  } finally {
    Object.assign(C, saved);
  }
}

/** Image de la planche d'adulte pour l'animation d'un élève (pion). */
export function pionFrame(anim: 'idle' | 'walk' | 'punch' | 'ko', t: number): number {
  if (anim === 'ko') return t < 0.35 ? F_FALL : F_KO;
  if (anim === 'punch') return t < 0.14 ? F_WINDUP : t < 0.45 ? F_PUNCH : F_IDLE;
  if (anim === 'walk') return F_WALK + (Math.floor(t * 6) % 4);
  return F_IDLE;
}

/** Planche construite au premier surveillant dessiné (aucun coût sans l'option). */
export function lazySupervisorSheet(makeCanvas: (w: number, h: number) => SheetCanvas): () => SheetCanvas {
  let sheet: SheetCanvas | null = null;
  return () => (sheet ??= buildSupervisorSheet(makeCanvas));
}

/** Délai d'élan du coup (doit suivre WINDUP de core/supervisors.ts). */
const WINDUP_SECONDS = 0.28;

function supFrame(s: Supervisor): number {
  if (s.anim === 'ko') return s.animTime < 0.35 ? F_FALL : F_KO;
  if (s.anim === 'punch') return s.animTime < WINDUP_SECONDS ? F_WINDUP : s.animTime < 0.55 ? F_PUNCH : F_IDLE;
  if (s.anim === 'whistle') return s.animTime < 0.9 ? F_WHISTLE : F_IDLE;
  if (s.anim === 'walk') return F_WALK + (Math.floor(s.animTime * 5) % 4);
  return F_IDLE;
}

/** Ajoute les surveillants présents (debout ou KO) à la liste d'objets triés par profondeur du renderer. */
export function pushSupervisorItems(world: World, items: Array<{ depth: number; sup?: Supervisor }>): void {
  for (const s of supervisorsOf(world)) if (s.mode !== 'away') items.push({ depth: s.x + s.y, sup: s });
}

/** Couleurs de la barre de vie des surveillants (orange, plus large que celle des élèves). */
const BAR = { frame: 'rgba(20,16,10,0.75)', back: '#5a3a1c', fill: '#ff8c1a', light: '#ffc46b' };

/** Dessine un surveillant (ombre + sprite agrandi + barre de vie), pieds en (s.x, s.y). */
export function drawSupervisor(ctx: Ctx, sheet: SheetCanvas, s: Supervisor, cam: Camera, time = 0): void {
  if (s.mode === 'away') return;
  const p = cam.gridToScreen(s.x, s.y);
  const z = cam.zoom;
  const k = SUPERVISOR_SCALE * z;
  const m = 90 * z;
  if (p.x < -m || p.y < -m || p.x > cam.viewW + m || p.y > cam.viewH + m) return;
  // KO : il disparaît en fondu à la fin de l'animation.
  const fade = s.mode === 'ko' ? Math.max(0, Math.min(1, s.timer / 0.6)) : 1;
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(20,20,30,0.42)';
  ctx.beginPath();
  ctx.ellipse(p.x + 5 * z, p.y + 1 * z, (s.mode === 'ko' ? 22 : 15) * z, 7 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  const frame = supFrame(s);
  const dw = FRAME_W * k;
  const dh = FRAME_H * k;
  // Petit tremblement quand il encaisse un coup.
  const shake = time - s.hurtAt < 0.12 && supervisorActive(s) ? (Math.floor(time * 60) % 2 ? 1 : -1) * Math.max(1, z) : 0;
  ctx.drawImage(sheet as CanvasImageSource, frame * FRAME_W, s.dir * FRAME_H, FRAME_W, FRAME_H, Math.round(p.x - dw / 2 + shake), Math.round(p.y - FEET_Y * k), dw, dh);
  ctx.globalAlpha = 1;
}

/**
 * Barre de vie orange au-dessus d'un surveillant debout, deux fois plus large que celle d'un élève.
 * Dessinée après tous les personnages pour rester lisible au milieu d'une mêlée.
 */
export function drawSupervisorBar(ctx: Ctx, s: Supervisor, cam: Camera): void {
  if (!supervisorActive(s)) return;
  const p = cam.gridToScreen(s.x, s.y);
  const z = cam.zoom;
  const k = SUPERVISOR_SCALE * z;
  const bw = 44 * z;
  const bh = Math.max(3, 4 * z);
  const bx = p.x - bw / 2;
  const by = p.y - (FEET_Y + 6) * k;
  const r = Math.max(0, Math.min(1, s.hp / s.maxHp));
  ctx.fillStyle = BAR.frame;
  ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
  ctx.fillStyle = BAR.back;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = BAR.fill;
  ctx.fillRect(bx, by, bw * r, bh);
  ctx.fillStyle = BAR.light;
  ctx.fillRect(bx, by, bw * r, Math.max(1, bh * 0.3));
  // Graduations : une par tranche de 10 % (≈ un élève).
  ctx.fillStyle = BAR.frame;
  for (let i = 1; i < 10; i++) ctx.fillRect(Math.round(bx + (bw * i) / 10), by, 1, bh);
}

/** Surveillants sur la mini-carte : carré blanc cerclé de gris foncé, plus gros qu'un élève. */
export function drawSupervisorsMinimap(
  ctx: Ctx,
  world: World,
  toMini: (gx: number, gy: number) => Vec2,
  visible: (x: number, y: number) => boolean = () => true,
): void {
  const list = supervisorsOf(world);
  if (list.length === 0) return;
  for (const s of list) {
    if (!supervisorActive(s) || !visible(s.x, s.y)) continue;
    const p = toMini(s.x, s.y);
    ctx.fillStyle = '#26262e';
    ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
}
