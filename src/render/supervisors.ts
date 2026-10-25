import { PUNISH_SECONDS, SUPERVISOR_SCALE, supervisorsOf, type Supervisor } from '../core/supervisors';
import type { Dir, Vec2 } from '../core/types';
import type { Unit } from '../core/unit';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { FEET_Y, FRAME_H, FRAME_W, type SheetCanvas } from './sprites';

/**
 * Rendu des surveillants (option « Surveillants ») : adultes en blouse blanche à liseré
 * bleu canard, sifflet argenté au cordon rouge, dessinés pixel par pixel dans le style des
 * élèves (même taille d'image), puis affichés 1,3 fois plus grands.
 * Planche : 8 directions (lignes) × 6 images (repos, 4 de marche, coup de sifflet).
 */
const SUP_FRAMES = 6;
const F_IDLE = 0;
const F_WALK = 1;
const F_WHISTLE = 5;

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
  const side = DIR_SIDE[dir];
  const front = DIR_FRONT[dir];
  const away = front < 0;
  const profile = front === 0;
  const walk = frame >= F_WALK && frame < F_WALK + 4 ? frame - F_WALK : -1;
  const blowing = frame === F_WHISTLE;
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
      if (!blowing) rect(p, headX + 5 + Math.round(side * 1.5), headY + 11, 2, 1, C.mouth);
    }
  }

  // ---- Bras avant : le long du corps, ou main portant le sifflet à la bouche.
  if (blowing && !away) {
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

/** Construit la planche des surveillants (8 lignes × 6 images). */
export function buildSupervisorSheet(makeCanvas: (w: number, h: number) => SheetCanvas): SheetCanvas {
  const sheet = makeCanvas(FRAME_W * SUP_FRAMES, FRAME_H * 8);
  const ctx = sheet.getContext('2d') as Ctx;
  ctx.imageSmoothingEnabled = false;
  for (let d = 0; d < 8; d++) for (let f = 0; f < SUP_FRAMES; f++) drawSupervisorFrame(ctx, f * FRAME_W, d * FRAME_H, d as Dir, f);
  return sheet;
}

/** Planche construite au premier surveillant dessiné (aucun coût sans l'option). */
export function lazySupervisorSheet(makeCanvas: (w: number, h: number) => SheetCanvas): () => SheetCanvas {
  let sheet: SheetCanvas | null = null;
  return () => (sheet ??= buildSupervisorSheet(makeCanvas));
}

function supFrame(s: Supervisor): number {
  if (s.anim === 'whistle') return s.animTime < 0.9 ? F_WHISTLE : F_IDLE;
  if (s.anim === 'walk') return F_WALK + (Math.floor(s.animTime * 5) % 4);
  return F_IDLE;
}

/** Ajoute les surveillants à la liste d'objets triés par profondeur du renderer. */
export function pushSupervisorItems(world: World, items: Array<{ depth: number; sup?: Supervisor }>): void {
  for (const s of supervisorsOf(world)) items.push({ depth: s.x + s.y, sup: s });
}

/** Dessine un surveillant (ombre + sprite agrandi), pieds en (s.x, s.y). */
export function drawSupervisor(ctx: Ctx, sheet: SheetCanvas, s: Supervisor, cam: Camera): void {
  const p = cam.gridToScreen(s.x, s.y);
  const z = cam.zoom;
  const k = SUPERVISOR_SCALE * z;
  const m = 90 * z;
  if (p.x < -m || p.y < -m || p.x > cam.viewW + m || p.y > cam.viewH + m) return;
  ctx.fillStyle = 'rgba(20,20,30,0.42)';
  ctx.beginPath();
  ctx.ellipse(p.x + 5 * z, p.y + 1 * z, 15 * z, 7 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  const frame = supFrame(s);
  const dw = FRAME_W * k;
  const dh = FRAME_H * k;
  ctx.drawImage(sheet as CanvasImageSource, frame * FRAME_W, s.dir * FRAME_H, FRAME_W, FRAME_H, Math.round(p.x - dw / 2), Math.round(p.y - FEET_Y * k), dw, dh);
}

/** Point d'exclamation pixel au-dessus d'un élève puni (clignote à la fin de la punition). */
export function drawPunishedMark(ctx: Ctx, u: Unit, p: Vec2, z: number, time: number): void {
  const left = u.punishedUntil - time;
  if (left <= 0 || !u.alive) return;
  if (left < 0.8 && Math.floor(left * 8) % 2 === 0) return;
  const s = Math.max(1, Math.round(1.6 * z * 2) / 2);
  const x = Math.round(p.x - 2.5 * s);
  const top = Math.round(p.y - (FEET_Y + 20) * z - (left > PUNISH_SECONDS - 0.2 ? 2 * s : 0));
  // Bulle jaune à contour sombre, « ! » rouge.
  ctx.fillStyle = '#1b1b24';
  ctx.fillRect(x - s, top - s, 7 * s, 11 * s);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(x, top, 5 * s, 9 * s);
  ctx.fillStyle = '#d8322a';
  ctx.fillRect(x + 1.5 * s, top + 1 * s, 2 * s, 4.5 * s);
  ctx.fillRect(x + 1.5 * s, top + 6.5 * s, 2 * s, 1.5 * s);
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
    if (!visible(s.x, s.y)) continue;
    const p = toMini(s.x, s.y);
    ctx.fillStyle = '#26262e';
    ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
}
