import { TEAM_COLORS } from '../config';
import type { Anim, Dir } from '../core/types';

/**
 * Sprites d'élèves dessinés entièrement en code, pixel par pixel, dans un style
 * « Flash années 2000 » : aplats, contour sombre d'un pixel, proportions trapues.
 * Chaque planche : 8 directions (lignes) × 11 images (colonnes).
 */
export const FRAME_W = 32;
export const FRAME_H = 44;
export const FRAMES_PER_DIR = 11;

export const FRAME_IDLE = 0;
export const FRAME_WALK = 1; // 4 images
export const FRAME_PUNCH = 5; // 3 images
export const FRAME_KO = 8; // 3 images

const C = {
  outline: '#1e1e28',
  skin: '#f3caa4',
  skinDark: '#d9a27d',
  hair: '#7b2341',
  hairLight: '#9a3454',
  trousers: '#3a3a4c',
  trousersLight: '#4a4a60',
  shoes: '#4a2d1a',
  gold: '#f2c84b',
  mouth: '#b35f5f',
  star: '#ffe066',
};

/** side : -1 = regarde vers la gauche de l'écran, +1 = vers la droite ; front : 1 = face, -1 = dos, 0 = profil. */
const DIR_SIDE: Record<Dir, number> = { 0: 1, 1: 0, 2: -1, 3: -1, 4: -1, 5: 0, 6: 1, 7: 1 };
const DIR_FRONT: Record<Dir, number> = { 0: 0.7, 1: 1, 2: 0.7, 3: 0, 4: -0.7, 5: -1, 6: -0.7, 7: 0 };

type Ctx = CanvasRenderingContext2D;

interface Pen {
  ctx: Ctx;
  ox: number;
  oy: number;
}

function rect(p: Pen, x: number, y: number, w: number, h: number, color: string): void {
  p.ctx.fillStyle = color;
  p.ctx.fillRect(p.ox + x, p.oy + y, w, h);
}

/** Rectangle avec contour d'un pixel. */
function rectO(p: Pen, x: number, y: number, w: number, h: number, color: string): void {
  rect(p, x - 1, y - 1, w + 2, h + 2, C.outline);
  rect(p, x, y, w, h, color);
}

/** Segment épais de carrés (pour les bras tendus). */
function thick(p: Pen, x0: number, y0: number, x1: number, y1: number, size: number, color: string, outline = true): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (outline) {
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n));
      const y = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n));
      rect(p, x - 1, y - 1, size + 2, size + 2, C.outline);
    }
  }
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n));
    const y = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n));
    rect(p, x, y, size, size, color);
  }
}

export interface StudentPose {
  bob: number; // décalage vertical du corps
  legL: number; // hauteur jambe gauche (10 = tendue)
  legR: number;
  armL: number; // décalage vertical bras gauche
  armR: number;
  punch: 0 | 1 | 2 | 3; // 0 aucun, 1 armé, 2 tendu, 3 retour
  ko: 0 | 1 | 2 | 3; // 0 non, 1 sonné, 2 assis, 3 assis + étoiles
}

export function poseFor(frame: number): StudentPose {
  const base: StudentPose = { bob: 0, legL: 10, legR: 10, armL: 0, armR: 0, punch: 0, ko: 0 };
  if (frame === FRAME_IDLE) return base;
  if (frame >= FRAME_WALK && frame < FRAME_WALK + 4) {
    const f = frame - FRAME_WALK;
    const legs = [
      [10, 8],
      [10, 10],
      [8, 10],
      [10, 10],
    ][f];
    return { ...base, legL: legs[0], legR: legs[1], bob: f % 2 === 1 ? 1 : 0, armL: [1, 0, -1, 0][f], armR: [-1, 0, 1, 0][f] };
  }
  if (frame >= FRAME_PUNCH && frame < FRAME_PUNCH + 3) {
    const f = frame - FRAME_PUNCH;
    return { ...base, punch: (f + 1) as 1 | 2 | 3, bob: f === 1 ? 1 : 0, legL: f === 1 ? 9 : 10 };
  }
  if (frame >= FRAME_KO && frame < FRAME_KO + 3) {
    const f = frame - FRAME_KO;
    return { ...base, ko: (f + 1) as 1 | 2 | 3 };
  }
  return base;
}

/** Image à afficher pour une animation et un temps écoulé. */
export function frameFor(anim: Anim, t: number): number {
  switch (anim) {
    case 'walk':
      return FRAME_WALK + (Math.floor(t * 9) % 4);
    case 'punch':
      return FRAME_PUNCH + Math.min(2, Math.floor(t / 0.13));
    case 'ko':
      return FRAME_KO + Math.min(2, Math.floor(t / 0.35));
    default:
      return FRAME_IDLE;
  }
}

/**
 * Dessine un élève dans une case de FRAME_W × FRAME_H dont l'origine est (ox, oy).
 * Les pieds reposent sur y = 42.
 */
