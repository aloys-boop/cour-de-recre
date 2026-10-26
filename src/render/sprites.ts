import { TEAM_COLORS } from '../config';
import type { Anim, Dir } from '../core/types';
import type { UnitClass } from '../core/classes';

/**
 * Sprites d'élèves dessinés entièrement en code, pixel par pixel, dans un style
 * « jeu Flash des années 2000 » : aplats avec trois tons par matière, contour sombre
 * d'un pixel, silhouette trapue. Chaque planche : 8 directions (lignes) × 11 images (colonnes).
 */
export const FRAME_W = 40;
export const FRAME_H = 58;
export const FEET_Y = 56; // ligne des pieds dans l'image
export const FRAMES_PER_DIR = 11;

export const FRAME_IDLE = 0;
export const FRAME_WALK = 1; // 4 images
export const FRAME_PUNCH = 5; // 3 images
export const FRAME_KO = 8; // 3 images

const C = {
  outline: '#1b1b24',
  skin: '#f3cba4',
  skinShade: '#d7a37c',
  hair: '#6f1f3e',
  hairLight: '#933156',
  hairDark: '#4b1228',
  trousers: '#2f2f3b',
  trousersLight: '#42424f',
  shoes: '#3a2316',
  shoesLight: '#5b3a25',
  gold: '#f6cc4e',
  goldDark: '#b58d1f',
  mouth: '#b85f62',
  eye: '#1b1b24',
  star: '#ffe066',
  band: '#e5302a',
  bandDark: '#9c1813',
  white: '#f7f7fb',
  whiteShade: '#c9c9d6',
  cross: '#e5302a',
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
  if (w <= 0 || h <= 0) return;
  p.ctx.fillStyle = color;
  p.ctx.fillRect(p.ox + x, p.oy + y, w, h);
}

/** Rectangle aux coins arrondis (coins coupés sur `c` pixels), sans contour. */
function blob(p: Pen, x: number, y: number, w: number, h: number, color: string, c = 2): void {
  for (let r = 0; r < h; r++) {
    const d = Math.min(r, h - 1 - r);
    const inset = d >= c ? 0 : c - d;
    rect(p, x + inset, y + r, w - inset * 2, 1, color);
  }
}

/** Rectangle arrondi avec contour d'un pixel. */
function blobO(p: Pen, x: number, y: number, w: number, h: number, color: string, c = 2): void {
  blob(p, x - 1, y - 1, w + 2, h + 2, C.outline, c);
  blob(p, x, y, w, h, color, Math.max(0, c - 1));
}

function rectO(p: Pen, x: number, y: number, w: number, h: number, color: string): void {
  rect(p, x - 1, y - 1, w + 2, h + 2, C.outline);
  rect(p, x, y, w, h, color);
}

/** Segment épais de carrés (bras tendus). */
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

export interface StudentPose {
  bob: number; // décalage vertical du corps
  liftL: number; // jambe gauche levée (0..3)
  liftR: number;
  armL: number; // balancement vertical bras gauche
  armR: number;
  punch: 0 | 1 | 2 | 3; // 0 aucun, 1 armé, 2 tendu, 3 retour
  ko: 0 | 1 | 2 | 3; // 0 non, 1 sonné, 2 assis, 3 assis + étoiles
}

