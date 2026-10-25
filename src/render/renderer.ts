import { TEAM_COLORS } from '../config';
import type { Tile } from '../core/tile';
import { NO_TEAM, type Vec2 } from '../core/types';
import type { Unit } from '../core/unit';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { drawGoldenTile, drawStarvingBar } from './golden';
import { buildSheet, FEET_Y, FRAME_H, FRAME_W, frameFor, type SheetCanvas } from './sprites';
import { drawSuit } from './suits';
import { drawPunishedMark, drawSupervisor, lazySupervisorSheet, pushSupervisorItems } from './supervisors';
import type { Supervisor } from '../core/supervisors';
import { CHARGE_COLOR, drawHealHeart, drawRallies, drawSpadeAura, spadeAuraTeams } from './tactics';

export interface Marker {
  x: number; // grille
  y: number;
  t: number; // âge en secondes
  kind: 'move' | 'attack' | 'hit' | 'capture' | 'charge';
  team: number; // couleur d'uniforme
}

export interface SelectionBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const COLORS = {
  void: '#1c2d66',
  floor: '#d2d2d4',
  floorEdge: '#a9a9ae',
  floorSideLeft: '#8e8e95',
  floorSideRight: '#a2a2a9',
  tile: '#ffffff',
  tileEdge: '#c9c9cc',
  suitNeutral: '#8f8f94',
  obstacleTop: '#5aa35a',
  obstacleLeaf: '#7cc46f',
  obstacleSide: '#8c8c99',
  obstacleSideDark: '#6b6b78',
};

/** Rendu canvas 2D de la partie. */
export class Renderer {
  readonly sheets: SheetCanvas[] = [];
  private supSheet: () => SheetCanvas;

