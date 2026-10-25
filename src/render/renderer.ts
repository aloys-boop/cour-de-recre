import { TEAM_COLORS, TEAM_TILE_COLORS, TUNING } from '../config';
import { gridToScreen, TILE_H, TILE_W } from '../core/math';
import type { Tile } from '../core/tile';
import { NO_TEAM, type Vec2 } from '../core/types';
import type { Unit } from '../core/unit';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { buildSheet, FRAME_H, FRAME_W, frameFor, type SheetCanvas } from './sprites';
import { drawSuit, SUIT_COLORS } from './suits';

export interface Marker {
  x: number; // grille
  y: number;
  t: number; // âge en secondes
  kind: 'move' | 'attack' | 'hit' | 'capture';
  team: number;
}

export interface SelectionBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const COLORS = {
  void: '#16234a',
  voidLight: '#1d2d5c',
  floor: '#d9d9de',
  floorEdge: '#9a9aa6',
  floorSide: '#8d8d9a',
  tileNeutral: '#ffffff',
  tileLine: '#b5b5c0',
  obstacleTop: '#5aa35a',
  obstacleSide: '#8c8c99',
  obstacleSideDark: '#6b6b78',
};

/** Rendu canvas 2D de la partie. */
export class Renderer {
  readonly sheets: SheetCanvas[] = [];
  private floorPattern: CanvasPattern | null = null;

  constructor(
    private ctx: CanvasRenderingContext2D,
    makeCanvas: (w: number, h: number) => SheetCanvas,
  ) {
    for (let t = 0; t < 4; t++) this.sheets.push(buildSheet(t, makeCanvas));
    // Motif discret de points sur le sol (texture rétro).
    const pat = makeCanvas(16, 16);
    const pc = pat.getContext('2d') as CanvasRenderingContext2D;
    pc.fillStyle = COLORS.floor;
    pc.fillRect(0, 0, 16, 16);
    pc.fillStyle = '#cfcfd5';
    pc.fillRect(0, 0, 1, 1);
    pc.fillRect(8, 8, 1, 1);
    this.floorPattern = ctx.createPattern(pat as CanvasImageSource, 'repeat');
  }