export function poseFor(frame: number): StudentPose {
  const base: StudentPose = { bob: 0, liftL: 0, liftR: 0, armL: 0, armR: 0, punch: 0, ko: 0 };
  if (frame === FRAME_IDLE) return base;
  if (frame >= FRAME_WALK && frame < FRAME_WALK + 4) {
    const f = frame - FRAME_WALK;
    return {
      ...base,
      liftL: [0, 0, 3, 1][f],
      liftR: [3, 1, 0, 0][f],
      bob: [1, 0, 1, 0][f],
      armL: [2, 1, -2, -1][f],
      armR: [-2, -1, 2, 1][f],
    };
  }
  if (frame >= FRAME_PUNCH && frame < FRAME_PUNCH + 3) {
    const f = frame - FRAME_PUNCH;
    return { ...base, punch: (f + 1) as 1 | 2 | 3, bob: f === 1 ? 1 : 0, liftL: f === 1 ? 1 : 0 };
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
      return FRAME_WALK + (Math.floor(t * 8) % 4);
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
 * Les pieds reposent sur y = FEET_Y.
 */
export function drawStudent(ctx: Ctx, ox: number, oy: number, team: number, dir: Dir, pose: StudentPose, cls: UnitClass = 'eleve'): void {
  const p: Pen = { ctx, ox, oy };
  // Silhouettes des classes : le costaud est large d'épaules et de jambes, le sprinteur plus fin.
  const broad = cls === 'costaud' ? 3 : cls === 'sprinteur' ? -1 : 0;
  const col = TEAM_COLORS[team];
  const side = DIR_SIDE[dir];
  const front = DIR_FRONT[dir];
  const away = front < 0;
  const profile = front === 0;

  if (pose.ko >= 2) {
    drawSitting(p, team, side, front, pose.ko === 3, cls);
    return;
  }

  const bob = pose.bob + (pose.ko === 1 ? 3 : 0);
  const liftL = pose.ko === 1 ? 2 : pose.liftL;
  const liftR = pose.ko === 1 ? 2 : pose.liftR;

  // ---- Jambes et chaussures (dessinées d'abord : derrière le corps).
  const legTop = 42 + bob;
  const leg = (x: number, lift: number, shoeX: number) => {
    const h = 11 - lift - bob;
    const lw = cls === 'costaud' ? 7 : 6;
    rectO(p, x, legTop + lift, lw, h, C.trousers);
    rect(p, x, legTop + lift, 2, h, C.trousersLight);
    // Sprinteur : baskets blanches à bande rouge.
    const sprint = cls === 'sprinteur';
    rectO(p, shoeX, 52 - lift, 8, 3, sprint ? C.white : C.shoes);
    rect(p, shoeX, 52 - lift, 8, 1, sprint ? C.band : C.shoesLight);
  };
  // Jambe arrière puis jambe avant selon le côté regardé.
  const legs: Array<[number, number, number]> = [
    [13 - Math.max(0, broad), liftL, 12 - Math.max(0, broad) + Math.round(side * liftL * 0.6)],
    [21 + Math.max(0, broad) - (cls === 'costaud' ? 1 : 0), liftR, 20 + Math.max(0, broad) + Math.round(side * liftR * 0.6)],
  ];
  if (side > 0) legs.reverse();
  for (const [x, lift, shoeX] of legs) leg(x, lift, shoeX);
  rect(p, 19, legTop, 2, 3, C.trousers); // entrejambe

  // ---- Bras arrière.
  const shoulderY = 24 + bob;
  const backArmX = side > 0 ? 6 - broad : 29 + broad;
  const frontArmX = side > 0 ? 29 + broad : 6 - broad;
  const drawArm = (x: number, dy: number, lit: boolean) => {
    rectO(p, x, shoulderY + dy, 5, 17, col.main);
    rect(p, x, shoulderY + dy, 1, 17, lit ? col.light : col.dark);
    rect(p, x + 4, shoulderY + dy, 1, 17, col.dark);
    rectO(p, x + 1, shoulderY + dy + 17, 3, 3, C.skin);
  };
  if (pose.punch === 0) drawArm(backArmX, side > 0 ? pose.armL : pose.armR, side <= 0);

  // ---- Veste à col montant.
  const bodyY = 23 + bob;
  const bodyX = (profile ? 13 : 11) - broad;
  const bodyW = (profile ? 14 : 18) + 2 * broad;
  blobO(p, bodyX, bodyY, bodyW, 19, col.main, 2);
  rect(p, bodyX + 1, bodyY + 2, 3, 16, col.light); // flanc éclairé (gauche)
  rect(p, bodyX + bodyW - 4, bodyY + 2, 3, 16, col.dark); // flanc dans l'ombre (droite)
  rect(p, bodyX + 1, bodyY + 18, bodyW - 2, 1, col.dark); // ourlet
  // Col montant.
  blobO(p, bodyX + 3, bodyY, bodyW - 6, 3, col.light, 1);
  if (!away) {
    // Boutons dorés sur la patte de boutonnage.
    const bx = profile ? (side > 0 ? bodyX + bodyW - 4 : bodyX + 2) : 19 + Math.round(side * 3);
    rect(p, bx + (side >= 0 ? -1 : 2), bodyY + 4, 1, 14, col.dark); // patte
    for (let i = 0; i < 3; i++) {
      rect(p, bx, bodyY + 5 + i * 4, 2, 2, C.gold);
      rect(p, bx, bodyY + 6 + i * 4, 2, 1, C.goldDark);
    }
  } else {
    rect(p, 19 + Math.round(side * 2), bodyY + 3, 1, 15, col.dark); // couture du dos
  }

  // ---- Cou.
  rect(p, 17, bodyY - 3, 6, 3, away ? C.hairDark : C.skinShade);

  // ---- Tête.
  const headY = 5 + bob;
  const headX = 12 + Math.round(side * (profile ? 1 : 0));
  blobO(p, headX, headY, 16, 16, C.skin, 3);
  rect(p, headX + 13, headY + 3, 2, 11, C.skinShade); // joue dans l'ombre
  rect(p, headX + 2, headY + 14, 12, 1, C.skinShade); // menton
  if (away) {
    // Dos : chevelure complète.
    blobO(p, headX - 1, headY - 2, 18, 17, C.hair, 3);
    rect(p, headX + 1, headY - 1, 14, 2, C.hairLight);
    rect(p, headX + 2, headY + 12, 12, 2, C.hairDark);
  } else {
    // Calotte, frange et mèches latérales.
    blobO(p, headX - 1, headY - 2, 18, 7, C.hair, 3);
    rect(p, headX + 1, headY - 1, 13, 1, C.hairLight);
    const fx = headX + 1 + Math.round(side * 2);
    rect(p, fx, headY + 5, 5, 2, C.hair); // mèche de frange
    rect(p, fx + 7, headY + 5, 3, 1, C.hair);
    rect(p, fx + 2, headY + 7, 2, 1, C.hairDark);
    rect(p, headX - 1, headY + 4, 2, 7, C.hair); // mèches latérales
    rect(p, headX + 15, headY + 4, 2, 7, C.hair);
    if (profile) {
      // Profil : la chevelure couvre l'arrière du crâne.
      const backX = side > 0 ? headX - 1 : headX + 11;
      rect(p, backX, headY + 4, 6, 10, C.hair);
      rect(p, backX + (side > 0 ? 0 : 5), headY + 4, 1, 10, C.hairDark);
    }
    rect(p, headX + 1, headY + 6, 14, 1, C.skinShade); // ombre de la frange
    // Yeux, bouche.
    if (pose.ko === 1) {
      const ex = headX + 3 + Math.max(0, side) * 2;
      rect(p, ex, headY + 8, 1, 1, C.eye);
      rect(p, ex + 1, headY + 9, 1, 1, C.eye);
      rect(p, ex + 1, headY + 8, 1, 1, C.eye);
      rect(p, ex, headY + 9, 1, 1, C.eye);
      rect(p, ex + 8, headY + 8, 2, 2, C.eye);
      rect(p, headX + 7, headY + 12, 2, 2, C.mouth);
    } else if (profile) {
      const ex = side > 0 ? headX + 11 : headX + 3;
      rect(p, ex, headY + 8, 2, 3, C.eye);
      rect(p, side > 0 ? headX + 16 : headX - 1, headY + 10, 1, 2, C.skin); // nez
      rect(p, side > 0 ? headX + 12 : headX + 3, headY + 13, 2, 1, C.mouth);
    } else {
      const ex = headX + 3 + Math.round(side * 2.5);
      rect(p, ex, headY + 8, 2, 3, C.eye);
      rect(p, ex + 8, headY + 8, 2, 3, C.eye);
      rect(p, ex, headY + 8, 1, 1, '#ffffff');
      rect(p, ex + 8, headY + 8, 1, 1, '#ffffff');
      rect(p, headX + 7 + Math.round(side * 2), headY + 13, 3, 1, C.mouth);
    }
  }

  // ---- Coiffes des classes.
  if (cls === 'sprinteur') drawHeadband(p, headX, headY, side, away);
  else if (cls === 'infirmier') drawNurseCap(p, headX, headY, away);

  // ---- Bras avant / coup de poing.
  if (pose.punch === 0) {
    const dy = side > 0 ? pose.armR : pose.armL;
    drawArm(frontArmX, dy, side > 0);
    // Infirmier : trousse de soin blanche à croix rouge, tenue à la main.
    if (cls === 'infirmier') drawKit(p, frontArmX - 2, shoulderY + dy + 16);
  } else {
    const sx = side === 0 ? 1 : side;
    const shx = side >= 0 ? 30 : 6; // épaule côté avant
    let fx: number;
    let fy: number;
    if (profile) {
      fx = side > 0 ? 36 : -1;
      fy = shoulderY + 4;
    } else if (front > 0) {
      fx = 18 + sx * 7;
      fy = shoulderY + 15;
    } else {
      fx = 18 + sx * 7;
      fy = shoulderY - 9;
    }
    if (pose.punch === 1) {
      thick(p, shx, shoulderY + 1, shx - sx * 4, shoulderY + 8, 4, col.main);
      blobO(p, shx - sx * 4, shoulderY + 10, 5, 5, C.skin, 1);
    } else if (pose.punch === 2) {
      thick(p, shx, shoulderY + 1, fx, fy, 4, col.main);
      blobO(p, fx - 1, fy - 1, 6, 6, C.skin, 1);
      rect(p, fx + sx * 6, fy - 3, 1, 1, C.star);
      rect(p, fx + sx * 7, fy + 1, 1, 1, C.star);
      rect(p, fx + sx * 6, fy + 5, 1, 1, C.star);
    } else {
      const hx = Math.round((shx + fx) / 2);
      const hy = Math.round((shoulderY + 1 + fy) / 2);
      thick(p, shx, shoulderY + 1, hx, hy, 4, col.main);
      blobO(p, hx, hy, 5, 5, C.skin, 1);
    }
  }
}

/** Bandeau rouge du sprinteur, avec ses deux pans qui flottent derrière la tête. */
function drawHeadband(p: Pen, headX: number, headY: number, side: number, away: boolean): void {
  rect(p, headX - 1, headY + 2, 18, 3, C.outline);
  rect(p, headX, headY + 3, 16, 1, C.band);
  rect(p, headX, headY + 2, 16, 1, C.band);
  const tx = away ? headX + 7 : side > 0 ? headX - 4 : side < 0 ? headX + 16 : -99;
  if (tx > -99) {
    rect(p, tx, headY + 3, 4, 2, C.band);
    rect(p, tx + (side > 0 ? -1 : 1), headY + 5, 3, 2, C.bandDark);
  }
}

/** Calot blanc à croix rouge de l'infirmier. */
function drawNurseCap(p: Pen, headX: number, headY: number, away: boolean): void {
  blobO(p, headX + 2, headY - 4, 12, 5, C.white, 1);
  rect(p, headX + 3, headY, 10, 1, C.whiteShade);
  if (!away) {
    rect(p, headX + 7, headY - 4, 2, 4, C.cross);
    rect(p, headX + 6, headY - 3, 4, 2, C.cross);
  }
}

/** Trousse de soin (11 × 8) : boîte blanche à grande croix rouge, lisible même dézoomée. */
function drawKit(p: Pen, x: number, y: number): void {
  rectO(p, x - 1, y, 11, 8, C.white);
  rect(p, x - 1, y + 7, 11, 1, C.whiteShade);
  rect(p, x + 3, y - 2, 3, 2, C.outline); // poignée
  rect(p, x + 3, y + 1, 3, 6, C.cross);
  rect(p, x + 1, y + 3, 7, 2, C.cross);
}

/** Élève KO assis par terre, jambes allongées devant lui. */
function drawSitting(p: Pen, team: number, side: number, front: number, stars: boolean, cls: UnitClass = 'eleve'): void {
  const col = TEAM_COLORS[team];
  const away = front < 0;
  const sx = side === 0 ? (front >= 0 ? 1 : -1) : side;
  // Jambes allongées vers le côté regardé.
  const legX = sx > 0 ? 17 : 6;
  rectO(p, legX, 47, 17, 5, C.trousers);
  rect(p, legX, 47, 17, 1, C.trousersLight);
  const shoeX = sx > 0 ? 32 : 2;
  rectO(p, shoeX, 46, 5, 8, C.shoes);
  rect(p, shoeX, 46, 5, 1, C.shoesLight);
  // Corps voûté.
  blobO(p, 11, 31, 18, 17, col.main, 2);
  rect(p, 12, 33, 3, 14, col.light);
  rect(p, 25, 33, 3, 14, col.dark);
  blobO(p, 14, 31, 12, 3, col.light, 1);
  if (!away) {
    const bx = 19 + Math.round(sx * 3);
    for (let i = 0; i < 3; i++) {
      rect(p, bx, 36 + i * 4, 2, 2, C.gold);
      rect(p, bx, 37 + i * 4, 2, 1, C.goldDark);
    }
  }
  // Bras ballants.
  rectO(p, 7, 33, 5, 13, col.main);
  rectO(p, 28, 33, 5, 13, col.main);
  rect(p, 7, 33, 1, 13, col.light);
  rect(p, 32, 33, 1, 13, col.dark);
  rectO(p, 8, 46, 3, 3, C.skin);
  rectO(p, 29, 46, 3, 3, C.skin);
  // Tête penchée vers l'avant.
  const hx = 12 + Math.round(sx * 2);
  const hy = 17;
  blobO(p, hx, hy, 16, 16, C.skin, 3);
  rect(p, hx + 13, hy + 3, 2, 11, C.skinShade);
  if (away) {
    blobO(p, hx - 1, hy - 2, 18, 17, C.hair, 3);
    rect(p, hx + 1, hy - 1, 14, 2, C.hairLight);
  } else {
    blobO(p, hx - 1, hy - 2, 18, 7, C.hair, 3);
    rect(p, hx + 1, hy - 1, 13, 1, C.hairLight);
    rect(p, hx + 1 + sx, hy + 5, 5, 2, C.hair);
    rect(p, hx + 8 + sx, hy + 5, 3, 1, C.hair);
    rect(p, hx - 1, hy + 4, 2, 7, C.hair);
    rect(p, hx + 15, hy + 4, 2, 7, C.hair);
    rect(p, hx + 1, hy + 6, 14, 1, C.skinShade);
    // Yeux fermés, bouche tombante.
    rect(p, hx + 3, hy + 10, 3, 1, C.eye);
    rect(p, hx + 10, hy + 10, 3, 1, C.eye);
    rect(p, hx + 7, hy + 13, 3, 1, C.mouth);
  }
  if (cls === 'sprinteur') drawHeadband(p, hx, hy, sx, away);
  else if (cls === 'infirmier') drawNurseCap(p, hx, hy, away);
  if (stars) {
    rect(p, hx - 3, hy - 5, 2, 2, C.star);
    rect(p, hx + 16, hy - 3, 2, 2, C.star);
    rect(p, hx + 6, hy - 8, 2, 2, C.star);
    rect(p, hx + 12, hy - 7, 1, 1, C.star);
  }
}

export type SheetCanvas = HTMLCanvasElement | OffscreenCanvas;

/** Construit la planche de sprites d'une équipe (8 lignes × 11 colonnes). */
export function buildSheet(team: number, makeCanvas: (w: number, h: number) => SheetCanvas, cls: UnitClass = 'eleve'): SheetCanvas {
  const sheet = makeCanvas(FRAME_W * FRAMES_PER_DIR, FRAME_H * 8);
  const ctx = sheet.getContext('2d') as Ctx;
  ctx.imageSmoothingEnabled = false;
  for (let d = 0; d < 8; d++) {
    for (let f = 0; f < FRAMES_PER_DIR; f++) {
      drawStudent(ctx, f * FRAME_W, d * FRAME_H, team, d as Dir, poseFor(f), cls);
    }
  }
  return sheet;
}