  constructor(
    private ctx: CanvasRenderingContext2D,
    makeCanvas: (w: number, h: number) => SheetCanvas,
  ) {
    for (let t = 0; t < TEAM_COLORS.length; t++) this.sheets.push(buildSheet(t, makeCanvas));
    this.supSheet = lazySupervisorSheet(makeCanvas);
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
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    this.drawFloor(world, cam);
    for (const t of world.tiles) this.drawTile(world, t, cam, opts.time);
    this.drawMarkers(opts.markers, cam, 'floor');
    drawRallies(ctx, world, cam, opts.playerTeam, opts.time);
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
    const thick = 16 * cam.zoom;
    const b = cam.gridToScreen(w, 0);
    const c = cam.gridToScreen(w, h);
    const d = cam.gridToScreen(0, h);
    // Épaisseur du sol (faces visibles vers le bas).
    ctx.fillStyle = COLORS.floorSideLeft;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x, c.y + thick);
    ctx.lineTo(d.x, d.y + thick);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.floorSideRight;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + thick);
    ctx.lineTo(c.x, c.y + thick);
    ctx.closePath();
    ctx.fill();
    // Dessus : gris clair uni.
    this.diamondPath(cam, 0, 0, w, h);
    ctx.fillStyle = COLORS.floor;
    ctx.fill();
    ctx.strokeStyle = COLORS.floorEdge;
    ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
    ctx.stroke();
  }

  private drawTile(world: World, t: Tile, cam: Camera, time: number): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    const center = cam.gridToScreen(t.cx, t.cy);
    const reach = 120 * z;
    if (center.x < -reach || center.y < -reach || center.x > cam.viewW + reach || center.y > cam.viewH + reach) return;
    const ownerColor = t.owner === NO_TEAM ? NO_TEAM : world.teamColors[t.owner];
    const inset = t.isCamp ? 0.06 : 0.1;
    this.diamondPath(cam, t.x + inset, t.y + inset, t.x + t.size - inset, t.y + t.size - inset);
    if (t.isCamp) {
      // Camp : zone plate de la couleur de l'équipe.
      ctx.fillStyle = ownerColor === NO_TEAM ? '#bdbdc2' : TEAM_COLORS[ownerColor].main;
      ctx.fill();
      ctx.strokeStyle = ownerColor === NO_TEAM ? COLORS.floorEdge : TEAM_COLORS[ownerColor].dark;
      ctx.lineWidth = Math.max(1, 2 * z);
      ctx.stroke();
      // Liseré clair intérieur.
      this.diamondPath(cam, t.x + 0.22, t.y + 0.22, t.x + t.size - 0.22, t.y + t.size - 0.22);
      ctx.strokeStyle = ownerColor === NO_TEAM ? '#d8d8dc' : TEAM_COLORS[ownerColor].light;
      ctx.lineWidth = Math.max(1, 1.2 * z);
      ctx.stroke();
    } else {
      // Case bonus : blanche, avec un grand symbole gris qui prend la couleur du propriétaire.
      ctx.fillStyle = COLORS.tile;
      ctx.fill();
      ctx.strokeStyle = COLORS.tileEdge;
      ctx.lineWidth = Math.max(1, 1 * z);
      ctx.stroke();
      if (t.suit) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.scale(1, 0.5);
        const color = ownerColor === NO_TEAM ? COLORS.suitNeutral : TEAM_COLORS[ownerColor].main;
        drawSuit(ctx, t.suit, 0, 0, 48 * z, color);
        ctx.restore();
      }
    }
    if (t.contested) {
      ctx.save();
      this.diamondPath(cam, t.x + inset, t.y + inset, t.x + t.size - inset, t.y + t.size - inset);
      ctx.setLineDash([5 * z, 4 * z]);
      ctx.lineDashOffset = -time * 24 * z;
      ctx.strokeStyle = '#ff4d3a';
      ctx.lineWidth = Math.max(1.5, 2.5 * z);
      ctx.stroke();
      ctx.restore();
    }
    drawGoldenTile(ctx, world, t, cam, time);
    // Jauge de capture.
    if (t.cap > 0 && t.capTeam !== NO_TEAM) {
      const bw = (t.isCamp ? 56 : 40) * z;
      const bh = Math.max(3, 4 * z);
      const bx = center.x - bw / 2;
      const by = center.y + (t.isCamp ? 26 : 14) * z;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = TEAM_COLORS[world.teamColors[t.capTeam]].ui;
      ctx.fillRect(bx, by, bw * t.cap, bh);
    }
  }

  private drawObstacle(o: Vec2, cam: Camera): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    const h = 26 * z;
    const a = cam.gridToScreen(o.x + 0.12, o.y + 0.12);
    const b = cam.gridToScreen(o.x + 0.88, o.y + 0.12);
    const c = cam.gridToScreen(o.x + 0.88, o.y + 0.88);
    const d = cam.gridToScreen(o.x + 0.12, o.y + 0.88);
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
    ctx.fillStyle = COLORS.obstacleTop;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - h);
    ctx.lineTo(b.x, b.y - h);
    ctx.lineTo(c.x, c.y - h);
    ctx.lineTo(d.x, d.y - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.obstacleLeaf;
    ctx.beginPath();
    ctx.ellipse((a.x + c.x) / 2, (a.y + c.y) / 2 - h - 5 * z, 15 * z, 8 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e1e28';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ---------------------------------------------------------------- unités

  /** Unités et obstacles triés ensemble par profondeur (x + y) pour un recouvrement correct. */
  private drawUnitsAndObstacles(world: World, cam: Camera, selected: Set<number>, playerTeam: number): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    type Item = { depth: number; unit?: Unit; obstacle?: Vec2; sup?: Supervisor };
    const items: Item[] = [];
    for (const u of world.units) items.push({ depth: u.x + u.y, unit: u });
    for (const o of world.map.obstacles ?? []) items.push({ depth: o.x + o.y + 1, obstacle: o });
    pushSupervisorItems(world, items);
    items.sort((a, b) => a.depth - b.depth);
    const margin = 80 * z;
    const aura = spadeAuraTeams(world);
    for (const it of items) {
      if (it.obstacle) {
        this.drawObstacle(it.obstacle, cam);
        continue;
      }
      if (it.sup) {
        drawSupervisor(ctx, this.supSheet(), it.sup, cam);
        continue;
      }
      const u = it.unit!;
      const p = cam.gridToScreen(u.x, u.y);
      if (p.x < -margin || p.y < -margin || p.x > cam.viewW + margin || p.y > cam.viewH + margin) continue;
      const fade = u.state === 'ko' ? Math.min(1, u.koTimer / 0.5) : 1;
      ctx.globalAlpha = fade;
      if (aura[u.team] && u.alive) drawSpadeAura(ctx, p, z);
      // Ombre portée, décalée vers le bas-droite comme dans les rendus 3D d'époque.
      ctx.fillStyle = 'rgba(20,20,30,0.42)';
      ctx.beginPath();
      ctx.ellipse(p.x + 4 * z, p.y + 1 * z, 13 * z, 6 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      if (selected.has(u.id)) {
        ctx.strokeStyle = u.team === playerTeam ? '#ffffff' : '#ff6a4a';
        ctx.lineWidth = Math.max(1.5, 2 * z);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 15 * z, 7.5 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawSprite(u, world.teamColors[u.team], p, z);
      // Barre de vie : fine ligne verte au-dessus de la tête.
      if (u.alive) {
        const bw = 22 * z;
        const bh = Math.max(2, 2.5 * z);
        const bx = p.x - bw / 2;
        const by = p.y - (FEET_Y + 6) * z;
        const ally = u.team !== playerTeam && world.isAllied(u.team, playerTeam);
        // Allié du joueur : cadre bleuté autour de la barre et petit losange à gauche.
        ctx.fillStyle = ally ? 'rgba(40,120,200,0.85)' : 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        if (ally) drawAllyDiamond(ctx, bx - 4 * z, by + bh / 2, z);
        const r = u.hp / u.maxHp;
        ctx.fillStyle = r > 0.5 ? '#3ee05a' : r > 0.25 ? '#f2c22e' : '#e5453c';
        ctx.fillRect(bx, by, bw * r, bh);
        drawHealHeart(ctx, u, p, z, world.time);
        drawPunishedMark(ctx, u, p, z, world.time);
        drawStarvingBar(ctx, world, u.team, bx, by, bw, bh);
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
    this.ctx.drawImage(sheet as CanvasImageSource, sx, sy, FRAME_W, FRAME_H, Math.round(p.x - dw / 2), Math.round(p.y - FEET_Y * z), dw, dh);
  }

  // ---------------------------------------------------------------- marqueurs

  private drawMarkers(markers: Marker[], cam: Camera, layer: 'floor' | 'air'): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    for (const m of markers) {
      const p = cam.gridToScreen(m.x, m.y);
      if (layer === 'floor' && (m.kind === 'move' || m.kind === 'charge' || m.kind === 'attack' || m.kind === 'capture')) {
        const life = m.kind === 'capture' ? 0.9 : 0.7;
        const k = Math.min(1, m.t / life);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = m.kind === 'attack' ? '#ff3b2f' : m.kind === 'capture' ? TEAM_COLORS[m.team].light : m.kind === 'charge' ? CHARGE_COLOR : '#ffffff';
        ctx.lineWidth = Math.max(1.5, 2.5 * z);
        // Losange au sol (dans le plan iso), qui se resserre sur la cible.
        const r = (m.kind === 'capture' ? 0.4 + 1.2 * k : 0.9 - 0.45 * k) * (z * 40);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r / 2);
        ctx.lineTo(p.x + r, p.y);
        ctx.lineTo(p.x, p.y + r / 2);
        ctx.lineTo(p.x - r, p.y);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (layer === 'air' && m.kind === 'hit') {
        const k = Math.min(1, m.t / 0.22);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffe066';
        const s = (2 + 3 * k) * z;
        const cy = p.y - 34 * z;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + k * 2;
          const d = (5 + 9 * k) * z;
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
    ctx.fillStyle = 'rgba(120,220,120,0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(90,230,90,0.95)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }
}

/** Petit losange bleu clair qui distingue les élèves alliés des ennemis. */
export function drawAllyDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, z: number): void {
  const r = Math.max(2.5, 3.2 * z);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.8, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.8, y);
  ctx.closePath();
  ctx.fillStyle = '#9fdcff';
  ctx.fill();
  ctx.strokeStyle = '#0d2a40';
  ctx.lineWidth = Math.max(1, 0.9 * z);
  ctx.stroke();
}
