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
import { teamGroups } from './core/teams';
import { AlertWatcher, type Alert } from './core/alerts';
import { Diplomacy, diploMessage, type BreakResult, type DiploView, type ProposeResult } from './core/diplomacy';
import { MAX_TEAMS, TEAM_COLORS } from './config';
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
import type { DefenceView } from './render/defence';
import { eventPerceived, pointVisible, unitVisible } from './core/fog';
import { isSupervisor, supervisorActive, supervisorAnnouncement, supervisorsOf, takeWhistles, type Supervisor } from './core/supervisors';
import { teamPlural } from './core/diplomacy';
import { playWhistle } from './audio/whistle';
import { MeritPopups } from './render/merits';
import { buyClassUnlock, buyDefense, buyGlobal, type GlobalBranch, type UpgradeBranch, type UpgradeResult } from './core/upgrades';
import { setProduce, type ProduceResult, type UnitClass } from './core/classes';
import { castPower, POWERS, powerCooldown, type PowerId, type PowerResult } from './core/powers';
import { buyPion, type PionResult } from './core/pion';
import { meritsOf } from './core/merits';
import { drawPowerAim, PowerEffects } from './render/powers';
import { BrawlBars } from './render/brawls';
import type { Vec2 } from './core/types';
import { TutorialState, type TutorialEvent } from './core/tutorial';
import { assignGuards, canGuard, guardCounts } from './core/garrison';
import { assignConquest, assignDefence, assignEscort, releaseSquad, squadMembers, squadMode, type SquadMode } from './core/squads';

/** Résultat d'une partie ; « abandon » : le joueur a abandonné (défaite, statistiques quand même). */
export type GameResult = 'victoire' | 'defaite' | 'abandon';

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
  /** Alerte à afficher (bandeau en haut) : case attaquée, perdue, camp en danger. */
  onAlert?(alert: Alert): void;
  /** Petite aide en bas de l'écran (ordre « Garder »…). */
  onHint?(text: string): void;
}

/** Actions du joueur observées par le tutoriel. */
export type PlayerAction =
  | { kind: 'select'; count: number; box: boolean }
  | { kind: 'move'; count: number }
  | { kind: 'attack'; count: number }
  | { kind: 'rally' }
  | { kind: 'camera'; how: 'pan' | 'zoom' | 'minimap' }
  | { kind: 'campPanel' }
  | { kind: 'upgrade'; branch: UpgradeBranch | 'classes' }
  | { kind: 'power'; id: string }
  | { kind: 'powerHelp'; id: string }
  | { kind: 'class'; id: string }
  | { kind: 'pion' }
  | { kind: 'guard'; count: number }
  | { kind: 'reinforce'; on: boolean }
  | { kind: 'conquer'; count: number }
  | { kind: 'defend'; count: number; tiles: number }
  | { kind: 'follow'; count: number; ward: number };

