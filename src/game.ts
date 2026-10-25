import type { Sfx } from './audio/sfx';
import { TeamAi } from './core/ai';
import { GameStats } from './core/stats';
import { NO_TEAM, type Difficulty, type MapDef } from './core/types';
import type { Unit } from './core/unit';
import { World } from './core/world';
import { TouchInput } from './input/touch';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import { Minimap } from './render/minimap';
import { Renderer, type Marker, type SelectionBox } from './render/renderer';
import { FEET_Y } from './render/sprites';

export type GameResult = 'victoire' | 'defaite';

export interface GameOptions {
  map: MapDef;
  mapIndex: number;
  playerColor: number; // 0..3
  difficulty: Difficulty;
  seed?: number;
}

export interface GameHooks {
  onEnd(result: GameResult, opts: GameOptions): void;
  onPauseChange(paused: boolean): void;
  onHud(world: World, selectedCount: number): void;
}

const STEP = 1 / 60;

/** Une partie : simulation + rendu + entrées, pilotée par la boucle requestAnimationFrame. */
export class Game {
  readonly world: World;
  readonly cam = new Camera();
  readonly playerTeam = 0;
  readonly selected = new Set<number>();
  readonly stats = new GameStats();
  private fx = new Effects();
  private ais: TeamAi[] = [];
  private markers: Marker[] = [];
  private box: SelectionBox | null = null;
  private renderer: Renderer;
  private minimap: Minimap;
  private input: TouchInput;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudTimer = 0;
  private time = 0;
  paused = false;
  over = false;
  private dpr = 1;
  private ac = new AbortController();
  private endTimer = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement,
    private sfx: Sfx,
    readonly opts: GameOptions,
    private hooks: GameHooks,
  ) {
    // Le joueur est l'équipe 0 ; sa couleur est celle choisie, les autres suivent.
    const others = [0, 1, 2, 3].filter((c) => c !== opts.playerColor);
    this.world = new World(opts.map, opts.map.teams, opts.seed ?? (Date.now() % 100000), [opts.playerColor, ...others]);
    for (let t = 1; t < this.world.numTeams; t++) {
      const ai = new TeamAi(this.world, t, opts.difficulty);
      this.ais.push(ai);
      this.world.damageScale[t] = ai.profile.damage;
    }

    const ctx = canvas.getContext('2d', { alpha: false })!;
    this.renderer = new Renderer(ctx, (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    });
    this.minimap = new Minimap(minimapCanvas, 132, 76);
    this.minimap.setMap(opts.map.w, opts.map.h);
    this.cam.setMap(opts.map.w, opts.map.h);
    this.resize();
    this.cam.fit();
    // On cadre d'abord la base du joueur (ouest), puis on laisse voir toute la carte.
    this.cam.zoom = Math.min(this.cam.maxZoom, this.cam.zoom * 1.35);
    const home = this.world.tiles.find((t) => t.isCamp && t.owner === this.playerTeam);
    if (home) {
      // Entre la base du joueur et le centre de la cour, pour voir d'où l'on part.
      const cx = opts.map.w / 2;
      const cy = opts.map.h / 2;
      this.cam.centerOnGrid(home.cx + (cx - home.cx) * 0.45, home.cy + (cy - home.cy) * 0.45);
    }

    this.input = new TouchInput(canvas, {
      onTap: (x, y) => this.tap(x, y),
      onBoxStart: (x, y) => {
        this.box = { x0: x, y0: y, x1: x, y1: y };
      },
      onBoxMove: (x0, y0, x1, y1) => {
        this.box = { x0, y0, x1, y1 };
      },
      onBoxEnd: (x0, y0, x1, y1) => {
        this.box = null;
        this.boxSelect(x0, y0, x1, y1);
      },
      onPan: (dx, dy) => this.cam.pan(dx, dy),
      onPinch: (f, cx, cy) => this.cam.zoomAt(f, cx, cy),
    });

    minimapCanvas.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        const r = minimapCanvas.getBoundingClientRect();
        const g = this.minimap.toGrid(e.clientX - r.left, e.clientY - r.top);
        this.cam.centerOnGrid(g.x, g.y);
      },
      { signal: this.ac.signal },
    );
  }

  // ---------------------------------------------------------------- cycle de vie

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.cam.setView(w, h);
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  setPaused(p: boolean): void {
    if (this.over) return;
    if (this.paused === p) return;
    this.paused = p;
    this.last = performance.now();
    this.hooks.onPauseChange(p);
  }

  /** Une image de la boucle (publique pour les tests). */
  frame(now: number): void {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    if (!this.paused && !this.over) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 4) {
        this.step(STEP);
        this.acc -= STEP;
        steps++;
      }
      this.time += dt;
      this.fx.update(dt);
      for (const m of this.markers) m.t += dt;
      this.markers = this.markers.filter((m) => m.t < 1);
    }
    this.render();
  }

  private step(dt: number): void {
    const w = this.world;
    for (const ai of this.ais) ai.update(dt);
    w.update(dt);
    // Événements : sons et effets.
    for (const ev of w.drainEvents()) {
      const color = w.teamColors[ev.team];
      this.stats.record(ev);
      this.fx.onEvent(ev, this.cam);
      switch (ev.kind) {
        case 'punch':
          this.sfx.play('punch', color);
          break;
        case 'hit':
          this.sfx.play('hit', color);
          this.markers.push({ x: ev.x, y: ev.y, t: 0, kind: 'hit', team: color });
          break;
        case 'ko':
          this.sfx.play('ko', color);
          break;
        case 'captured':
          this.sfx.play(ev.camp ? 'victory' : 'capture');
          this.markers.push({ x: ev.x, y: ev.y, t: 0, kind: 'capture', team: color });
          break;
        case 'spawn':
          if (ev.team === this.playerTeam) this.sfx.play('spawn');
          break;
      }
    }
    // Nettoyage de la sélection.
    for (const id of this.selected) {
      const u = w.unitById(id);
      if (!u || !u.alive) this.selected.delete(id);
    }
    this.hudTimer += dt;
    if (this.hudTimer > 0.25) {
      this.hudTimer = 0;
      this.hooks.onHud(w, this.selected.size);
    }
    // Fin de partie.
    const winner = w.winner();
    const me = w.stats()[this.playerTeam];
    if (winner !== NO_TEAM || !me.alive) {
      this.over = true;
      const result: GameResult = winner === this.playerTeam ? 'victoire' : 'defaite';
      this.sfx.play(result === 'victoire' ? 'victory' : 'defeat');
      this.hooks.onHud(w, this.selected.size);
      this.endTimer = window.setTimeout(() => this.hooks.onEnd(result, this.opts), 900);
    }
  }

  private render(): void {
    const ctx = this.canvas.getContext('2d')!;
    this.fx.begin(ctx, this.dpr, this.canvas.width, this.canvas.height);
    this.renderer.draw(this.world, this.cam, {
      selected: this.selected,
      markers: this.markers,
      box: this.box,
      playerTeam: this.playerTeam,
      time: this.time,
    });
    this.fx.draw(ctx, this.cam);
    this.minimap.draw(this.world, this.cam);
  }

  // ---------------------------------------------------------------- entrées

  /** Élève sous un point de l'écran (zone tactile généreuse), ou null. */
  private unitAt(sx: number, sy: number): Unit | null {
    const z = this.cam.zoom;
    let best: Unit | null = null;
    let bestDepth = -Infinity;
    let nearest: Unit | null = null;
    let nearestD = 30 * Math.max(0.8, z);
    for (const u of this.world.units) {
      if (!u.alive) continue;
      const p = this.cam.gridToScreen(u.x, u.y);
      const inside = Math.abs(sx - p.x) <= 18 * z && sy >= p.y - (FEET_Y + 4) * z && sy <= p.y + 8 * z;
      const depth = u.x + u.y;
      if (inside && depth > bestDepth) {
        best = u;
        bestDepth = depth;
      }
      const d = Math.hypot(sx - p.x, sy - (p.y - 26 * z));
      if (d < nearestD) {
        nearestD = d;
        nearest = u;
      }
    }
    return best ?? nearest;
  }

  private tap(sx: number, sy: number): void {
    if (this.paused || this.over) return;
    this.sfx.unlock();
    const hit = this.unitAt(sx, sy);
    if (hit && hit.team === this.playerTeam) {
      // Sélection de l'élève et de ses voisins proches (tap sur un groupe).
      this.selected.clear();
      for (const u of this.world.units) {
        if (u.team !== this.playerTeam || !u.alive) continue;
        if (Math.hypot(u.x - hit.x, u.y - hit.y) <= 0.9) this.selected.add(u.id);
      }
      this.sfx.play('select');
      this.hooks.onHud(this.world, this.selected.size);
      return;
    }
    if (this.selected.size === 0) return;
    const units = this.selectedUnits();
    if (hit && hit.team !== this.playerTeam) {
      this.world.orderAttack(units, hit.id);
      this.markers.push({ x: hit.x, y: hit.y, t: 0, kind: 'attack', team: this.opts.playerColor });
      this.sfx.play('order');
      return;
    }
    const g = this.cam.screenToGrid(sx, sy);
    if (g.x < 0 || g.y < 0 || g.x >= this.world.map.w || g.y >= this.world.map.h) return;
    const target = this.world.grid.walkable(g.x, g.y) ? g : (() => {
      const c = this.world.grid.nearestFree(g.x, g.y);
      return { x: c.x + 0.5, y: c.y + 0.5 };
    })();
    this.world.orderMove(units, target);
    this.markers.push({ x: target.x, y: target.y, t: 0, kind: 'move', team: this.opts.playerColor });
    this.sfx.play('order');
  }

  private boxSelect(x0: number, y0: number, x1: number, y1: number): void {
    if (this.paused || this.over) return;
    const xa = Math.min(x0, x1);
    const xb = Math.max(x0, x1);
    const ya = Math.min(y0, y1);
    const yb = Math.max(y0, y1);
    const z = this.cam.zoom;
    this.selected.clear();
    for (const u of this.world.units) {
      if (u.team !== this.playerTeam || !u.alive) continue;
      const p = this.cam.gridToScreen(u.x, u.y);
      const cy = p.y - 26 * z;
      if (p.x >= xa - 6 && p.x <= xb + 6 && cy >= ya - 10 && cy <= yb + 10) this.selected.add(u.id);
    }
    if (this.selected.size) this.sfx.play('select');
    this.hooks.onHud(this.world, this.selected.size);
  }

  selectAll(): void {
    this.selected.clear();
    for (const u of this.world.units) if (u.team === this.playerTeam && u.alive) this.selected.add(u.id);
    if (this.selected.size) this.sfx.play('select');
    this.hooks.onHud(this.world, this.selected.size);
  }

  clearSelection(): void {
    this.selected.clear();
    this.hooks.onHud(this.world, 0);
  }

  private selectedUnits(): Unit[] {
    const out: Unit[] = [];
    for (const id of this.selected) {
      const u = this.world.unitById(id);
      if (u && u.alive) out.push(u);
    }
    return out;
  }

  destroy(): void {
    this.stop();
    clearTimeout(this.endTimer);
    this.input.destroy();
    this.ac.abort();
  }
}