export function drawStudent(ctx: Ctx, ox: number, oy: number, team: number, dir: Dir, pose: StudentPose): void {
  const p: Pen = { ctx, ox, oy };
  const col = TEAM_COLORS[team];
  const side = DIR_SIDE[dir];
  const front = DIR_FRONT[dir];
  const facingAway = front < 0;
  const profile = front === 0;

  if (pose.ko >= 2) {
    drawSitting(p, team, side, front, pose.ko === 3);
    return;
  }

  const bob = pose.bob + (pose.ko === 1 ? 3 : 0);
  const legL = pose.ko === 1 ? 7 : pose.legL;
  const legR = pose.ko === 1 ? 7 : pose.legR;

  // --- Jambes et chaussures (dessinées d'abord, derrière le corps).
  const legTop = 30 + bob;
  const legY = (h: number) => legTop + (10 - h);
  rectO(p, 11, legY(legL), 4, legL, C.trousers);
  rectO(p, 17, legY(legR), 4, legR, C.trousers);
  rect(p, 10, 40, 6, 2, C.shoes);
  rect(p, 16, 40, 6, 2, C.shoes);
  rect(p, 9, 42, 7, 1, C.outline);
  rect(p, 16, 42, 7, 1, C.outline);

  // --- Bras arrière (celui du côté opposé au regard, en vue 3/4).
  const armColor = col.main;
  const shoulderY = 17 + bob;
  const backArmX = side > 0 ? 7 : 22; // bras le plus éloigné
  const frontArmX = side > 0 ? 22 : 7;
  const drawArm = (x: number, dy: number) => {
    rectO(p, x, shoulderY + dy, 3, 10, armColor);
    rect(p, x, shoulderY + dy + 10, 3, 2, C.skin);
    rect(p, x - 1, shoulderY + dy + 12, 5, 1, C.outline);
  };
  if (pose.punch === 0) drawArm(backArmX, side > 0 ? pose.armL : pose.armR);

  // --- Veste à col montant.
  const bodyY = 16 + bob;
  rectO(p, 10, bodyY, 12, 14, col.main);
  // Ombre latérale pour donner du volume.
  rect(p, side >= 0 ? 10 : 20, bodyY + 1, 2, 12, col.dark);
  // Col montant (bande claire).
  rectO(p, 12, bodyY, 8, 2, col.light);
  // Boutons dorés : visibles de face et en 3/4 face, sur le bord pour le profil.
  if (!facingAway) {
    const bx = profile ? (side > 0 ? 19 : 11) : 15 + Math.round(side * 2);
    for (let i = 0; i < 3; i++) rect(p, bx, bodyY + 4 + i * 3, 2, 2, C.gold);
  } else {
    // Dos : couture centrale.
    rect(p, 15 + Math.round(side * 2), bodyY + 3, 1, 10, col.dark);
  }

  // --- Cou.
  rect(p, 14, bodyY - 2, 4, 2, facingAway ? C.hair : C.skin);

  // --- Tête.
  const headY = 4 + bob;
  rectO(p, 10, headY, 12, 11, C.skin);
  // Cheveux bordeaux : calotte + mèches.
  if (facingAway) {
    rectO(p, 10, headY - 1, 12, 11, C.hair);
    rect(p, 11, headY, 10, 2, C.hairLight);
  } else {
    rectO(p, 10, headY - 1, 12, 4, C.hair);
    rect(p, 11, headY - 1, 10, 1, C.hairLight);
    // Frange décalée selon le côté regardé.
    const fx = 11 + Math.round(side * 2);
    rect(p, fx, headY + 3, 3, 2, C.hair);
    rect(p, fx + 5, headY + 3, 2, 1, C.hair);
    // Mèches latérales.
    rect(p, 10, headY + 3, 1, 5, C.hair);
    rect(p, 21, headY + 3, 1, 5, C.hair);
    // Yeux.
    if (pose.ko === 1) {
      // Sonné : yeux en croix.
      rect(p, 12 + Math.max(0, side), headY + 6, 1, 1, C.outline);
      rect(p, 13 + Math.max(0, side), headY + 7, 1, 1, C.outline);
      rect(p, 18 + Math.min(0, side), headY + 6, 1, 1, C.outline);
      rect(p, 17 + Math.min(0, side), headY + 7, 1, 1, C.outline);
    } else if (profile) {
      rect(p, side > 0 ? 18 : 12, headY + 6, 2, 2, C.outline);
    } else {
      const ex = 12 + Math.round(side * 2.5);
      rect(p, ex, headY + 6, 2, 2, C.outline);
      rect(p, ex + 6, headY + 6, 2, 2, C.outline);
      // Bouche discrète.
      rect(p, 15 + Math.round(side * 2), headY + 9, 2, 1, C.mouth);
    }
    // Ombre sous le menton.
    rect(p, 11, headY + 10, 10, 1, C.skinDark);
  }

  // --- Bras avant / coup de poing.
  if (pose.punch === 0) {
    drawArm(frontArmX, side > 0 ? pose.armR : pose.armL);
  } else {
    const sx = side === 0 ? 1 : side;
    const shx = side >= 0 ? 23 : 8; // épaule côté avant
    let fx: number;
    let fy: number;
    if (profile) {
      fx = side > 0 ? 30 : -2;
      fy = shoulderY + 3;
    } else if (front > 0) {
      fx = 15 + sx * 5;
      fy = shoulderY + 12;
    } else {
      fx = 15 + sx * 5;
      fy = shoulderY - 7;
    }
    if (pose.punch === 1) {
      // Armé : le poing part en arrière.
      thick(p, shx, shoulderY + 1, shx - sx * 3, shoulderY + 6, 3, armColor);
      rectO(p, shx - sx * 3, shoulderY + 7, 3, 3, C.skin);
    } else if (pose.punch === 2) {
      thick(p, shx, shoulderY + 1, fx, fy, 3, armColor);
      rectO(p, fx - 1, fy - 1, 4, 4, C.skin);
      // Petit éclat d'impact.
      rect(p, fx + sx * 4 - 1, fy - 2, 1, 1, C.star);
      rect(p, fx + sx * 5, fy + 1, 1, 1, C.star);
      rect(p, fx + sx * 4 - 1, fy + 4, 1, 1, C.star);
    } else {
      const hx = Math.round((shx + fx) / 2);
      const hy = Math.round((shoulderY + 1 + fy) / 2);
      thick(p, shx, shoulderY + 1, hx, hy, 3, armColor);
      rectO(p, hx, hy, 3, 3, C.skin);
    }
  }
}

