import { normalizeRules, type GameRules } from './core/rules';
import type { Sfx } from './audio/sfx';
import { TeamAi } from './core/ai';
import { GameStats } from './core/stats';
import type { Difficulty, MapDef } from './core/types';
import type { Tile } from './core/tile';
import type { Unit } from './core/unit';
import { World } from './core/world';
import { rhythmAnnouncement } from './core/events';
import { isKingMode, kingAnnouncement, withThrone } from './core/king';
import { Diplomacy, diploMessage, type BreakResult, type DiploView, type ProposeResult } from './core/diplomacy';
import { MAX_TEAMS } from './config';
import { DiplomacyExtras } from './core/diplomacy-extras';
import { TouchInput } from './input/touch';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import { Minimap } from './render/minimap';
import { Renderer, type Marker, type SelectionBox } from './render/renderer';
import { FEET_Y } from './render/sprites';
import { centroid, ControlGroups, DoubleTap, nearestOwnCamp, onScreen } from './core/controls';
import { drawArrow, type OrderArrow } from './render/arrow';
import { magnetTile, neighbourRadius, orderMoveExact, pickUnit, startFocus, startZoom, tileGoals, type AimTile, type PickResult } from './core/aim';
import { drawTileFlash, type TileFlash } from './render/aimfx';
import { eventPerceived, pointVisible, unitVisible } from './core/fog';
import { isSupervisor, supervisorActive, supervisorAnnouncement, supervisorsOf, takeWhistles, type Supervisor } from './core/supervisors';
import { teamPlural } from './core/diplomacy';
import { playWhistle } from './audio/whistle';
import { MeritPopups } from './render/merits';
import { buyUpgrade, type UpgradeBranch, type UpgradeResult } from './core/upgrades';
import { setProduce, type ProduceResult, type UnitClass } from './core/classes';
import { castPower, POWERS, powerCooldown, type PowerId, type PowerResult } from './core/powers';
import { buyPion, type PionResult } from './core/pion';
import { meritsOf } from './core/merits';
import { drawPowerAim, PowerEffects } from './render/powers';
import type { Vec2 } from './core/types';
import { TutorialState, type TutorialEvent } from './core/tutorial';

export type GameResult = 'victoire' | 'defaite';

/** Ce qu'un doigt peut viser : un élève, ou un surveillant (option « Surveillants »). */
type Target = Unit | Supervisor;

export interface GameOptions {
  map: MapDef;
  mapIndex: number;
  playerColor: number; // 0..7
  difficulty: Difficulty;
  seed?: number;
  /** Règles optionnelles (escarmouche). */
  rules?: GameRules;
  /** Partie guidée du tutoriel (IA passive jusqu'à la dernière étape). */
  tutorial?: boolean;
}

export interface GameHooks {
  onEnd(result: GameResult, opts: GameOptions): void;
  onPauseChange(paused: boolean): void;
  onHud(world: World, selectedCount: number): void;
  /** Point de ralliement posé (ou effacé) par le joueur. */
  onRally?(cleared: boolean): void;
  /** Annonce courte à afficher (case dorée, plus de camp, diplomatie…). */
  onAnnounce?(text: string): void;
  /** Tap sur un camp du joueur (sans sélection) : ouvrir son panneau d'amélioration. */
  onCampTap?(camp: Tile): void;
  /** Action du joueur, pour le tutoriel (sélection, ordre, achat…). */
  onAction?(action: PlayerAction): void;
  /** Tutoriel : étape franchie ou tutoriel terminé. */
  onTutorial?(ev: TutorialEvent): void;
  /** Appelé après chaque image dessinée (bulle et main du tutoriel). */
  onFrame?(): void;
}

/** Actions du joueur observées par le tutoriel. */
export type PlayerAction =
  | { kind: 'select'; count: number; box: boolean }
  | { kind: 'move'; count: number }
  | { kind: 'attack'; count: number }
  | { kind: 'rally' }
  | { kind: 'camera'; how: 'pan' | 'zoom' | 'minimap' }
  | { kind: 'campPanel' }
  | { kind: 'upgrade'; branch: UpgradeBranch }
  | { kind: 'power'; id: string }
  | { kind: 'class'; id: string }
  | { kind: 'pion' };