const STEP = 1 / 60;
/** Glisser d'un pouvoir : bande (px) près des bords où la caméra défile, et vitesse maximale (px/s). */
const EDGE_MARGIN = 48;
const EDGE_SPEED = 420;

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
  /** Alertes du joueur (case attaquée, perdue, camp en danger) ; aucune pendant le tutoriel. */
  readonly alerts: AlertWatcher | null;
  /** Dernière alerte affichée (le bandeau y emmène la caméra). */
  lastAlert: Alert | null = null;
  /** Mode « Équipes » : groupe de chaque équipe, ou null (partie libre). */
  readonly teamGroups: number[] | null;
  private importantUntil = 0;
  private fx = new Effects();
  /** Gains de bons points du joueur (« +10 ★ » qui s'envolent). */
  private gains = new MeritPopups();
  /** Tutoriel en cours (null hors tutoriel). */
  readonly tutorial: TutorialState | null = null;
  /** Effets des pouvoirs lancés. */
  private powerFx = new PowerEffects();
  /** Barres de bagarre. */
  private brawlBars = new BrawlBars();
  private frameDt = 0;
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
  /** Ordre « Garder » armé : le prochain tap sur une case la confie à la sélection. */
  guardArmed = false;
  /** Consigne « Suivre » armée (v5.13) : le prochain tap sur un de ses élèves (ou un groupe 1-2-3) désigne le protégé. */
  followArmed = false;
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
    // Mode « Équipes » : coéquipiers alliés pour toute la partie (camps voisins).
    this.teamGroups = !opts.tutorial && rules.teamSize ? teamGroups(this.world.map, rules.teamSize) : null;
    this.diplomacy = new Diplomacy(
      this.world,
      opts.difficulty,
      this.ais.map((a) => a.team),
      seed,
      this.teamGroups,
    );
    this.extras = new DiplomacyExtras(this.world, this.diplomacy, this.playerTeam, seed);
    this.alerts = opts.tutorial ? null : new AlertWatcher(this.world, this.playerTeam);
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
      onArrowCancel: () => ((this.arrow = this.flash = null), (this.rallyDrag = null)),
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

  /**
   * Abandon (menu pause) : la partie se termine aussitôt en défaite et l'écran de fin
   * affiche quand même les statistiques. Ne débloque rien, ne donne aucune médaille.
   */
  surrender(): boolean {
    if (this.over || this.tutorial) return false;
    this.over = true;
    this.paused = false;
    this.victors = [];
    this.sfx.play('defeat');
    this.hooks.onEnd('abandon', this.opts);
    return true;
  }

  /** Bandeau d'alerte touché : la caméra glisse jusqu'à la case. */
  goToAlert(a: Alert | null = this.lastAlert): void {
    if (!a || this.over) return;
    this.cam.glideTo(a.x, a.y);
    this.markers.push({ x: a.x, y: a.y, t: 0, kind: 'attack', team: this.opts.playerColor });
    this.sfx.play('select');
    this.act({ kind: 'camera', how: 'minimap' });
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
    this.frameDt = dt;
    this.cam.update(dt);
    if (!this.paused && !this.over) this.edgeScroll(dt);
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
          this.sfx.play(ev.parried ? 'parry' : 'hit', color);
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
    // Alertes : bandeau, son discret et petite vibration.
    const alert = this.alerts?.update(dt);
    if (alert) {
      this.lastAlert = alert;
      this.sfx.play('alert');
      if (alert.kind !== 'attaque') navigator.vibrate?.(alert.kind === 'camp' ? [30, 60, 30] : 25);
      this.hooks.onAlert?.(alert);
    }
    // Nettoyage de la sélection.
    for (const id of this.selected) {
      const u = w.unitById(id);
      if (!u || !u.alive) this.selected.delete(id);
    }
    if (this.guardArmed && this.selected.size === 0) this.guardArmed = false;
    if (this.followArmed && this.selected.size === 0) this.followArmed = false;
    // Escortes dissoutes : plus personne à protéger.
    for (const e of w.escortsEnded.splice(0)) {
      if (e.team !== this.playerTeam) continue;
      this.sfx.play('order');
      this.hooks.onHint?.('Escorte terminée : plus personne à suivre. Ces élèves attendent tes ordres.');
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
      rallyLines: this.rallyDrag || this.placingRally ? 'all' : this.panelCamp ? [this.panelCamp] : [],
      guards: guardCounts(this.world, this.playerTeam),
      guardZones: this.guardZones(),
      reinforcements: this.reinforceLinks(),
      conquests: this.conquestLinks(),
      escorts: this.escortLinks(),
      defences: this.defenceViews(),
    });
    if (this.flash) drawTileFlash(ctx, this.cam, this.flash);
    if (this.armedPower && this.powerAim) drawPowerAim(ctx, this.cam, this.world, this.armedPower, this.powerAim, this.playerTeam, this.time, false);
    const drag = this.powerDragTarget();
    if (this.powerDrag && drag) drawPowerAim(ctx, this.cam, this.world, this.powerDrag.id, drag.at, this.playerTeam, this.time, true, drag.valid);
    this.powerFx.draw(ctx, this.cam);
    this.brawlBars.draw(ctx, this.world, this.cam, this.playerTeam, this.time, this.frameDt);
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
    if (this.placingRally) {
      const camp = this.placingRally;
      this.placingRally = null;
      if (camp.owner === this.playerTeam) this.placeRally(camp, sx, sy);
      return;
    }
    if (this.guardArmed) return this.guardAt(sx, sy);
    if (this.followArmed) return this.followAt(sx, sy);
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
      // Hors de la cour ou sur un obstacle : ramené au bord, au coin ou à la case libre la plus proche.
      target = this.world.grid.orderPoint(g);
      this.world.orderMove(units, target, this.charge);
    }
    this.markers.push({ x: target.x, y: target.y, t: 0, kind: this.charge ? 'charge' : 'move', team: this.opts.playerColor });
    this.sfx.play('order');
    this.act({ kind: 'move', count: units.length });
  }

  // ---------------------------------------------------------------- garnisons

  /**
   * Bouton « Garder » : si la sélection se tient déjà sur une case (ou tout près), elle la garde
   * aussitôt ; sinon l'ordre est armé et le prochain tap sur une case la lui confie. Retoucher
   * le bouton pendant que l'ordre est armé l'annule.
   */
  guard(): 'garde' | 'arme' | 'desarme' | 'vide' {
    if (this.paused || this.over) return 'vide';
    this.followArmed = false;
    if (this.guardArmed) {
      this.guardArmed = false;
      return 'desarme';
    }
    const units = this.selectedUnits().filter((u) => !u.pion);
    const c = centroid(units.map((u) => u.pos));
    if (!c) return 'vide';
    const here = this.world.tiles.find((t) => canGuard(t) && t.contains(c.x, c.y, t.half + 0.45));
    if (here) {
      this.guardTile(units, here);
      return 'garde';
    }
    this.guardArmed = true;
    this.sfx.play('select');
    return 'arme';
  }

  /** Tap pendant que « Garder » est armé : la case visée (aimantée) est confiée à la sélection. */
  private guardAt(sx: number, sy: number): void {
    this.guardArmed = false;
    const tile = this.aimTile(sx, sy) as Tile | null;
    const units = this.selectedUnits().filter((u) => !u.pion);
    if (!tile || !canGuard(tile) || units.length === 0) {
      this.sfx.play('deny');
      this.hooks.onHint?.('Pas de case ici : ordre « Garder » annulé. Touche une case bonus, un camp ou le trône.');
      return;
    }
    this.guardTile(units, tile);
  }

  private guardTile(units: Unit[], tile: Tile): void {
    const n = assignGuards(this.world, units, tile);
    if (n === 0) return;
    this.flash = { tile, t: 0 };
    this.markers.push({ x: tile.cx, y: tile.cy, t: 0, kind: 'capture', team: this.opts.playerColor });
    this.sfx.play('guard');
    const total = guardCounts(this.world, this.playerTeam).get(tile) ?? n;
    this.hooks.onHint?.(`${total} garde${total > 1 ? 's' : ''} sur cette case : ils la défendent et la reprennent si elle tombe.`);
    this.act({ kind: 'guard', count: n });
  }

  /**
   * Bouton « Conquérir » : la sélection forme une escouade qui prend d'elle-même, l'une après
   * l'autre, les cases libres les plus proches. Si toute la sélection est déjà en
   * conquête, la consigne est levée (les élèves s'arrêtent là où ils vont).
   */
  conquer(): 'conquete' | 'stop' | 'rien' | 'vide' {
    if (this.paused || this.over) return 'vide';
    const units = this.selectedUnits().filter((u) => !u.pion);
    if (units.length === 0) return 'vide';
    if (units.every((u) => squadMode(this.world, u) === 'conquer')) {
      releaseSquad(units);
      this.sfx.play('order');
      this.hooks.onHint?.('Consigne « Conquérir » levée : ces élèves attendent tes ordres.');
      return 'stop';
    }
    this.guardArmed = false;
    this.followArmed = false;
    const sq = assignConquest(this.world, units);
    if (!sq) return 'vide';
    this.act({ kind: 'conquer', count: units.length });
    if (!sq.target) {
      this.sfx.play('select');
      this.hooks.onHint?.('Conquête : rien à prendre à portée pour l’instant. L’escouade attend et repartira dès qu’une case s’ouvre.');
      return 'rien';
    }
    this.flash = { tile: sq.target, t: 0 };
    this.markers.push({ x: sq.target.cx, y: sq.target.cy, t: 0, kind: 'capture', team: this.opts.playerColor });
    this.sfx.play('conquer');
    navigator.vibrate?.([10, 30, 10]);
    const n = units.length;
    this.hooks.onHint?.(`Escouade de ${n} en conquête : elle prend les cases libres une à une.`);
    return 'conquete';
  }

  /**
   * Bouton « Défendre » (v5.12) : la sélection devient une garnison mobile chargée des cases à toi
   * qui l'entourent (4 au plus) ; elle se poste au centre, court à la case attaquée et reprend celle
   * qui tombe. Si toute la sélection défend déjà, la consigne est levée.
   */
  defend(): 'defense' | 'stop' | 'rien' | 'vide' {
    if (this.paused || this.over) return 'vide';
    const units = this.selectedUnits().filter((u) => !u.pion);
    if (units.length === 0) return 'vide';
    if (units.every((u) => squadMode(this.world, u) === 'defend')) {
      releaseSquad(units);
      this.sfx.play('order');
      this.hooks.onHint?.('Consigne « Défendre » levée : ces élèves attendent tes ordres.');
      return 'stop';
    }
    this.guardArmed = false;
    this.followArmed = false;
    const sq = assignDefence(this.world, units);
    if (!sq) {
      this.sfx.play('deny');
      this.hooks.onHint?.('Aucune case à toi par ici : amène d’abord l’escouade près de tes cases, puis « Défendre ».');
      return 'rien';
    }
    this.act({ kind: 'defend', count: units.length, tiles: sq.zone.length });
    for (const t of sq.zone) this.markers.push({ x: t.cx, y: t.cy, t: 0, kind: 'capture', team: this.opts.playerColor });
    if (sq.post) this.flash = { tile: sq.post, t: 0 };
    this.sfx.play('defend');
    navigator.vibrate?.([20, 40, 20]);
    const k = sq.zone.length;
    const small = units.length < 4 ? ' À moins de 4, elle sera vite débordée.' : '';
    this.hooks.onHint?.(`Escouade de ${units.length} en défense de ${k} case${k > 1 ? 's' : ''} : elle court à celle qui est attaquée, puis revient.${small}`);
    return 'defense';
  }

  /**
   * Bouton « Suivre » (v5.13) : arme la consigne ; le prochain tap sur un de ses élèves (ou sur un
   * bouton de groupe 1, 2, 3) désigne le groupe à escorter. Retoucher le bouton désarme ; si toute la
   * sélection escorte déjà, la consigne est levée.
   */
  follow(): 'arme' | 'desarme' | 'stop' | 'vide' {
    if (this.paused || this.over) return 'vide';
    if (this.followArmed) {
      this.followArmed = false;
      return 'desarme';
    }
    const units = this.selectedUnits().filter((u) => !u.pion);
    if (units.length === 0) return 'vide';
    if (units.every((u) => squadMode(this.world, u) === 'follow')) {
      releaseSquad(units);
      this.sfx.play('order');
      this.hooks.onHint?.('Consigne « Suivre » levée : ces élèves attendent tes ordres.');
      return 'stop';
    }
    this.guardArmed = false;
    this.followArmed = true;
    this.sfx.play('select');
    return 'arme';
  }

  /** Tap pendant que « Suivre » est armé : le groupe touché (un de tes élèves et ses voisins, ou son escouade, ou son groupe 1-2-3) devient le protégé. */
  private followAt(sx: number, sy: number): void {
    this.followArmed = false;
    const cands: Array<{ unit: Unit; team: number; sx: number; sy: number; depth: number }> = [];
    for (const u of this.world.units) {
      if (!u.alive || u.team !== this.playerTeam || this.selected.has(u.id)) continue;
      const p = this.cam.gridToScreen(u.x, u.y);
      cands.push({ unit: u, team: u.team, sx: p.x, sy: p.y, depth: u.x + u.y });
    }
    const pk = pickUnit(cands, sx, sy, this.cam.zoom, this.playerTeam, false, FEET_Y);
    const leader = pk?.unit ?? null;
    if (!leader) {
      this.sfx.play('deny');
      this.hooks.onHint?.('Personne à suivre ici : touche un de tes élèves hors de la sélection, ou un bouton de groupe 1, 2, 3.');
      return;
    }
    let ids: number[];
    let wardSquad = 0;
    const gi = [0, 1, 2].find((i) => this.groups.ids(i).includes(leader.id));
    if (leader.squad > 0 && this.world.squads.has(leader.squad)) {
      wardSquad = leader.squad;
      ids = squadMembers(this.world, leader.squad).map((u) => u.id);
    } else if (gi !== undefined) {
      ids = this.groups.recall(gi, this.isMine);
    } else {
      ids = [];
      const r = neighbourRadius(this.cam.zoom);
      for (const u of this.world.units) {
        if (u.team !== this.playerTeam || !u.alive || this.selected.has(u.id)) continue;
        if (u === leader || (!u.pion && Math.hypot(u.x - leader.x, u.y - leader.y) <= r)) ids.push(u.id);
      }
    }
    this.escort(ids, wardSquad);
  }

  /** « Suivre » armé puis bouton de groupe : la sélection escorte ce groupe. Vrai si la consigne a été prise. */
  followGroup(index: number): boolean {
    if (!this.followArmed) return false;
    this.followArmed = false;
    const ids = this.groups.recall(index, this.isMine).filter((id) => !this.selected.has(id));
    if (ids.length === 0) {
      this.sfx.play('deny');
      this.hooks.onHint?.(`Groupe ${index + 1} vide (ou déjà dans la sélection) : consigne « Suivre » annulée.`);
      return true;
    }
    this.escort(ids, 0);
    return true;
  }

  private escort(ids: number[], wardSquad: number): void {
    const units = this.selectedUnits().filter((u) => !u.pion);
    const sq = units.length ? assignEscort(this.world, units, ids, wardSquad) : null;
    if (!sq) {
      this.sfx.play('deny');
      this.hooks.onHint?.('Ce groupe ne peut pas être escorté : choisis d’autres élèves que ceux de la sélection.');
      return;
    }
    const ward = sq.ward?.size ?? 0;
    const c = centroid([...(sq.ward ?? [])].map((id) => this.world.unitById(id)!.pos));
    if (c) this.markers.push({ x: c.x, y: c.y, t: 0, kind: 'move', team: this.opts.playerColor });
    this.sfx.play('follow');
    navigator.vibrate?.([15, 25, 15]);
    this.act({ kind: 'follow', count: units.length, ward });
    this.hooks.onHint?.(`Escorte de ${units.length} : elle suit ${ward > 1 ? `ces ${ward} élèves` : 'cet élève'} partout et chasse ceux qui l’approchent.`);
  }

  /** La sélection est-elle entièrement en escorte (bouton « Suivre » allumé) ? */
  get selectionFollows(): boolean {
    return this.selectionMode() === 'follow';
  }

  /** Nombre d'élèves en escorte dans un groupe mémorisé. */
  groupFollowing(index: number): number {
    return this.groupInMode(index, 'follow');
  }

  /** Escortes du joueur : centre de l'escorte, centre du protégé (tirets et cœur au-dessus du protégé). */
  escortLinks(): { from: Vec2; to: Vec2; selected: boolean }[] {
    const out: { from: Vec2; to: Vec2; selected: boolean }[] = [];
    for (const sq of this.world.squads.values()) {
      if (sq.team !== this.playerTeam || sq.mode !== 'follow' || !sq.anchor) continue;
      const m = squadMembers(this.world, sq.id);
      const c = centroid(m.map((u) => u.pos));
      if (c) out.push({ from: c, to: sq.anchor, selected: m.some((u) => this.selected.has(u.id)) });
    }
    return out;
  }

  /** Mode commun de toute la sélection (bouton allumé), ou null. */
  private selectionMode(): SquadMode | null {
    let mode: SquadMode | null = null;
    for (const id of this.selected) {
      const u = this.world.unitById(id);
      if (!u || !u.alive || u.pion || u.team !== this.playerTeam) continue;
      const m = squadMode(this.world, u);
      if (!m || (mode && m !== mode)) return null;
      mode = m;
    }
    return mode;
  }

  /** La sélection est-elle entièrement en conquête (bouton « Conquérir » allumé) ? */
  get selectionConquers(): boolean {
    return this.selectionMode() === 'conquer';
  }

  /** La sélection est-elle entièrement en défense (bouton « Défendre » allumé) ? */
  get selectionDefends(): boolean {
    return this.selectionMode() === 'defend';
  }

  /** Nombre d'élèves en conquête dans un groupe mémorisé. */
  groupConquering(index: number): number {
    return this.groupInMode(index, 'conquer');
  }

  /** Nombre d'élèves en défense dans un groupe mémorisé. */
  groupDefending(index: number): number {
    return this.groupInMode(index, 'defend');
  }

  private groupInMode(index: number, mode: SquadMode): number {
    let n = 0;
    for (const id of this.groups.ids(index)) {
      const u = this.world.unitById(id);
      if (u && u.alive && squadMode(this.world, u) === mode) n++;
    }
    return n;
  }

  /** Escouades en conquête du joueur : centre de l'escouade et case visée (pointillé et drapeau). */
  conquestLinks(): { from: Vec2; to: Tile; selected: boolean }[] {
    const out: { from: Vec2; to: Tile; selected: boolean }[] = [];
    for (const sq of this.world.squads.values()) {
      if (sq.team !== this.playerTeam || sq.mode !== 'conquer' || !sq.target) continue;
      const m = squadMembers(this.world, sq.id);
      const c = centroid(m.map((u) => u.pos));
      if (c) out.push({ from: c, to: sq.target, selected: m.some((u) => this.selected.has(u.id)) });
    }
    return out;
  }

  /** Escouades en défense du joueur : secteur, poste, case secourue et centre de l'escouade. */
  defenceViews(): DefenceView[] {
    const out: DefenceView[] = [];
    for (const sq of this.world.squads.values()) {
      if (sq.team !== this.playerTeam || sq.mode !== 'defend') continue;
      const m = squadMembers(this.world, sq.id);
      const c = centroid(m.map((u) => u.pos));
      if (c) out.push({ zone: sq.zone, post: sq.post, target: sq.target, from: c, selected: m.some((u) => this.selected.has(u.id)) });
    }
    return out;
  }

  /** Zones défendues à montrer : cases gardées par la sélection, ou toutes pendant que « Garder » est armé. */
  private guardZones(): Tile[] {
    const out = new Set<Tile>();
    for (const id of this.selected) {
      const g = this.world.unitById(id)?.guard;
      if (g) out.add(g);
    }
    if (this.guardArmed) for (const t of guardCounts(this.world, this.playerTeam).keys()) out.add(t);
    return [...out];
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

  /**
   * Glisser-déposer d'un pouvoir depuis son bouton : la zone suit le doigt (sx, sy en pixels de la
   * vue) ; `overHud` : le doigt est sur un bouton ou un panneau (relâcher annule). Pendant le
   * glisser, la caméra défile doucement quand le doigt approche du bord de l'écran.
   */
  powerDrag: { id: PowerId; sx: number; sy: number; overHud: boolean } | null = null;

  /** Début du glisser : faux (et la raison) si le pouvoir n'est pas disponible. */
  beginPowerDrag(id: PowerId): 'ok' | 'recharge' | 'pas-assez' {
    if (this.paused || this.over) return 'recharge';
    if (powerCooldown(this.world, this.playerTeam, id) > 0) return 'recharge';
    if (meritsOf(this.world, this.playerTeam) < POWERS[id].cost) return 'pas-assez';
    this.armedPower = null;
    this.powerAim = null;
    this.placingRally = null;
    this.powerDrag = { id, sx: -1, sy: -1, overHud: true };
    return 'ok';
  }

  dragPowerTo(sx: number, sy: number, overHud: boolean): void {
    if (!this.powerDrag) return;
    this.powerDrag.sx = sx;
    this.powerDrag.sy = sy;
    this.powerDrag.overHud = overHud;
  }

  /** Point visé (grille) par le glisser et sa validité (dans la cour, pas sur le HUD). */
  powerDragTarget(): { at: Vec2; valid: boolean } | null {
    const d = this.powerDrag;
    if (!d || d.sx < 0) return null;
    const at = this.cam.screenToGrid(d.sx, d.sy);
    const inside = at.x >= 0 && at.y >= 0 && at.x < this.world.map.w && at.y < this.world.map.h;
    return { at, valid: inside && !d.overHud };
  }

  /** Fin du glisser : lancement si la cible est valide, sinon annulation. */
  endPowerDrag(): PowerResult | 'annule' {
    const d = this.powerDrag;
    const target = this.powerDragTarget();
    this.powerDrag = null;
    if (!d || !target || !target.valid) return 'annule';
    return this.castAt(d.id, target.at);
  }

  cancelPowerDrag(): void {
    this.powerDrag = null;
  }

  /** Défilement de la caméra quand le doigt du glisser approche du bord (appelé à chaque image). */
  private edgeScroll(dt: number): void {
    const d = this.powerDrag;
    if (!d || d.sx < 0) return;
    const m = EDGE_MARGIN;
    const speed = EDGE_SPEED * dt;
    const k = (v: number, max: number) => (v < m ? (m - v) / m : v > max - m ? -(v - (max - m)) / m : 0);
    const kx = k(d.sx, this.cam.viewW);
    const ky = k(d.sy, this.cam.viewH);
    if (kx || ky) this.cam.pan(kx * speed, ky * speed);
  }

  /** Aide d'un pouvoir consultée (appui long sur son bouton). */
  powerHelpShown(id: PowerId): void {
    this.act({ kind: 'powerHelp', id });
  }

  /** Lance un pouvoir du joueur en un point (grille). */
  castAt(id: PowerId, at: Vec2): PowerResult {
    const r = castPower(this.world, this.playerTeam, id, at.x, at.y);
    this.armedPower = null;
    this.powerAim = null;
    if (r !== 'ok') this.sfx.play('deny');
    else {
      this.act({ kind: 'power', id });
      // Retour visuel immédiat : onde à la couleur du pouvoir au point d'impact.
      this.markers.push({ x: at.x, y: at.y, t: 0, kind: 'capture', team: this.opts.playerColor });
    }
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
    const r = setProduce(this.world, this.playerTeam, camp, cls);
    this.sfx.play(r === 'ok' ? 'select' : 'deny');
    if (r === 'ok') this.act({ kind: 'class', id: cls });
    return r;
  }

  /** Le joueur achète le niveau suivant d'une amélioration globale (toute l'équipe). */
  buyTeamUpgrade(branch: GlobalBranch): UpgradeResult {
    return this.purchase(this.over ? 'pas-ton-camp' : buyGlobal(this.world, this.playerTeam, branch), branch);
  }

  /** Le joueur débloque les classes d'élèves pour toute l'équipe. */
  buyClasses(): UpgradeResult {
    return this.purchase(this.over ? 'pas-ton-camp' : buyClassUnlock(this.world, this.playerTeam), 'classes');
  }

  /** Le joueur achète le niveau suivant de Défense d'un de ses camps. */
  buyCampDefense(camp: Tile): UpgradeResult {
    return this.purchase(this.over ? 'pas-ton-camp' : buyDefense(this.world, this.playerTeam, camp), 'def');
  }

  private purchase(r: UpgradeResult, branch: UpgradeBranch | 'classes'): UpgradeResult {
    this.sfx.play(r === 'ok' ? 'upgrade' : 'deny');
    if (r === 'ok') this.act({ kind: 'upgrade', branch });
    this.hooks.onHud(this.world, this.selected.size);
    return r;
  }

  /** Centre la caméra (en glissant) sur un camp et le fait clignoter. */
  focusCamp(camp: Tile): void {
    this.cam.glideTo(camp.cx, camp.cy);
    this.flash = { tile: camp, t: 0 };
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
    this.guardArmed = false;
    this.followArmed = false;
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
    this.rallyDrag = null;
    if (this.paused || this.over || this.armedPower) return false;
    const hit = this.unitAt(sx, sy);
    if (this.selected.size > 0 && !!hit && !isSupervisor(hit) && this.selected.has(hit.id)) return true;
    // Glisser depuis un de ses camps (pas depuis un élève sélectionné) : ralliement de ce camp.
    const pk = this.pick(sx, sy);
    const camp = this.ownCampAt(sx, sy);
    if (camp && !(pk && pk.direct && pk.unit.team === this.playerTeam && this.selected.has((pk.unit as Unit).id))) {
      this.rallyDrag = camp;
      return true;
    }
    return false;
  }

  /** Camp dont on trace le ralliement au doigt (glisser depuis le camp), ou null. */
  rallyDrag: Tile | null = null;
  /** Camp dont on place le ralliement au prochain tap (bouton « Ralliement » du panneau), ou null. */
  placingRally: Tile | null = null;
  /** Camp affiché dans le panneau (sa ligne de ralliement est visible), ou null. */
  panelCamp: Tile | null = null;

  /** Le prochain tap sur la carte placera le ralliement de ce camp (null : annuler). */
  startRallyPlacement(camp: Tile | null): void {
    this.placingRally = camp && camp.owner === this.playerTeam ? camp : null;
    if (this.placingRally) this.armedPower = null;
  }

  /** Pose le ralliement d'un camp du joueur en un point de l'écran. */
  private placeRally(camp: Tile, sx: number, sy: number): boolean {
    const g = this.cam.screenToGrid(sx, sy);
    if (camp.contains(g.x, g.y, camp.size / 2)) return false;
    if (!this.world.setCampRally(this.playerTeam, camp, g)) return false;
    const r = this.world.rallyFor(camp)!;
    this.markers.push({ x: r.x, y: r.y, t: 0, kind: 'capture', team: this.opts.playerColor });
    this.sfx.play('order');
    this.hooks.onRally?.(false);
    this.act({ kind: 'rally' });
    return true;
  }

  /** Renforts automatiques en cours du joueur : chaque camp et la case qu'il secourt. */
  reinforceLinks(): { from: Tile; to: Tile }[] {
    const out: { from: Tile; to: Tile }[] = [];
    if (this.world.reinforce.size === 0) return out;
    for (const camp of this.world.tiles) {
      if (!camp.isCamp || camp.owner !== this.playerTeam) continue;
      const to = this.world.reinforceTargetOf(camp);
      if (to) out.push({ from: camp, to });
    }
    return out;
  }

  /**
   * Active ou coupe les renforts automatiques d'un camp du joueur (`camp` null : tous ses camps).
   * Retourne le nombre de camps changés.
   */
  setReinforce(camp: Tile | null, on: boolean): number {
    const camps = camp ? [camp] : this.world.tiles.filter((t) => t.isCamp && t.owner === this.playerTeam);
    let n = 0;
    for (const c of camps) if (this.world.reinforceOn(c) !== on && this.world.setReinforce(this.playerTeam, c, on)) n++;
    if (n) {
      this.sfx.play(on ? 'reinforce' : 'order');
      navigator.vibrate?.(on ? [12, 40, 12] : 12);
      this.act({ kind: 'reinforce', on });
    }
    return n;
  }

  /** Supprime le ralliement d'un camp du joueur (ses nouveaux élèves restent au camp). */
  clearRally(camp: Tile): boolean {
    const ok = this.world.clearCampRally(this.playerTeam, camp);
    if (ok) {
      this.sfx.play('order');
      this.hooks.onRally?.(true);
    }
    return ok;
  }

  private arrowMove(x0: number, y0: number, x1: number, y1: number): void {
    if (this.rallyDrag) {
      this.arrow = { x0, y0, x1, y1, attack: false, color: TEAM_COLORS[this.opts.playerColor]?.light };
      return;
    }
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
    if (this.rallyDrag) {
      const camp = this.rallyDrag;
      this.rallyDrag = null;
      this.placeRally(camp, sx, sy);
      return;
    }
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