/** Élève KO assis par terre, jambes tendues devant lui. */
function drawSitting(p: Pen, team: number, side: number, front: number, stars: boolean): void {
  const col = TEAM_COLORS[team];
  const facingAway = front < 0;
  const sx = side === 0 ? (front >= 0 ? 1 : -1) : side;
  // Jambes allongées vers le côté regardé.
  const legX = sx > 0 ? 14 : 4;
  rectO(p, legX, 36, 14, 4, C.trousers);
  rect(p, sx > 0 ? 26 : 2, 36, 4, 5, C.shoes);
  rect(p, sx > 0 ? 25 : 1, 41, 6, 1, C.outline);
  // Corps voûté.
  rectO(p, 10, 24, 12, 13, col.main);
  rect(p, sx >= 0 ? 10 : 20, 25, 2, 11, col.dark);
  rectO(p, 12, 24, 8, 2, col.light);
  if (!facingAway) for (let i = 0; i < 3; i++) rect(p, 15 + Math.round(sx * 2), 28 + i * 3, 2, 2, C.gold);
  // Bras ballants.
  rectO(p, 7, 26, 3, 9, col.main);
  rectO(p, 22, 26, 3, 9, col.main);
  rect(p, 7, 35, 3, 2, C.skin);
  rect(p, 22, 35, 3, 2, C.skin);
  // Tête penchée.
  const hx = 10 + Math.round(sx * 1.5);
  const hy = 13;
  rectO(p, hx, hy, 12, 11, C.skin);
  if (facingAway) {
    rectO(p, hx, hy - 1, 12, 11, C.hair);
  } else {
    rectO(p, hx, hy - 1, 12, 4, C.hair);
    rect(p, hx + 1, hy + 3, 3, 2, C.hair);
    rect(p, hx + 7, hy + 3, 2, 1, C.hair);
    // Yeux fermés (traits) ou en spirale selon l'image.
    rect(p, hx + 2, hy + 7, 3, 1, C.outline);
    rect(p, hx + 7, hy + 7, 3, 1, C.outline);
    rect(p, hx + 5, hy + 9, 2, 1, C.mouth);
  }
  if (stars) {
    rect(p, hx - 2, hy - 4, 2, 2, C.star);
    rect(p, hx + 12, hy - 2, 2, 2, C.star);
    rect(p, hx + 5, hy - 6, 2, 2, C.star);
  }
}

export type SheetCanvas = HTMLCanvasElement | OffscreenCanvas;

/** Construit la planche de sprites d'une équipe (8 lignes × 11 colonnes). */
export function buildSheet(team: number, makeCanvas: (w: number, h: number) => SheetCanvas): SheetCanvas {
  const sheet = makeCanvas(FRAME_W * FRAMES_PER_DIR, FRAME_H * 8);
  const ctx = sheet.getContext('2d') as Ctx;
  ctx.imageSmoothingEnabled = false;
  for (let d = 0; d < 8; d++) {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      drawStudent(ctx, f * FRAME_W, d * FRAME_H, team, d as Dir, poseFor(f));
    }
  }
  return sheet;
}