const STEP = 1 / 60;

/** Une partie : simulation + rendu + entrées, pilotée par la boucle requestAnimationFrame. */
export class Game {
  readonly world: World;
  readonly cam = new Camera();
  readonly playerTeam = 0;
  readonly selected = new Set<number>();
  readonly stats = new GameStats();
  /** Diplomatie : alliances pendant la partie (les IA jouent la leur). */
  readonly diplomacy: Diplomacy;
  /** Options de diplomatie (cadeaux, appel à l'aide, tribut) ; inertes si les options sont désactivées. */
  readonly extras: DiplomacyExtras;
  /** Équipes victorieuses à la fin de la partie (plusieurs : victoire d'une alliance). */
  victors: number[] = [];
  private importantUntil = 0;
  private fx = new Effects();
  /** Gains de bons points du joueur (« +10 ★ » qui s'envolent). */
  private gains = new MeritPopups();
  /** Tutoriel en cours (null hors tutoriel). */
  readonly tutorial: TutorialState | null = null;
  /** Effets des pouvoirs lancés. */
  private powerFx = new PowerEffects();
  /** Pouvoir armé par le joueur (visée en cours) et point visé (aperçu de la zone). */
  armedPower: PowerId | null = null;
  powerAim: Vec2 | null = null;
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
  /** Mode des ordres de déplacement du joueur : false = fuir (repli), true = charger. */
  charge = false;
  /** Défis : le camp de départ du joueur a-t-il été pris au moins une fois ? */
  homeCampLost = false;
  private homeCamp?: Tile;