  draw(
    world: World,
    cam: Camera,
    opts: {
      selected: Set<number>;
      markers: Marker[];
      box: SelectionBox | null;
      playerTeam: number;
      time: number;
    },
  ): void {
    const ctx = this.ctx;
    const W = cam.viewW;
    const H = cam.viewH;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Fond : le vide bleu foncé autour de la cour.
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, W, H);
    this.drawFloor(world, cam);
    this.drawTiles(world, cam, opts.time);
    this.drawMarkers(opts.markers, cam, 'floor');
    this.drawUnitsAndObstacles(world, cam, opts.selected, opts.playerTeam);
    this.drawMarkers(opts.markers, cam, 'air');
    if (opts.box) this.drawBox(opts.box);
    ctx.restore();
  }

  // ---------------------------------------------------------------- sol

  private diamondPath(cam: Camera, x0: number, y0: number, x1: number, y1: number): void {
    const ctx = this.ctx;
    const a = cam.gridToScreen(x0, y0);
    const b = cam.gridToScreen(x1, y0);
    const c = cam.gridToScreen(x1, y1);
    const d = cam.gridToScreen(x0, y1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  private drawFloor(world: World, cam: Camera): void {
    const ctx = this.ctx;
    const w = world.map.w;
    const h = world.map.h;
    const thick = 14 * cam.zoom;
    // Épaisseur du sol (faces visibles vers le bas).
    const b = cam.gridToScreen(w, 0);
    const c = cam.gridToScreen(w, h);
    const d = cam.gridToScreen(0, h);
    ctx.fillStyle = COLORS.floorSide;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x, c.y + thick);
    ctx.lineTo(d.x, d.y + thick);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.floorEdge;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + thick);
    ctx.lineTo(c.x, c.y + thick);
    ctx.closePath();
    ctx.fill();
    // Dessus.
    this.diamondPath(cam, 0, 0, w, h);
    ctx.fillStyle = this.floorPattern ?? COLORS.floor;
    ctx.fill();
    ctx.strokeStyle = COLORS.floorEdge;
    ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
    ctx.stroke();
    // Fines lignes de grille, visibles seulement en zoom rapproché.
    if (cam.zoom > 0.9) {
      ctx.strokeStyle = 'rgba(0,0,0,0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < w; x++) {
        const p = cam.gridToScreen(x, 0);
        const q = cam.gridToScreen(x, h);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      for (let y = 1; y < h; y++) {
        const p = cam.gridToScreen(0, y);
        const q = cam.gridToScreen(w, y);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
  }

  private drawTiles(world: World, cam: Camera, time: number): void {
    const ctx = this.ctx;
    for (const t of world.tiles) this.drawTile(world, t, cam, time, ctx);
  }

  private drawTile(world: World, t: Tile, cam: Camera, time: number, ctx: CanvasRenderingContext2D): void {
    const z = cam.zoom;
    const center = cam.gridToScreen(t.cx, t.cy);
    if (center.x < -80 * z || center.y < -80 * z || center.x > cam.viewW + 80 * z || center.y > cam.viewH + 80 * z) return;
    this.diamondPath(cam, t.x + 0.08, t.y + 0.08, t.x + 0.92, t.y + 0.92);
    const ownerColor = t.owner === NO_TEAM ? NO_TEAM : world.teamColors[t.owner];
    ctx.fillStyle = ownerColor === NO_TEAM ? COLORS.tileNeutral : TEAM_TILE_COLORS[ownerColor];
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.strokeStyle = ownerColor === NO_TEAM ? COLORS.tileLine : TEAM_COLORS[ownerColor].dark;
    ctx.stroke();
    if (t.contested) {
      ctx.save();
      ctx.setLineDash([4 * z, 3 * z]);
      ctx.lineDashOffset = -time * 20 * z;
      ctx.strokeStyle = '#ff5a3c';
      ctx.lineWidth = Math.max(1.5, 2 * z);
      ctx.stroke();
      ctx.restore();
    }
    // Symbole, légèrement aplati pour suivre la perspective iso.
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.scale(1, 0.62);
    const suitColor = ownerColor === NO_TEAM ? SUIT_COLORS[t.suit] : ownerColor === 2 ? '#2b2b33' : 'rgba(255,255,255,0.92)';
    drawSuit(ctx, t.suit, 0, 0, 22 * z, suitColor);
    ctx.restore();
    // Jauge de capture.
    if (t.cap > 0 && t.capTeam !== NO_TEAM) {
      const bw = 34 * z;
      const bh = Math.max(3, 4 * z);
      const bx = center.x - bw / 2;
      const by = center.y + 12 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = TEAM_COLORS[world.teamColors[t.capTeam]].ui;
      ctx.fillRect(bx, by, bw * t.cap, bh);
    }
  }

  private drawObstacle(o: Vec2, cam: Camera): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    {
      const h = 22 * z;
      const top = { x0: o.x + 0.12, y0: o.y + 0.12, x1: o.x + 0.88, y1: o.y + 0.88 };
      const a = cam.gridToScreen(top.x0, top.y0);
      const b = cam.gridToScreen(top.x1, top.y0);
      const c = cam.gridToScreen(top.x1, top.y1);
      const d = cam.gridToScreen(top.x0, top.y1);
      // Faces latérales (jardinière grise).
      ctx.fillStyle = COLORS.obstacleSideDark;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(c.x, c.y - h);
      ctx.lineTo(d.x, d.y - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COLORS.obstacleSide;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, b.y - h);
      ctx.lineTo(c.x, c.y - h);
      ctx.closePath();
      ctx.fill();
      // Dessus : buisson vert.
      ctx.fillStyle = COLORS.obstacleTop;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - h);
      ctx.lineTo(b.x, b.y - h);
      ctx.lineTo(c.x, c.y - h);
      ctx.lineTo(d.x, d.y - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7cc46f';
      ctx.beginPath();
      ctx.ellipse((a.x + c.x) / 2, (a.y + c.y) / 2 - h - 4 * z, 12 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e1e28';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- unités

  /** Unités et obstacles triés ensemble par profondeur (x + y) pour un recouvrement correct. */
  private drawUnitsAndObstacles(world: World, cam: Camera, selected: Set<number>, playerTeam: number): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    type Item = { depth: number; unit?: Unit; obstacle?: Vec2 };
    const items: Item[] = [];
    for (const u of world.units) items.push({ depth: u.x + u.y, unit: u });
    for (const o of world.map.obstacles ?? []) items.push({ depth: o.x + o.y + 1, obstacle: o });
    items.sort((a, b) => a.depth - b.depth);
    const margin = 60 * z;
    for (const it of items) {
      if (it.obstacle) {
        this.drawObstacle(it.obstacle, cam);
        continue;
      }
      const u = it.unit!;
      const p = cam.gridToScreen(u.x, u.y);
      if (p.x < -margin || p.y < -margin || p.x > cam.viewW + margin || p.y > cam.viewH + margin) continue;
      const fade = u.state === 'ko' ? Math.min(1, u.koTimer / 0.5) : 1;
      ctx.globalAlpha = fade;
      // Ombre.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 9 * z, 4.5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cercle de sélection.
      if (selected.has(u.id)) {
        ctx.strokeStyle = u.team === playerTeam ? '#ffffff' : '#ff6a4a';
        ctx.lineWidth = Math.max(1.5, 2 * z);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawSprite(u, world.teamColors[u.team], p, z);
      // Barre de vie.
      if (u.alive) {
        const bw = 16 * z;
        const bh = Math.max(2, 3 * z);
        const bx = p.x - bw / 2;
        const by = p.y - (FRAME_H + 4) * z;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        const r = u.hp / u.maxHp;
        ctx.fillStyle = r > 0.5 ? '#43d35a' : r > 0.25 ? '#f2c22e' : '#e5453c';
        ctx.fillRect(bx, by, bw * r, bh);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawSprite(u: Unit, color: number, p: Vec2, z: number): void {
    const sheet = this.sheets[color];
    const frame = frameFor(u.anim, u.animTime);
    const sx = frame * FRAME_W;
    const sy = u.dir * FRAME_H;
    const dw = FRAME_W * z;
    const dh = FRAME_H * z;
    this.ctx.drawImage(sheet as CanvasImageSource, sx, sy, FRAME_W, FRAME_H, Math.round(p.x - dw / 2), Math.round(p.y - 42 * z), dw, dh);
  }

  // ---------------------------------------------------------------- marqueurs

  private drawMarkers(markers: Marker[], cam: Camera, layer: 'floor' | 'air'): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    for (const m of markers) {
      const p = cam.gridToScreen(m.x, m.y);
      if (layer === 'floor' && (m.kind === 'move' || m.kind === 'attack' || m.kind === 'capture')) {
        const life = m.kind === 'capture' ? 0.9 : 0.7;
        const k = Math.min(1, m.t / life);
        const r = (m.kind === 'capture' ? 10 + 30 * k : 18 - 10 * k) * z;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = m.kind === 'attack' ? '#ff5a3c' : m.kind === 'capture' ? TEAM_COLORS[m.team].light : '#ffffff';
        ctx.lineWidth = Math.max(1.5, 2.5 * z);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (m.kind !== 'capture') {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 3 * z, 1.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (layer === 'air' && m.kind === 'hit') {
        const k = Math.min(1, m.t / 0.22);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffe066';
        const s = (2 + 3 * k) * z;
        const cy = p.y - 26 * z;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + k * 2;
          const d = (4 + 8 * k) * z;
          ctx.fillRect(p.x + Math.cos(a) * d - s / 2, cy + Math.sin(a) * d * 0.6 - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawBox(b: SelectionBox): void {
    const ctx = this.ctx;
    const x = Math.min(b.x0, b.x1);
    const y = Math.min(b.y0, b.y1);
    const w = Math.abs(b.x1 - b.x0);
    const h = Math.abs(b.y1 - b.y0);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }
}

/** Position écran (zoom 1) d'une cellule, utile pour la mini-carte. */
export function tileScreenCenter(t: Tile): Vec2 {
  return gridToScreen(t.cx, t.cy);
}

export const ISO = { TILE_W, TILE_H, unitRadius: TUNING.unitRadius };
