import { TEAM_COLORS, TUNING } from '../config';
import { impactPose, koStars, type ImpactPose } from '../core/impact';
import type { Tile } from '../core/tile';
import { NO_TEAM, type Vec2 } from '../core/types';
import { TILE_H, TILE_W } from '../core/math';
import type { Unit } from '../core/unit';
import type { World } from '../core/world';
import type { Camera } from './camera';
import { drawGuardBadge, drawGuardZone } from './garrison';
import { drawDefenceAir, drawDefenceFloor, type DefenceView } from './defence';
import { drawEscorts, type EscortLink } from './escort';
import { drawGoldenTile, drawStarvingBar } from './golden';
import { drawGhostCamp } from './ghost';
import { drawThroneTile } from './king';
import { buildSheet, FEET_Y, FRAME_H, FRAME_W, frameFor, type SheetCanvas } from './sprites';
import { drawSuit } from './suits';
import { drawCampEmblem, drawTileEmblem, TeamRings, UnitEmblems, drawEmblem } from './emblems';
import { bonusTileFill, emblemFor, inkOn } from '../core/emblems';
import { buildPionSheet, drawSupervisor, drawSupervisorBar, lazySupervisorSheet, pionFrame, pushSupervisorItems } from './supervisors';
import { drawFrozenMark } from './powers';
import { SUPERVISOR_SCALE } from '../core/supervisors';
import { PION } from '../core/pion';
import type { Supervisor } from '../core/supervisors';
import { CHARGE_COLOR, drawHealHeart, drawRallies, drawConquests, drawReinforcements, drawSpadeAura, spadeAuraTeams } from './tactics';
import { tileView, unitVisible, pointVisible } from '../core/fog';
import { drawFog } from './fog';
import { TileImages } from './tile-images';
import { campPennants, drawPennant } from './merits';
import type { UnitClass } from '../core/classes';