  constructor(
    private canvas: HTMLCanvasElement,
    minimapCanvas: HTMLCanvasElement,
    private sfx: Sfx,
    readonly opts: GameOptions,
    private hooks: GameHooks,
  ) {
    // Le joueur est l'équipe 0 ; sa couleur est celle choisie, les autres suivent.
    const others = Array.from({ length: MAX_TEAMS }, (_, c) => c).filter((c) => c !== opts.playerColor);
    const seed = opts.seed ?? Date.now() % 100000;
    const rules = normalizeRules(opts.rules);
    // Roi de la cour : trône au centre (jamais en campagne : pas de règles passées).
    this.world = new World(isKingMode(rules) ? withThrone(opts.map) : opts.map, opts.map.teams, seed, [opts.playerColor, ...others]);
    this.world.rules = rules;
    for (let t = 1; t < this.world.numTeams; t++) {
      const ai = new TeamAi(this.world, t, opts.difficulty);
      this.ais.push(ai);
      this.world.damageScale[t] = ai.profile.damage;
    }
    this.diplomacy = new Diplomacy(
      this.world,
      opts.difficulty,
      this.ais.map((a) => a.team),
      seed,
    );
    this.extras = new DiplomacyExtras(this.world, this.diplomacy, this.playerTeam, seed);
    if (opts.tutorial) {
      this.tutorial = new TutorialState(this.world, this.playerTeam);
      // Adversaire ménagé : il frappe moins fort.
      for (let t = 1; t < this.world.numTeams; t++) this.world.damageScale[t] = 0.6;
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
    this.cam.zoom = startZoom(Math.min(this.cam.maxZoom, this.cam.zoom * 1.35), this.cam.maxZoom);
    const home = this.world.tiles.find((t) => t.isCamp && t.owner === this.playerTeam);
    this.homeCamp = home;
    if (home) {
      // Entre la base du joueur et le centre de la cour, pour voir d'où l'on part.
      const cx = opts.map.w / 2;
      const cy = opts.map.h / 2;
      const f = startFocus({ x: home.cx, y: home.cy }, { x: cx, y: cy }, this.cam.zoom, this.cam.viewW, this.cam.viewH);
      this.cam.centerOnGrid(f.x, f.y);
      // Tutoriel : la vue descend un peu pour laisser la bulle au-dessus des élèves.
      if (opts.tutorial) this.cam.pan(0, 70);
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
      onPan: (dx, dy) => {
        this.cam.pan(dx, dy);
        this.act({ kind: 'camera', how: 'pan' });
      },
      onPinch: (f, cx, cy) => {
        this.cam.zoomAt(f, cx, cy);
        this.act({ kind: 'camera', how: 'zoom' });
      },
      canArrowFrom: (x, y) => this.canArrowFrom(x, y),
      onArrowMove: (x0, y0, x1, y1) => this.arrowMove(x0, y0, x1, y1),
      onArrowEnd: (_x0, _y0, x1, y1) => this.arrowEnd(x1, y1),
      onArrowCancel: () => (this.arrow = this.flash = null),
      onLongPress: (x, y) => this.longPress(x, y),
    });

    minimapCanvas.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        const r = minimapCanvas.getBoundingClientRect();
        const g = this.minimap.toGrid(e.clientX - r.left, e.clientY - r.top);
        this.cam.centerOnGrid(g.x, g.y);
        this.act({ kind: 'camera', how: 'minimap' });
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
      this.gains.update(dt);
      this.powerFx.update(dt);
      for (const m of this.markers) m.t += dt;
      this.markers = this.markers.filter((m) => m.t < 1);
      if (this.flash && this.flash.t >= 0) this.flash.t += dt;
    }
    this.render();
  }

  private step(dt: number): void {
    const w = this.world;
    // Tutoriel : l'IA adverse reste passive jusqu'à la dernière étape.
    if (!this.tutorial || this.tutorial.aiActive) for (const ai of this.ais) ai.update(dt);
    w.update(dt);
    if (takeWhistles(w)) playWhistle(this.sfx);
    this.diplomacy.update(dt);
    // Événements : sons et effets.
    for (const ev of w.drainEvents()) {
      const color = w.teamColors[ev.team];
      this.stats.record(ev);
      this.diplomacy.record(ev);
      this.tutorial?.onWorldEvent(ev);
      if (!eventPerceived(w, this.playerTeam, ev)) continue; // brouillard : combat hors vue, ni son ni effet
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
        case 'power':
          this.powerFx.add(ev.id, ev.x, ev.y, ev.radius, ev.team);
          this.sfx.play(ev.id === 'sonnerie' ? 'bell' : ev.id === 'neige' ? 'snow' : 'snack');
          if (ev.team !== this.playerTeam && pointVisible(w, this.playerTeam, ev.x, ev.y)) {
            const who = teamPlural(w.teamColors[ev.team] ?? ev.team);
            const what = ev.id === 'sonnerie' ? 'font sonner la cloche' : ev.id === 'neige' ? 'lancent des boules de neige' : 'distribuent le goûter';
            this.announce(`${who.charAt(0).toUpperCase()}${who.slice(1)} ${what} !`, false);
          }
          break;
        case 'merit':
          if (ev.team === this.playerTeam) {
            this.gains.add(ev.x, ev.y, ev.amount);
            if (ev.reason !== 'ko') this.sfx.play('coin');
          }
          break;
        default:
          this.announce(
            rhythmAnnouncement(ev, this.playerTeam) ??
              kingAnnouncement(ev, this.playerTeam, w.teamColors) ??
              supervisorAnnouncement(ev, this.playerTeam, (t) => teamPlural(w.teamColors[t] ?? t)),
          );
          break;
      }
    }
    for (const ev of this.diplomacy.drainEvents()) {
      const m = diploMessage(ev, this.playerTeam, w.teamColors);
      if (m) this.announce(m.text, m.important);
    }
    this.extras.update(dt);
    if (this.tutorial) {
      this.tutorial.update();
      for (const ev of this.tutorial.drainEvents()) this.hooks.onTutorial?.(ev);
    }
    for (const m of this.extras.drainMessages()) this.announce(m.text, m.important);
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
    if (this.homeCamp && this.homeCamp.owner !== this.playerTeam) this.homeCampLost = true;
    // Fin de partie.
    const victors = w.victors();
    const me = w.stats()[this.playerTeam];
    if (victors.length > 0 || !me.alive) {
      this.over = true;
      this.victors = victors;
      const result: GameResult = me.alive && victors.includes(this.playerTeam) ? 'victoire' : 'defaite';
      if (this.tutorial && result === 'victoire') {
        this.tutorial.onVictory();
        for (const ev of this.tutorial.drainEvents()) this.hooks.onTutorial?.(ev);
      }
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
    if (this.flash) drawTileFlash(ctx, this.cam, this.flash);
    if (this.armedPower && this.powerAim) drawPowerAim(ctx, this.cam, this.world, this.armedPower, this.powerAim, this.playerTeam, this.time, false);
    this.powerFx.draw(ctx, this.cam);
    if (this.arrow) drawArrow(ctx, this.arrow);
    this.fx.draw(ctx, this.cam);
    this.gains.draw(ctx, this.cam);
    this.minimap.draw(this.world, this.cam);
    this.hooks.onFrame?.();
  }

  /** Action du joueur : transmise au tutoriel et aux observateurs. */
  private act(a: PlayerAction): void {
    if (this.tutorial) {
      this.tutorial.onAction(a);
      for (const ev of this.tutorial.drainEvents()) this.hooks.onTutorial?.(ev);
    }
    this.hooks.onAction?.(a);
  }

  // ---------------------------------------------------------------- entrées

  /** Élève (ou surveillant) sous un point de l'écran (zone tactile généreuse), ou null. */
  private unitAt(sx: number, sy: number): Target | null {
    return this.pick(sx, sy)?.unit ?? null;
  }

  /**
   * Élève visé par le doigt (voir pickUnit) : rayon généreux, priorités selon la sélection.
   * Les surveillants debout et visibles comptent comme des ennemis.
   */
  private pick(sx: number, sy: number): PickResult<Target> | null {
    const cands: Array<{ unit: Target; team: number; sx: number; sy: number; depth: number }> = [];
    for (const u of this.world.units) {
      if (!u.alive || !unitVisible(this.world, this.playerTeam, u)) continue;
      if (u.pion && this.world.isFriend(u.team, this.playerTeam)) continue; // ton pion (ou celui d'un allié) ne se commande pas
      const p = this.cam.gridToScreen(u.x, u.y);
      cands.push({ unit: u, team: u.team, sx: p.x, sy: p.y, depth: u.x + u.y });
    }
    for (const s of supervisorsOf(this.world)) {
      if (!supervisorActive(s) || !pointVisible(this.world, this.playerTeam, s.x, s.y)) continue;
      const p = this.cam.gridToScreen(s.x, s.y);
      cands.push({ unit: s, team: s.team, sx: p.x, sy: p.y, depth: s.x + s.y });
    }
    return pickUnit(cands, sx, sy, this.cam.zoom, this.playerTeam, this.selected.size > 0, FEET_Y);
  }

  /** Ordre d'attaque de la sélection contre un élève ennemi ou un surveillant. */
  private attack(units: Unit[], hit: Target): void {
    if (isSupervisor(hit)) this.world.orderAttackSupervisor(units, hit);
    else this.world.orderAttack(units, hit.id);
    this.markers.push({ x: hit.x, y: hit.y, t: 0, kind: 'attack', team: this.opts.playerColor });
    this.sfx.play('order');
    this.act({ kind: 'attack', count: units.length });
  }

  private tap(sx: number, sy: number): void {
    if (this.paused || this.over) return;
    this.sfx.unlock();
    if (this.armedPower) return this.aimPower(sx, sy);
    const pk = this.pick(sx, sy);
    // Sans sélection, un tap sur un de ses camps ouvre son panneau d'amélioration, sauf si le doigt
    // est vraiment sur un élève (silhouette touchée) : il est alors sélectionné.
    if (this.selected.size === 0 && !(pk && pk.direct)) {
      const camp = this.ownCampAt(sx, sy);
      if (camp) return this.openCamp(camp);
    }
    // Avec une sélection, un tap à côté (pas sur) de ses élèves mais visant une case donne l'ordre.
    const hit = pk && (pk.direct || pk.unit.team !== this.playerTeam || !this.selected.size || !this.aimTile(sx, sy)) ? pk.unit : null;
    const dbl = this.unitTaps.hit(performance.now(), hit && hit.team === this.playerTeam ? 'own' : 'other', { x: sx, y: sy });
    if (dbl && hit && hit.team === this.playerTeam) return this.selectVisible();
    if (hit && hit.team === this.playerTeam) {
      // Sélection de l'élève et de ses voisins proches (tap sur un groupe).
      this.selected.clear();
      for (const u of this.world.units) {
        if (u.team !== this.playerTeam || !u.alive || u.pion) continue;
        if (Math.hypot(u.x - hit.x, u.y - hit.y) <= neighbourRadius(this.cam.zoom)) this.selected.add(u.id);
      }
      this.sfx.play('select');
      this.hooks.onHud(this.world, this.selected.size);
      this.act({ kind: 'select', count: this.selected.size, box: false });
      return;
    }
    if (this.selected.size === 0) return;
    const units = this.selectedUnits();
    if (hit && this.hostile(hit)) return this.attack(units, hit);
    // Un tap sur un allié (pas d'attaque possible) vaut un déplacement à cet endroit.
    this.moveTo(units, sx, sy);
  }

  /** Case vers laquelle un ordre donné en ce point de l'écran serait aimanté, ou null. */
  private aimTile(sx: number, sy: number): AimTile | null {
    return magnetTile(this.world.tiles, this.cam.screenToGrid(sx, sy));
  }

  /**
   * Ordre de déplacement (fuir ou charger) vers un point de l'écran. Près d'une case bonus
   * ou d'un camp, l'ordre est aimanté : les élèves se répartissent dans la zone de capture.
   */
  private moveTo(units: Unit[], sx: number, sy: number): void {
    const g = this.cam.screenToGrid(sx, sy);
    const tile = magnetTile(this.world.tiles, g);
    let target = g;
    if (tile) {
      target = { x: tile.cx, y: tile.cy };
      this.orderIntoTile(units, tile, this.charge);
      this.flash = { tile, t: 0 };
    } else {
      if (g.x < 0 || g.y < 0 || g.x >= this.world.map.w || g.y >= this.world.map.h) return;
      const c = this.world.grid.nearestFree(g.x, g.y);
      if (!this.world.grid.walkable(g.x, g.y)) target = { x: c.x + 0.5, y: c.y + 0.5 };
      this.world.orderMove(units, target, this.charge);
    }
    this.markers.push({ x: target.x, y: target.y, t: 0, kind: this.charge ? 'charge' : 'move', team: this.opts.playerColor });
    this.sfx.play('order');
    this.act({ kind: 'move', count: units.length });
  }

  /** Camp du joueur sous un point de l'écran, ou null. */
  ownCampAt(sx: number, sy: number): Tile | null {
    const g = this.cam.screenToGrid(sx, sy);
    const t = this.world.tileAt(g.x, g.y);
    return t && t.isCamp && t.owner === this.playerTeam ? t : null;
  }

  /** Ouvre le panneau d'amélioration d'un camp du joueur. */
  openCamp(camp: Tile): void {
    if (camp.owner !== this.playerTeam || !camp.isCamp) return;
    this.sfx.play('select');
    this.flash = { tile: camp, t: 0 };
    this.hooks.onCampTap?.(camp);
    this.act({ kind: 'campPanel' });
  }

  /** Camp principal du joueur (le premier qu'il tient), pour le bouton des bons points. */
  mainCamp(): Tile | null {
    return (this.homeCamp && this.homeCamp.owner === this.playerTeam ? this.homeCamp : null) ?? this.world.tiles.find((t) => t.isCamp && t.owner === this.playerTeam) ?? null;
  }

  // ---------------------------------------------------------------- pouvoirs et pion

  /**
   * Arme un pouvoir (ou le désarme s'il l'était déjà). L'aperçu de la zone part du centre de
   * l'écran ; un tap sur la carte déplace la visée, un tap dans la zone lance le pouvoir.
   */
  armPower(id: PowerId | null): 'arme' | 'desarme' | 'recharge' | 'pas-assez' {
    if (id === null || this.armedPower === id) {
      this.armedPower = null;
      this.powerAim = null;
      return 'desarme';
    }
    if (powerCooldown(this.world, this.playerTeam, id) > 0) {
      this.sfx.play('deny');
      return 'recharge';
    }
    if (meritsOf(this.world, this.playerTeam) < POWERS[id].cost) {
      this.sfx.play('deny');
      return 'pas-assez';
    }
    this.armedPower = id;
    const c = this.cam.screenToGrid(this.cam.viewW / 2, this.cam.viewH / 2);
    this.powerAim = this.world.grid.clampPos(c, 0.5);
    this.sfx.play('select');
    return 'arme';
  }

  /** Tap pendant la visée : dans la zone, on lance ; ailleurs, on déplace la zone. */
  private aimPower(sx: number, sy: number): void {
    const id = this.armedPower!;
    const g = this.cam.screenToGrid(sx, sy);
    if (g.x < 0 || g.y < 0 || g.x >= this.world.map.w || g.y >= this.world.map.h) return;
    const aim = this.powerAim;
    if (aim && Math.hypot(g.x - aim.x, g.y - aim.y) <= POWERS[id].radius) {
      this.castAt(id, aim);
      return;
    }
    this.powerAim = g;
    this.sfx.play('order');
  }

  /** Lance un pouvoir du joueur en un point (grille). */
  castAt(id: PowerId, at: Vec2): PowerResult {
    const r = castPower(this.world, this.playerTeam, id, at.x, at.y);
    this.armedPower = null;
    this.powerAim = null;
    if (r !== 'ok') this.sfx.play('deny');
    else this.act({ kind: 'power', id });
    this.hooks.onHud(this.world, this.selected.size);
    return r;
  }

  /** Le joueur achète le pion d'un de ses camps. */
  buyCampPion(camp: Tile): PionResult {
    if (this.over) return 'pas-ton-camp';
    const r = buyPion(this.world, this.playerTeam, camp);
    this.sfx.play(r === 'ok' ? 'upgrade' : 'deny');
    if (r === 'ok') this.act({ kind: 'pion' });
    this.hooks.onHud(this.world, this.selected.size);
    return r;
  }

  /** Le joueur choisit la classe d'élèves que produit l'un de ses camps. */
  setCampProduce(camp: Tile, cls: UnitClass): ProduceResult {
    if (this.over) return 'pas-ton-camp';
    const r = setProduce(this.playerTeam, camp, cls);
    this.sfx.play(r === 'ok' ? 'select' : 'deny');
    if (r === 'ok') this.act({ kind: 'class', id: cls });
    return r;
  }

  /** Le joueur achète le niveau suivant d'une branche pour l'un de ses camps. */
  upgradeCamp(camp: Tile, branch: UpgradeBranch): UpgradeResult {
    if (this.over) return 'pas-ton-camp';
    const r = buyUpgrade(this.world, this.playerTeam, camp, branch);
    this.sfx.play(r === 'ok' ? 'upgrade' : 'deny');
    if (r === 'ok') this.act({ kind: 'upgrade', branch });
    this.hooks.onHud(this.world, this.selected.size);
    return r;
  }

  /** Envoie chaque élève sur sa propre place à l'intérieur de la zone de capture d'une case. */
  private orderIntoTile(units: Unit[], tile: AimTile, engage: boolean): void {
    const goals = tileGoals(units.map((u) => u.pos), tile, (x, y) => this.world.grid.walkable(x, y));
    orderMoveExact(this.world, units, goals, engage);
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
      if (u.team !== this.playerTeam || !u.alive || u.pion) continue;
      const p = this.cam.gridToScreen(u.x, u.y);
      const cy = p.y - 26 * z;
      if (p.x >= xa - 6 && p.x <= xb + 6 && cy >= ya - 10 && cy <= yb + 10) this.selected.add(u.id);
    }
    if (this.selected.size) this.sfx.play('select');
    this.hooks.onHud(this.world, this.selected.size);
    if (this.selected.size) this.act({ kind: 'select', count: this.selected.size, box: x0 !== x1 || y0 !== y1 });
  }

  selectAll(): void {
    this.selected.clear();
    for (const u of this.world.units) if (u.team === this.playerTeam && u.alive && !u.pion) this.selected.add(u.id);
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

  /**
   * Annonce au joueur. Une annonce mineure (par ex. une alliance entre deux IA) n'écrase pas
   * une annonce importante affichée depuis moins de 2,6 s.
   */
  private announce(text: string | null, important = true): void {
    if (!text) return;
    const now = this.world.time;
    if (!important && now < this.importantUntil) return;
    if (important) this.importantUntil = now + 2.6;
    this.sfx.play('capture');
    this.hooks.onAnnounce?.(text);
  }

  // ---------------------------------------------------------------- diplomatie

  /** État diplomatique entre le joueur et une équipe. */
  diploView(team: number): DiploView {
    return this.diplomacy.view(this.playerTeam, team);
  }

  /** Le joueur propose une alliance ; la réponse de l'IA est immédiate et annoncée. */
  proposeAlliance(team: number): ProposeResult {
    if (this.over) return 'invalide';
    const r = this.diplomacy.propose(this.playerTeam, team);
    if (r === 'trop-tot') this.announce(this.cooldownText(team));
    this.flushDiplomacy();
    return r;
  }

  /** Le joueur rompt une alliance (préavis de quelques secondes). */
  breakAlliance(team: number): BreakResult {
    if (this.over) return 'invalide';
    const r = this.diplomacy.requestBreak(this.playerTeam, team);
    if (r === 'trop-tot') this.announce(this.cooldownText(team));
    this.flushDiplomacy();
    return r;
  }

  private cooldownText(team: number): string {
    const s = Math.ceil(this.diplomacy.cooldownLeft(this.playerTeam, team));
    return `Trop tôt\u00a0: encore ${s}\u00a0s avant de changer d’alliance avec cette équipe.`;
  }

  /** Annonce tout de suite les réponses (sans attendre le prochain pas de simulation). */
  private flushDiplomacy(): void {
    for (const ev of this.diplomacy.drainEvents()) {
      const m = diploMessage(ev, this.playerTeam, this.world.teamColors);
      if (m) this.announce(m.text, m.important);
    }
    this.hooks.onHud(this.world, this.selected.size);
  }

  /** L'élève est-il un ennemi du joueur (ni à lui, ni allié) ? Un surveillant l'est toujours. */
  private hostile(u: Target): boolean {
    return isSupervisor(u) || !this.world.isFriend(u.team, this.playerTeam);
  }

  destroy(): void {
    this.stop();
    clearTimeout(this.endTimer);
    this.input.destroy();
    this.ac.abort();
  }

  // ---------------------------------------------------------------- contrôles au doigt

  readonly groups = new ControlGroups();
  private unitTaps = new DoubleTap();
  private arrow: OrderArrow | null = null;
  /** Case surlignée sous le doigt (ordre donné) ou sous la pointe de la flèche. */
  private flash: TileFlash | null = null;

  private isMine = (id: number): boolean => {
    const u = this.world.unitById(id);
    return !!u && u.alive && u.team === this.playerTeam && !u.pion;
  };

  private setSelection(ids: Iterable<number>): void {
    this.selected.clear();
    for (const id of ids) this.selected.add(id);
    if (this.selected.size) this.sfx.play('select');
    this.hooks.onHud(this.world, this.selected.size);
  }

  /** Nombre d'élèves vivants d'un groupe mémorisé. */
  groupSize(index: number): number {
    return this.groups.aliveCount(index, this.isMine);
  }

  /** Enregistre la sélection courante dans un groupe ; renvoie le nombre d'élèves (0 : rien n'est enregistré). */
  saveGroup(index: number): number {
    if (this.over) return 0;
    const ids = [...this.selected].filter(this.isMine);
    if (ids.length === 0) return 0;
    this.groups.save(index, ids);
    return ids.length;
  }

  /** Sélectionne les élèves encore en vie d'un groupe ; renvoie leur nombre. */
  recallGroup(index: number): number {
    if (this.paused || this.over) return 0;
    const ids = this.groups.recall(index, this.isMine);
    if (ids.length) this.setSelection(ids);
    return ids.length;
  }

  /** Centre la caméra sur un groupe (faux s'il est vide). */
  centerOnGroup(index: number): boolean {
    const pts = this.groups.recall(index, this.isMine).map((id) => this.world.unitById(id)!.pos);
    const c = centroid(pts);
    if (!c) return false;
    this.cam.centerOnGrid(c.x, c.y);
    return true;
  }

  /** Repli de la sélection sur le camp le plus proche (sans combat). */
  sendToCamp(): 'ok' | 'vide' | 'sans-camp' {
    if (this.paused || this.over) return 'vide';
    const units = this.selectedUnits();
    const c = centroid(units.map((u) => u.pos));
    if (!c) return 'vide';
    const camp = nearestOwnCamp(this.world.tiles, this.playerTeam, c);
    if (!camp) return 'sans-camp';
    const target = { x: camp.cx, y: camp.cy };
    this.orderIntoTile(units, camp, false);
    this.flash = { tile: camp, t: 0 };
    this.markers.push({ x: target.x, y: target.y, t: 0, kind: 'move', team: this.opts.playerColor });
    this.sfx.play('order');
    return 'ok';
  }

  /** Sélectionne tous les élèves du joueur visibles à l'écran. */
  selectVisible(): void {
    const ids: number[] = [];
    for (const u of this.world.units) {
      if (u.team !== this.playerTeam || !u.alive || u.pion) continue;
      const p = this.cam.gridToScreen(u.x, u.y);
      if (onScreen({ x: p.x, y: p.y - 20 * this.cam.zoom }, this.cam.viewW, this.cam.viewH)) ids.push(u.id);
    }
    this.setSelection(ids);
  }

  private canArrowFrom(sx: number, sy: number): boolean {
    if (this.paused || this.over || this.selected.size === 0) return false;
    const hit = this.unitAt(sx, sy);
    return !!hit && !isSupervisor(hit) && this.selected.has(hit.id);
  }

  private arrowMove(x0: number, y0: number, x1: number, y1: number): void {
    const hit = this.unitAt(x1, y1);
    this.arrow = { x0, y0, x1, y1, attack: !!hit && this.hostile(hit) };
    const tile = this.arrow.attack ? null : this.aimTile(x1, y1);
    this.flash = tile ? { tile, t: -1 } : this.flash && this.flash.t >= 0 ? this.flash : null;
  }

  /** Fin du glissé : attaque si on relâche sur un ennemi, sinon déplacement (repli) vers ce point. */
  private arrowEnd(sx: number, sy: number): void {
    this.arrow = null;
    if (this.flash && this.flash.t < 0) this.flash = null;
    if (this.paused || this.over) return;
    const units = this.selectedUnits();
    if (units.length === 0) return;
    const hit = this.unitAt(sx, sy);
    if (hit && this.hostile(hit)) return this.attack(units, hit);
    this.moveTo(units, sx, sy);
  }

  /**
   * Appui long sans bouger : sans sélection, sur le sol, pose le point de ralliement du camp
   * le plus proche (sur un de ses camps : l'efface). Sinon, comportement du rectangle de sélection.
   */
  private longPress(sx: number, sy: number): void {
    this.box = null;
    if (this.paused || this.over) return;
    if (this.armedPower) return this.aimPower(sx, sy);
    const hit = this.unitAt(sx, sy);
    const g = this.cam.screenToGrid(sx, sy);
    const onMap = g.x >= 0 && g.y >= 0 && g.x < this.world.map.w && g.y < this.world.map.h;
    if (this.selected.size > 0 || (hit && hit.team === this.playerTeam) || !onMap) {
      this.boxSelect(sx, sy, sx, sy);
      return;
    }
    this.sfx.unlock();
    const res = this.world.setRally(this.playerTeam, g);
    if (!res) return;
    const r = this.world.rallyFor(res.camp);
    const at = r ?? { x: res.camp.cx, y: res.camp.cy };
    this.markers.push({ x: at.x, y: at.y, t: 0, kind: 'capture', team: this.opts.playerColor });
    this.sfx.play('order');
    this.hooks.onRally?.(res.cleared);
    if (!res.cleared) this.act({ kind: 'rally' });
  }
}