/** Taille d'affichage des classes : le costaud est plus grand, le sprinteur un peu plus petit. */
export const CLASS_SCALE: Record<UnitClass, number> = { eleve: 1, costaud: 1.16, sprinteur: 0.94, infirmier: 1 };
import type { UpgradeBranch } from '../core/upgrades';

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
  private classSheets = new Map<string, SheetCanvas>();
  /** Équipe dont on montre le point de vue (brouillard de guerre). */
  private viewTeam = 0;
  /** Motifs d'équipe (v5.19, réglage « Lisibilité ») : un emblème par équipe en plus de sa couleur. */
  patterns = false;
  private unitEmblems: UnitEmblems;
  private teamRings: TeamRings;
  private supSheet: () => SheetCanvas;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private makeCanvas: (w: number, h: number) => SheetCanvas,
  ) {
    for (let t = 0; t < TEAM_COLORS.length; t++) this.sheets.push(buildSheet(t, makeCanvas));
    this.supSheet = lazySupervisorSheet(makeCanvas);
    this.unitEmblems = new UnitEmblems(makeCanvas as never);
    this.teamRings = new TeamRings(makeCanvas as never);
    this.tileImages = new TileImages(ctx, makeCanvas as never);
  }

  /** Fonds de cases en cache (v5.25). */
  readonly tileImages: TileImages;
  private readonly paintTile = (g: CanvasRenderingContext2D, c: Camera, t: Tile, owner: number): void => this.drawTileBase(g, c, t, owner);

  draw(
    world: World,
    cam: Camera,
    opts: {
      selected: Set<number>;
      markers: Marker[];
      box: SelectionBox | null;
      playerTeam: number;
      time: number;
      /** Camps dont on montre la ligne de ralliement (« all » : tous). */
      rallyLines?: Tile[] | 'all';
      /** Garnisons du joueur : nombre de gardes par case (écusson). */
      guards?: Map<Tile, number>;
      /** Cases dont on montre la zone défendue (gardes sélectionnés, ordre « Garder » armé). */
      guardZones?: Tile[];
      /** Renforts automatiques du joueur : camp → case secourue (pointillé à chevrons). */
      reinforcements?: { from: Tile; to: Tile }[];
      /** Escouades en conquête du joueur : centre et case visée. */
      conquests?: { from: Vec2; to: Tile; selected: boolean }[];
      /** Escouades en défense du joueur : secteur, poste, case secourue. */
      defences?: DefenceView[];
      /** Escortes du joueur (« Suivre ») : centre de l'escorte et centre du protégé. */
      escorts?: EscortLink[];
    },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    this.viewTeam = opts.playerTeam;
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    this.drawFloor(world, cam);
    this.tileImages.begin(cam.zoom);
    for (const t of world.tiles) this.drawTile(world, t, cam, opts.time);
    const myColor = world.teamColors[opts.playerTeam];
    if (opts.guardZones) for (const t of opts.guardZones) drawGuardZone(ctx, cam, t, myColor, opts.time);
    if (opts.defences) drawDefenceFloor(ctx, cam, opts.defences, myColor, opts.time);
    this.drawMarkers(opts.markers, cam, 'floor');
    this.drawUnitsAndObstacles(world, cam, opts.selected, opts.playerTeam);
    // Drapeaux de ralliement par-dessus les élèves : ceux qui s'y rassemblent ne les cachent pas.
    const lines = opts.rallyLines;
    drawRallies(ctx, world, cam, opts.playerTeam, opts.time, (c) => lines === 'all' || (!!lines && lines.includes(c)));
    if (opts.reinforcements) drawReinforcements(ctx, cam, opts.reinforcements, myColor, opts.time);
    if (opts.conquests) drawConquests(ctx, cam, opts.conquests, myColor, opts.time);
    if (opts.defences) drawDefenceAir(ctx, cam, opts.defences, myColor, opts.time);
    if (opts.escorts) drawEscorts(ctx, cam, opts.escorts, myColor, opts.time);
    drawFog(ctx, world, cam, opts.playerTeam, this.makeCanvas);
    for (const t of world.tiles) if (t.isCamp && t.owner !== NO_TEAM) this.drawCampBadge(world, t, cam);
    if (opts.guards) for (const [t, n] of opts.guards) drawGuardBadge(ctx, cam, t, n, myColor);
    this.drawMarkers(opts.markers, cam, 'air');
    if (opts.box) this.drawBox(opts.box);
    ctx.restore();
  }

  // ---------------------------------------------------------------- sol

  private diamondPath(cam: Camera, x0: number, y0: number, x1: number, y1: number, ctx: CanvasRenderingContext2D = this.ctx): void {
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
    const view = tileView(world, this.viewTeam, t);
    const ownerColor = view.owner === NO_TEAM ? NO_TEAM : world.teamColors[view.owner];
    const inset = t.isCamp ? 0.06 : 0.1;
    if (t.kind === 'throne') {
      this.diamondPath(cam, t.x + inset, t.y + inset, t.x + t.size - inset, t.y + t.size - inset);
      drawThroneTile(ctx, world, t, cam, time);
    } else {
      const img = this.tileImages.draw(t, ownerColor, this.patterns, center.x, center.y, this.paintTile);
      if (!img) this.drawTileBase(ctx, cam, t, ownerColor);
      // Camp fantôme (animé) : par-dessus le fond, jamais en cache.
      if (t.isCamp && t.ghost && t.owner === NO_TEAM) drawGhostCamp(ctx, cam, t, time);
    }
    if (t.contested && view.visible) {
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
    if (view.visible && t.cap > 0 && t.capTeam !== NO_TEAM) {
      const bw = (t.isCamp ? 56 : 40) * z;
      const bh = Math.max(3, 4 * z);
      const bx = center.x - bw / 2;
      const by = center.y + (t.isCamp ? 26 : 14) * z;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = TEAM_COLORS[world.teamColors[t.capTeam]].ui;
      ctx.fillRect(bx, by, bw * t.cap, bh);
      // Qui prend la case : son emblème au début de la jauge.
      if (this.patterns) {
        const c = world.teamColors[t.capTeam];
        drawEmblem(ctx, emblemFor(c), bx - 7 * z, by + bh / 2, Math.max(3, 5 * z), TEAM_COLORS[c].light, TEAM_COLORS[c].dark, Math.max(1, 1.2 * z));
      }
    }
  }

  /**
   * Fond immobile d'une case (camp ou case bonus) : losange, liserés, symbole, emblème. Il ne
   * change qu'avec le propriétaire, le zoom ou les motifs : dessiné une fois dans une petite
   * image (`TileImages`, v5.25), puis recopié à chaque image.
   */
  private drawTileBase(ctx: CanvasRenderingContext2D, cam: Camera, t: Tile, ownerColor: number): void {
    const z = cam.zoom;
    const inset = t.isCamp ? 0.06 : 0.1;
    this.diamondPath(cam, t.x + inset, t.y + inset, t.x + t.size - inset, t.y + t.size - inset, ctx);
    if (t.isCamp) {
      // Camp : zone plate de la couleur de l'équipe.
      ctx.fillStyle = ownerColor === NO_TEAM ? '#bdbdc2' : TEAM_COLORS[ownerColor].main;
      ctx.fill();
      ctx.strokeStyle = ownerColor === NO_TEAM ? COLORS.floorEdge : TEAM_COLORS[ownerColor].dark;
      ctx.lineWidth = Math.max(1, 2 * z);
      ctx.stroke();
      // Liseré clair intérieur.
      this.diamondPath(cam, t.x + 0.22, t.y + 0.22, t.x + t.size - 0.22, t.y + t.size - 0.22, ctx);
      ctx.strokeStyle = ownerColor === NO_TEAM ? '#d8d8dc' : TEAM_COLORS[ownerColor].light;
      ctx.lineWidth = Math.max(1, 1.2 * z);
      ctx.stroke();
      if (this.patterns && ownerColor !== NO_TEAM) drawCampEmblem(ctx, cam, t, ownerColor);
      return;
    }
    // Case bonus : blanche, avec un grand symbole gris qui prend la couleur du propriétaire ;
    // prise, son fond se teinte légèrement de l'équipe (v5.20), pour la lire même dézoomé.
    const tileBg = ownerColor === NO_TEAM ? COLORS.tile : bonusTileFill(TEAM_COLORS[ownerColor], COLORS.tile);
    ctx.fillStyle = tileBg;
    ctx.fill();
    ctx.strokeStyle = COLORS.tileEdge;
    ctx.lineWidth = Math.max(1, 1 * z);
    ctx.stroke();
    if (t.suit) {
      const center = cam.gridToScreen(t.cx, t.cy);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.scale(1, 0.5);
      // Encre contrastée (v5.19) : Jaune, Orange et Rose cernés de leur teinte sombre sur le blanc.
      const ink = ownerColor === NO_TEAM ? { fill: COLORS.suitNeutral, outline: null } : inkOn(tileBg, TEAM_COLORS[ownerColor]);
      drawSuit(ctx, t.suit, 0, 0, 48 * z, ink.fill, ink.outline ? { color: ink.outline, width: Math.max(1.5, 2.4 * z) } : undefined);
      ctx.restore();
    }
    if (this.patterns && ownerColor !== NO_TEAM) drawTileEmblem(ctx, cam, t, ownerColor);
  }

  /** Obstacle (bac à fleurs) : tous identiques, une seule image en cache par zoom (v5.25). */
  private drawObstacle(o: Vec2, cam: Camera): void {
    const z = cam.zoom;
    const p = cam.gridToScreen(o.x + 0.5, o.y + 0.5);
    if (this.tileImages.stamp('obstacle', p.x, p.y, o.x + 0.5, o.y + 0.5, (TILE_W / 2) * z + 6 * z + 4, (TILE_H / 2) * z + 48 * z + 4, this.paintObstacle, o, 0)) return;
    this.drawObstacleShape(this.ctx, o, cam);
  }

  private readonly paintObstacle = (g: CanvasRenderingContext2D, c: Camera, o: Vec2): void => this.drawObstacleShape(g, o, c);

  private drawObstacleShape(ctx: CanvasRenderingContext2D, o: Vec2, cam: Camera): void {
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

  /** Éléments à trier par profondeur, réutilisés d'une image à l'autre (aucune allocation par élève, v5.25). */
  private readonly items: DepthItem[] = [];
  private readonly unitItems: DepthItem[] = [];
  /** Barres de vie de l'image en cours, dessinées ensemble à la fin (v5.25). */
  private readonly bars: BarItem[] = [];
  private barCount = 0;
  /** Point de travail passé aux fonctions de dessin d'un élève (lu, jamais conservé). */
  private readonly pt: Vec2 = { x: 0, y: 0 };

  /**
   * Unités et obstacles triés ensemble par profondeur (x + y) pour un recouvrement correct.
   * Trois passages (v5.25) : d'abord tout ce qui est au sol sous les élèves (ombres, liserés,
   * auras, sélection), puis les corps triés par profondeur avec les obstacles, enfin les barres
   * de vie groupées par couleur (quelques remplissages au lieu de deux par élève), toujours
   * au-dessus des corps : une barre ne se cache plus derrière l'élève de devant.
   */
  private drawUnitsAndObstacles(world: World, cam: Camera, selected: Set<number>, playerTeam: number): void {
    const ctx = this.ctx;
    const z = cam.zoom;
    const items = this.items;
    items.length = 0;
    const margin = 80 * z;
    let n = 0;
    for (const u of world.units) {
      if (!unitVisible(world, playerTeam, u)) continue;
      const p = cam.gridToScreen(u.x, u.y);
      if (p.x < -margin || p.y < -margin || p.x > cam.viewW + margin || p.y > cam.viewH + margin) continue;
      let it = this.unitItems[n];
      if (!it) this.unitItems[n] = it = { depth: 0, px: 0, py: 0 };
      n++;
      it.depth = u.x + u.y;
      it.unit = u;
      it.px = p.x;
      it.py = p.y;
      items.push(it);
    }
    for (const o of world.map.obstacles ?? []) items.push({ depth: o.x + o.y + 1, obstacle: o, px: 0, py: 0 });
    // Fanions d'amélioration des camps (visibles seulement si le camp l'est).
    for (const t of world.tiles) if (t.isCamp && t.owner !== NO_TEAM && tileView(world, playerTeam, t).visible) for (const p of campPennants(t)) items.push({ depth: p.depth, pennant: p, px: 0, py: 0 });
    pushSupervisorItems(world, items as Array<{ depth: number; sup?: Supervisor }>);
    items.sort(byDepth);
    const aura = spadeAuraTeams(world);

    // 1. Au sol : ombres (image en cache), auras de pique, liserés d'équipe, cercles de sélection.
    const sh = this.shadow(z);
    const shw = sh.width / 2;
    const shh = sh.height / 2;
    for (const it of items) {
      const u = it.unit;
      if (!u) continue;
      const alive = u.alive;
      ctx.globalAlpha = alive ? 1 : Math.min(1, u.koTimer / 0.5);
      if (aura[u.team] && alive) drawSpadeAura(ctx, { x: it.px, y: it.py }, z);
      // Ombre portée, décalée vers le bas-droite comme dans les rendus 3D d'époque.
      ctx.drawImage(sh as CanvasImageSource, Math.round(it.px + 4 * z - shw), Math.round(it.py + 1 * z - shh));
      // Liseré d'équipe aux pieds (v5.20, motifs d'équipe) : démêle les mêlées serrées.
      if (this.patterns && alive) this.teamRings.draw(ctx, world.teamColors[u.team], it.px, it.py, z * (u.pion ? SUPERVISOR_SCALE : CLASS_SCALE[u.cls]));
      if (selected.size > 0 && selected.has(u.id)) {
        ctx.strokeStyle = u.team === playerTeam ? '#ffffff' : '#ff6a4a';
        ctx.lineWidth = Math.max(1.5, 2 * z);
        ctx.beginPath();
        ctx.ellipse(it.px, it.py, 15 * z, 7.5 * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // 2. Corps et obstacles, par profondeur.
    const shownSups: Supervisor[] = [];
    const bars = this.bars;
    let nb = 0;
    for (const it of items) {
      if (it.obstacle) {
        this.drawObstacle(it.obstacle, cam);
        continue;
      }
      if (it.pennant) {
        drawPennant(ctx, cam, it.pennant.x, it.pennant.y, it.pennant.branch, it.pennant.level);
        continue;
      }
      if (it.sup) {
        if (!pointVisible(world, playerTeam, it.sup.x, it.sup.y)) continue;
        drawSupervisor(ctx, this.supSheet(), it.sup, cam, world.time);
        shownSups.push(it.sup);
        continue;
      }
      const u = it.unit!;
      const p = this.pt;
      p.x = it.px;
      p.y = it.py;
      const alive = u.alive;
      const scale = u.pion ? SUPERVISOR_SCALE : CLASS_SCALE[u.cls];
      ctx.globalAlpha = alive ? 1 : Math.min(1, u.koTimer / 0.5);
      const pose = impactPose(world.time, u.hitAt, u.hitDx, u.hitDy, !alive);
      if (u.pion) this.drawPion(u, world.teamColors[u.team], p, z, pose);
      else this.drawSprite(u, world.teamColors[u.team], p, z * scale, pose);
      if (!alive) drawKoStars(ctx, koStars(TUNING.koSeconds - u.koTimer, TUNING.koSeconds, u.id), p, z * scale);
      else if (u.frozenUntil > world.time) drawFrozenMark(ctx, u, p, z, world.time);
      if (alive) {
        let b = bars[nb];
        if (!b) bars[nb] = b = { unit: u, x: 0, y: 0, w: 0, h: 0, r: 0, ally: false, px: 0, py: 0 };
        nb++;
        b.unit = u;
        b.w = (u.pion ? 40 : 22) * z;
        b.h = Math.max(2, 2.5 * z);
        b.x = p.x - b.w / 2;
        b.y = p.y - (FEET_Y + 6) * z * scale;
        b.r = u.hp / u.maxHp;
        b.ally = u.team !== playerTeam && world.isAllied(u.team, playerTeam);
        b.px = p.x;
        b.py = p.y;
      }
    }
    ctx.globalAlpha = 1;
    this.barCount = nb;
    this.drawBars(world, z);
    for (const s of shownSups) drawSupervisorBar(ctx, s, cam);
  }

  /**
   * Barres de vie des élèves visibles : fine ligne verte au-dessus de la tête, sur un cadre sombre
   * (bleuté pour un allié du joueur, avec un petit losange à gauche). Les cadres puis les
   * remplissages sont groupés par couleur : cinq remplissages pour toute la cour.
   */
  private drawBars(world: World, z: number): void {
    const ctx = this.ctx;
    const n = this.barCount;
    if (n === 0) return;
    const bars = this.bars;
    for (let pass = 0; pass < 2; pass++) {
      const ally = pass === 1;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        const b = bars[i];
        if (b.ally !== ally) continue;
        ctx.rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
        any = true;
      }
      if (!any) continue;
      ctx.fillStyle = ally ? 'rgba(40,120,200,0.85)' : 'rgba(0,0,0,0.5)';
      ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.ally) drawAllyDiamond(ctx, b.x - 4 * z, b.y + b.h / 2, z);
    }
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        const b = bars[i];
        if (barBand(b.r) !== band || b.r <= 0) continue;
        ctx.rect(b.x, b.y, b.w * b.r, b.h);
        any = true;
      }
      if (!any) continue;
      ctx.fillStyle = BAR_FILLS[band];
      ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const u = b.unit;
      if (this.patterns) this.unitEmblems.draw(ctx, world.teamColors[u.team], b.x + b.w + 5 * z, b.y + b.h / 2, z);
      if (u.healedAt >= 0) drawHealHeart(ctx, u, { x: b.px, y: b.py }, z, world.time);
      drawStarvingBar(ctx, world, u.team, b.x, b.y, b.w, b.h);
    }
  }

  private shadowCanvas: SheetCanvas | null = null;
  private shadowZoom = -1;

  /** Ombre d'un élève pré-dessinée au zoom courant : une copie d'image coûte bien moins qu'une ellipse remplie. */
  private shadow(z: number): SheetCanvas {
    if (this.shadowCanvas && Math.abs(this.shadowZoom - z) < 1e-3) return this.shadowCanvas;
    const w = Math.max(2, Math.ceil(26 * z) + 2);
    const h = Math.max(2, Math.ceil(12 * z) + 2);
    const c = this.makeCanvas(w, h);
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = 'rgba(20,20,30,0.42)';
    g.beginPath();
    g.ellipse(w / 2, h / 2, 13 * z, 6 * z, 0, 0, Math.PI * 2);
    g.fill();
    this.shadowCanvas = c;
    this.shadowZoom = z;
    return c;
  }

  /** Planche d'une couleur et d'une classe (les classes spéciales sont dessinées à la première apparition). */
  private sheetFor(color: number, cls: UnitClass): SheetCanvas {
    if (cls === 'eleve') return this.sheets[color];
    const key = `${color}:${cls}`;
    let s = this.classSheets.get(key);
    if (!s) {
      s = buildSheet(color, this.makeCanvas, cls);
      this.classSheets.set(key, s);
    }
    return s;
  }

  /**
   * Pastilles d'un camp, contre son coin gauche : type d'élève produit (petit élève de la
   * classe, aux couleurs du camp) et, s'il en a un, son pion (sifflet ; grisé avec la recharge
   * quand il est KO). Visibles pour tous les camps qu'on voit.
   */
  private drawCampBadge(world: World, t: Tile, cam: Camera): void {
    const view = tileView(world, this.viewTeam, t);
    if (!view.visible) return;
    const ctx = this.ctx;
    const z = Math.max(0.7, cam.zoom);
    // Contre le coin gauche (ouest) du camp, juste à l'extérieur : jamais sur les élèves qui y stationnent.
    const left = cam.gridToScreen(t.x, t.y + t.size);
    if (left.x < -60 || left.y < -40 || left.x > cam.viewW + 40 || left.y > cam.viewH + 40) return;
    const color = world.teamColors[t.owner];
    const r = 10 * z;
    const cx = left.x - r - 3 * z;
    const cy = left.y - r * 0.4;
    badgeCircle(ctx, cx, cy, r, TEAM_COLORS[color].ui);
    const sheet = this.sheetFor(color, t.produce);
    // L'élève de la classe en pied : carrure du costaud, bandeau du sprinteur, calot et trousse
    // de l'infirmier restent reconnaissables en tout petit.
    const s = (r * 1.9) / 54;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet as CanvasImageSource, 0, FRAME_H + 2, FRAME_W, 54, Math.round(cx - (FRAME_W * s) / 2), Math.round(cy - r * 0.95), FRAME_W * s, 54 * s);
    ctx.restore();
    if (!t.pionBought) return;
    const px = cx;
    const pyOff = r * 2.3;
    const up = world.units.some((u) => u.pion && u.home === t && u.alive);
    ctx.save();
    if (!up) ctx.globalAlpha = 0.55;
    badgeCircle(ctx, px, cy + pyOff, r, TEAM_COLORS[color].ui);
    drawWhistle(ctx, px, cy + pyOff, r);
    if (!up) {
      // Recharge du pion KO : arc qui se remplit jusqu'à son retour.
      const left = Math.max(0, t.pionRespawnAt - world.time);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = Math.max(2, 2.5 * z);
      ctx.beginPath();
      ctx.arc(px, cy + pyOff, r + 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left / PION.respawn));
      ctx.stroke();
    }
    ctx.restore();
  }

  private pionSheets = new Map<number, SheetCanvas>();

  /** Pion : l'adulte des surveillants, en blouse aux couleurs de l'équipe, 1,45 fois plus grand. */
  private drawPion(u: Unit, color: number, p: Vec2, z: number, pose: ImpactPose): void {
    let sheet = this.pionSheets.get(color);
    if (!sheet) {
      sheet = buildPionSheet(this.makeCanvas, TEAM_COLORS[color]);
      this.pionSheets.set(color, sheet);
    }
    const k = SUPERVISOR_SCALE * z;
    const dw = FRAME_W * k;
    const dh = FRAME_H * k;
    const frame = pionFrame(u.anim, u.animTime);
    // Un adulte encaisse : recul réduit, pas d'écrasement, mais l'éclair blanc reste.
    this.blit(sheet, frame * FRAME_W, u.dir * FRAME_H, p.x + pose.ox * 0.4 * z, p.y + pose.oy * 0.4 * z, dw, dh, FEET_Y * k, pose.flash);
  }

  private drawSprite(u: Unit, color: number, p: Vec2, z: number, pose: ImpactPose): void {
    const sheet = this.sheetFor(color, u.cls);
    const frame = frameFor(u.anim, u.animTime);
    const dw = FRAME_W * z * pose.sx;
    const dh = FRAME_H * z * pose.sy;
    this.blit(sheet, frame * FRAME_W, u.dir * FRAME_H, p.x + pose.ox * z, p.y + pose.oy * z, dw, dh, FEET_Y * z * pose.sy, pose.flash);
  }

  /** Copie une image de planche, pieds en (`x`, `y`), puis l'éclair blanc d'un coup reçu par-dessus (v5.17). */
  private blit(sheet: SheetCanvas, sx: number, sy: number, x: number, y: number, dw: number, dh: number, feet: number, flash: number): void {
    const ctx = this.ctx;
    const dx = Math.round(x - dw / 2);
    const dy = Math.round(y - feet);
    ctx.drawImage(sheet as CanvasImageSource, sx, sy, FRAME_W, FRAME_H, dx, dy, dw, dh);
    if (flash <= 0) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * flash * 0.9;
    ctx.drawImage(this.whiteOf(sheet) as CanvasImageSource, sx, sy, FRAME_W, FRAME_H, dx, dy, dw, dh);
    ctx.globalAlpha = prev;
  }

  private whiteSheets = new Map<SheetCanvas, SheetCanvas>();

  /** Silhouette blanche d'une planche (éclair d'impact), calculée une fois par planche. */
  private whiteOf(sheet: SheetCanvas): SheetCanvas {
    let w = this.whiteSheets.get(sheet);
    if (w) return w;
    w = this.makeCanvas(sheet.width, sheet.height);
    const g = w.getContext('2d') as CanvasRenderingContext2D | null;
    if (g) {
      g.drawImage(sheet as CanvasImageSource, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, sheet.width, sheet.height);
    }
    this.whiteSheets.set(sheet, w);
    return w;
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

/** Étoiles jaunes qui tournent au-dessus de la tête d'un élève KO (v5.17). */
function drawKoStars(ctx: CanvasRenderingContext2D, stars: ReturnType<typeof koStars>, p: Vec2, z: number): void {
  if (stars.length === 0) return;
  const prev = ctx.globalAlpha;
  const cy = p.y - 50 * z;
  const r = Math.max(5, 6.2 * z);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.2, 1.4 * z);
  ctx.strokeStyle = '#1b1b24';
  for (const s of stars) {
    // Celles de derrière, plus petites et plus pâles : la ronde se lit en relief.
    const k = s.front ? 1 : 0.75;
    ctx.globalAlpha = prev * s.alpha * (s.front ? 1 : 0.7);
    const x = p.x + s.dx * 1.6 * z;
    const y = cy + s.dy * 1.6 * z;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = (i % 2 === 0 ? r : r * 0.45) * k;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = s.front ? '#fff27a' : '#ffd84a';
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = prev;
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

/** Pastille ronde blanche cerclée à la couleur de l'équipe. */
function badgeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ring: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f1e8';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.strokeStyle = ring;
  ctx.stroke();
}

/** Sifflet argenté (pion) dans une pastille. */
function drawWhistle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const s = r / 10;
  ctx.fillStyle = '#c9d2dc';
  ctx.strokeStyle = '#3b4a5c';
  ctx.lineWidth = Math.max(1, 1.2 * s);
  ctx.beginPath();
  ctx.ellipse(x + 1.5 * s, y + 1 * s, 4.5 * s, 3.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(x - 6 * s, y - 2.6 * s, 5 * s, 3 * s);
  ctx.strokeRect(x - 6 * s, y - 2.6 * s, 5 * s, 3 * s);
  ctx.beginPath();
  ctx.arc(x + 1.5 * s, y + 1 * s, 1.3 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#3b4a5c';
  ctx.fill();
  ctx.strokeStyle = '#d8322a';
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 1 * s);
  ctx.quadraticCurveTo(x - 9 * s, y + 5 * s, x - 3 * s, y + 7 * s);
  ctx.stroke();
}

/** Élément trié par profondeur dans le dessin de la cour (un seul des champs facultatifs est rempli). */
interface DepthItem {
  depth: number;
  unit?: Unit;
  obstacle?: Vec2;
  sup?: Supervisor;
  pennant?: { x: number; y: number; branch: UpgradeBranch; level: number };
  /** Position à l'écran (élèves seulement). */
  px: number;
  py: number;
}

/** Barre de vie d'un élève, en attente du passage groupé. */
interface BarItem {
  unit: Unit;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Part de vie restante (0 à 1). */
  r: number;
  ally: boolean;
  px: number;
  py: number;
}

function byDepth(a: DepthItem, b: DepthItem): number {
  return a.depth - b.depth;
}

/** Couleurs de remplissage des barres de vie : plus de la moitié, plus du quart, le reste. */
const BAR_FILLS = ['#3ee05a', '#f2c22e', '#e5453c'] as const;

/** Tranche de couleur d'une barre de vie (0 vert, 1 jaune, 2 rouge), comme avant la v5.25. */
export function barBand(r: number): number {
  return r > 0.5 ? 0 : r > 0.25 ? 1 : 2;
}
