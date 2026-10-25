import { SUIT_BONUS, TEAM_PROFILES, TUNING } from '../config';
import { Grid } from './grid';
import { dist2 } from './math';
import { findPath, smoothPath } from './pathfinding';
import { Rng } from './rng';
import { SpatialHash } from './spatial';
import { RhythmState, bonusWeight, updateRhythm, type RhythmEvent } from './events';
import { Tile, updateCapture } from './tile';
import { NO_TEAM, type MapDef, type Suit, type Vec2 } from './types';
import { Unit, punchDamage, resetUnitIds } from './unit';

export type WorldEvent =
  | { kind: 'punch'; x: number; y: number; team: number }
  | { kind: 'hit'; x: number; y: number; team: number }
  | { kind: 'ko'; x: number; y: number; team: number; by?: number }
  | { kind: 'captured'; x: number; y: number; team: number; camp: boolean }
  | { kind: 'spawn'; x: number; y: number; team: number }
  | RhythmEvent;

export interface TeamStats {
  units: number;
  tiles: number;
  camps: number;
  alive: boolean;
}

/** Multiplicateurs courants d'une équipe (profil × cases bonus possédées). */
export interface TeamMods {
  hp: number;
  dmg: number;
  prod: number;
  speed: number;
  suits: Record<Suit, number>;
}

/** Simulation complète d'une partie : unités, cases, combats, captures, apparitions. */
export class World {
  readonly map: MapDef;
  readonly grid: Grid;
  readonly tiles: Tile[];
  readonly units: Unit[] = [];
  readonly numTeams: number;
  readonly rng: Rng;
  readonly events: WorldEvent[] = [];
  readonly hash = new SpatialHash<Unit>(1);
  /** Couleur d'uniforme (index dans TEAM_COLORS / TEAM_PROFILES) de chaque équipe de la partie. */
  teamColors: number[] = [0, 1, 2, 3];
  /** Multiplicateur de dégâts par équipe (handicap / bonus des IA selon la difficulté). */
  damageScale: number[] = [1, 1, 1, 1];
  readonly mods: TeamMods[] = [];
  time = 0;
  /** Rythme de partie : case dorée, épuisement des équipes sans camp (voir events.ts). */
  readonly rhythm = new RhythmState();
  private presence: number[][] = [];
  private byId = new Map<number, Unit>();

  constructor(map: MapDef, numTeams = map.teams, seed = 1, teamColors?: number[]) {
    resetUnitIds();
    this.map = map;
    this.numTeams = numTeams;
    this.rng = new Rng(seed);
    if (teamColors) this.teamColors = teamColors;
    this.grid = new Grid(map.w, map.h, map.obstacles ?? []);
    this.tiles = map.tiles.filter((t) => t.kind !== 'camp' || (t.owner ?? 99) < numTeams).map((t) => new Tile(t));
    for (const t of this.tiles) if (t.owner >= numTeams) t.owner = NO_TEAM;
    this.presence = this.tiles.map(() => new Array<number>(numTeams).fill(0));
    for (let t = 0; t < numTeams; t++) this.mods.push({ hp: 1, dmg: 1, prod: 1, speed: 1, suits: { spade: 0, heart: 0, diamond: 0, club: 0 } });
    this.refreshMods();
    // Élèves de départ, dans le camp de chaque équipe.
    for (let team = 0; team < numTeams; team++) {
      const camp = this.tiles.find((t) => t.isCamp && t.owner === team);
      if (!camp) continue;
      for (let i = 0; i < map.startUnits; i++) {
        const a = (i / map.startUnits) * Math.PI * 2;
        const r = 0.45 + 0.25 * (i % 2);
        this.spawnUnit(team, camp.cx + Math.cos(a) * r, camp.cy + Math.sin(a) * r, false);
      }
    }
  }

  // ---------------------------------------------------------------- accès

  unitById(id: number): Unit | undefined {
    return this.byId.get(id);
  }

  teamUnitCount(team: number): number {
    let n = 0;
    for (const u of this.units) if (u.team === team && u.alive) n++;
    return n;
  }

  teamTileCount(team: number): number {
    let n = 0;
    for (const t of this.tiles) if (t.owner === team && !t.isCamp) n++;
    return n;
  }

  teamCampCount(team: number): number {
    let n = 0;
    for (const t of this.tiles) if (t.owner === team && t.isCamp) n++;
    return n;
  }

  get camps(): Tile[] {
    return this.tiles.filter((t) => t.isCamp);
  }

  stats(): TeamStats[] {
    const out: TeamStats[] = [];
    for (let t = 0; t < this.numTeams; t++) {
      const units = this.teamUnitCount(t);
      const tiles = this.teamTileCount(t);
      const camps = this.teamCampCount(t);
      out.push({ units, tiles, camps, alive: units > 0 || camps > 0 });
    }
    return out;
  }

  /**
   * Équipe gagnante, ou NO_TEAM :
   *  - seule équipe encore en vie (un élève ou un camp), ou
   *  - propriétaire de tous les camps (les autres ne peuvent plus produire).
   */
  winner(): number {
    const s = this.stats();
    const aliveTeams = s.filter((x) => x.alive).length;
    const campsTotal = this.camps.length;
    for (let t = 0; t < this.numTeams; t++) {
      if (s[t].alive && (aliveTeams === 1 || (campsTotal > 0 && s[t].camps === campsTotal))) return t;
    }
    return NO_TEAM;
  }

  tileAt(px: number, py: number): Tile | null {
    for (const t of this.tiles) if (t.contains(px, py, t.size / 2)) return t;
    return null;
  }

  /** Statistiques effectives d'une équipe (profil de couleur × bonus de cases). */
  private refreshMods(): void {
    for (let team = 0; team < this.numTeams; team++) {
      const prof = TEAM_PROFILES[this.teamColors[team]] ?? TEAM_PROFILES[0];
      const suits: Record<Suit, number> = { spade: 0, heart: 0, diamond: 0, club: 0 };
      for (const t of this.tiles) if (t.owner === team && t.suit) suits[t.suit] += bonusWeight(this, t);
      const m = this.mods[team];
      const prevHp = m.hp;
      m.hp = prof.hp * (1 + SUIT_BONUS.heart.perTile * suits.heart);
      m.dmg = prof.dmg * (1 + SUIT_BONUS.spade.perTile * suits.spade);
      m.prod = prof.prod * (1 + SUIT_BONUS.club.perTile * suits.club);
      m.speed = prof.speed * (1 + SUIT_BONUS.diamond.perTile * suits.diamond);
      m.suits = suits;
      if (prevHp !== m.hp) {
        // Les élèves existants gagnent ou perdent de la vie maximale en proportion.
        for (const u of this.units) {
          if (u.team !== team || !u.alive) continue;
          const ratio = u.hp / u.maxHp;
          u.maxHp = Math.max(1, Math.round(TUNING.unitHp * m.hp));
          u.hp = Math.max(1, Math.round(u.maxHp * ratio));
        }
      }
    }
  }

  // ---------------------------------------------------------------- ordres

  spawnUnit(team: number, x: number, y: number, announce = true): Unit {
    const p = this.grid.clampPos({ x, y }, 0.3);
    const u = new Unit(team, p.x, p.y);
    u.maxHp = Math.max(1, Math.round(TUNING.unitHp * this.mods[team].hp));
    u.hp = u.maxHp;
    this.units.push(u);
    this.byId.set(u.id, u);
    if (announce) this.events.push({ kind: 'spawn', x: u.x, y: u.y, team });
    return u;
  }

  /**
   * Ordre de déplacement. Sans `engage`, c'est un repli : les élèves cessent le combat
   * et courent sans riposter jusqu'à destination.
   */
  orderMove(units: Unit[], target: Vec2, engage = false): void {
    const n = units.length;
    // Formation légère : les élèves se répartissent autour du point visé.
    const spread = Math.min(1.6, 0.25 + Math.sqrt(n) * 0.18);
    units.forEach((u, i) => {
      if (!u.alive) return;
      const a = (i / n) * Math.PI * 2 + 0.7;
      const r = n === 1 ? 0 : spread * Math.sqrt((i + 1) / n);
      const goal = this.grid.clampPos({ x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r }, 0.3);
      u.order = { kind: 'move', target: goal, engage };
      u.engagedId = -1;
      u.pendingHit = 0;
      this.computePath(u, goal);
      u.state = u.path.length ? 'moving' : 'idle';
    });
  }

  orderAttack(units: Unit[], targetId: number): void {
    const target = this.byId.get(targetId);
    if (!target || !target.alive) return;
    for (const u of units) {
      if (!u.alive || u.team === target.team) continue;
      u.order = { kind: 'attack', target: target.pos, unitId: targetId };
      u.engagedId = targetId;
      this.computePath(u, target.pos);
      u.state = 'moving';
    }
  }

  private computePath(u: Unit, goal: Vec2): void {
    const raw = findPath(this.grid, u.pos, goal);
    u.path = smoothPath(this.grid, u.pos, raw);
    u.pathGoal = { x: goal.x, y: goal.y };
  }

  // ---------------------------------------------------------------- mise à jour

  update(dt: number): void {
    if (dt <= 0) return;
    this.time += dt;
    this.rebuildHash();
    for (const u of this.units) this.updateUnit(u, dt);
    this.separate();
    this.updateTiles(dt);
    if (updateRhythm(this, dt)) this.refreshMods();
    this.removeDead();
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (const u of this.units) if (u.alive) this.hash.insert(u);
  }

  private nearestEnemy(u: Unit, radius: number): Unit | null {
    let best: Unit | null = null;
    let bd = radius * radius;
    this.hash.query(u.x, u.y, radius, (o) => {
      if (o.team === u.team || !o.alive) return;
      const d = dist2(u.x, u.y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    return best as Unit | null;
  }

  private updateUnit(u: Unit, dt: number): void {
    // Recul (amorti).
    if (u.kx !== 0 || u.ky !== 0) {
      const nx = u.x + u.kx * dt;
      const ny = u.y + u.ky * dt;
      if (this.grid.walkable(nx, ny)) {
        u.x = nx;
        u.y = ny;
      }
      const f = Math.max(0, 1 - dt * 9);
      u.kx *= f;
      u.ky *= f;
      if (Math.abs(u.kx) + Math.abs(u.ky) < 0.02) u.kx = u.ky = 0;
    }

    u.animTime += dt;
    if (u.attackCooldown > 0) u.attackCooldown -= dt;

    if (u.state === 'ko') {
      u.koTimer -= dt;
      return;
    }

    // Coup en cours : il porte après un court délai.
    if (u.pendingHit > 0) {
      u.pendingHit -= dt;
      if (u.pendingHit <= 0) {
        u.pendingHit = 0;
        const target = this.byId.get(u.engagedId);
        if (target && target.alive && dist2(u.x, u.y, target.x, target.y) < (TUNING.punchRange * 1.5) ** 2) {
          const scale = this.mods[u.team].dmg * (this.damageScale[u.team] ?? 1);
          const dmg = Math.max(1, Math.round(punchDamage(() => this.rng.next()) * scale));
          const ko = target.takeDamage(dmg, u.x, u.y);
          this.events.push({ kind: 'hit', x: target.x, y: target.y, team: target.team });
          if (ko) this.events.push({ kind: 'ko', x: target.x, y: target.y, team: target.team, by: u.team });
        }
      }
    }

    // Validation de l'ennemi engagé.
    let engaged = u.engagedId >= 0 ? this.byId.get(u.engagedId) : undefined;
    if (engaged && !engaged.alive) {
      engaged = undefined;
      u.engagedId = -1;
      if (u.order.kind === 'attack') u.clearOrder();
      else if (u.order.kind === 'move') this.computePath(u, u.order.target);
    }

    // Recherche d'une cible : à portée d'aggro si inoccupé, au contact en attaque-déplacement.
    // Un repli (déplacement sans `engage`) ne cherche jamais le combat.
    const canEngage = u.order.kind === 'none' || u.order.kind === 'attack' || u.order.engage === true;
    if (!engaged && canEngage && this.time - u.lastScan > 0.2) {
      u.lastScan = this.time + u.phase * 0.2;
      const radius = u.order.kind === 'none' ? TUNING.aggroRange : TUNING.punchRange * 1.6;
      const e = this.nearestEnemy(u, radius);
      if (e) {
        engaged = e;
        u.engagedId = e.id;
      }
    }

    if (engaged) {
      const d2 = dist2(u.x, u.y, engaged.x, engaged.y);
      const range = TUNING.punchRange;
      if (d2 <= range * range) {
        u.state = 'attacking';
        u.face(engaged.x, engaged.y);
        if (u.attackCooldown <= 0 && u.pendingHit === 0) {
          u.attackCooldown = TUNING.punchInterval * (0.9 + 0.2 * this.rng.next());
          u.pendingHit = 0.16;
          u.setAnim('punch');
          this.events.push({ kind: 'punch', x: u.x, y: u.y, team: u.team });
        } else if (u.anim === 'punch' && u.animTime > 0.4) {
          u.setAnim('idle');
        }
        return;
      }
      const g = u.pathGoal;
      if (!g || dist2(g.x, g.y, engaged.x, engaged.y) > 0.6 || u.path.length === 0) {
        this.computePath(u, engaged.pos);
      }
      u.state = 'moving';
      this.followPath(u, dt);
      return;
    }

    if (u.order.kind === 'move' || u.order.kind === 'attack') {
      if (u.path.length === 0) {
        u.clearOrder();
        u.state = 'idle';
        u.setAnim('idle');
      } else {
        u.state = 'moving';
        this.followPath(u, dt);
      }
      return;
    }

    u.state = 'idle';
    if (u.anim === 'punch' && u.animTime > 0.4) u.setAnim('idle');
    if (u.anim === 'walk') u.setAnim('idle');
  }

  private followPath(u: Unit, dt: number): void {
    if (u.path.length === 0) return;
    const wp = u.path[0];
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const d = Math.hypot(dx, dy);
    const step = TUNING.unitSpeed * this.mods[u.team].speed * dt;
    if (d <= step || d < 0.08) {
      u.x = wp.x;
      u.y = wp.y;
      u.path.shift();
    } else {
      const nx = u.x + (dx / d) * step;
      const ny = u.y + (dy / d) * step;
      if (this.grid.walkable(nx, ny)) {
        u.x = nx;
        u.y = ny;
      } else {
        u.path.shift();
      }
      u.face(wp.x, wp.y);
    }
    u.setAnim('walk');
    if (u.path.length === 0 && u.anim === 'walk') u.setAnim('idle');
  }

  /** Les élèves se repoussent légèrement pour ne pas se superposer. */
  private separate(): void {
    const r = TUNING.unitRadius * 2;
    const r2 = r * r;
    for (const u of this.units) {
      if (!u.alive) continue;
      let px = 0;
      let py = 0;
      this.hash.query(u.x, u.y, r, (o) => {
        if (o === u || !o.alive) return;
        const dx = u.x - o.x;
        const dy = u.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) return;
        if (d2 < 1e-6) {
          const a = (u.id * 2.399) % (Math.PI * 2);
          px += Math.cos(a) * 0.02;
          py += Math.sin(a) * 0.02;
          return;
        }
        const d = Math.sqrt(d2);
        const push = ((r - d) / r) * 0.5;
        px += (dx / d) * push * r * 0.5;
        py += (dy / d) * push * r * 0.5;
      });
      if (px !== 0 || py !== 0) {
        const nx = u.x + px;
        const ny = u.y + py;
        if (this.grid.walkable(nx, ny)) {
          u.x = nx;
          u.y = ny;
        } else {
          const c = this.grid.clampPos({ x: nx, y: ny }, 0.25);
          if (this.grid.walkable(c.x, c.y)) {
            u.x = c.x;
            u.y = c.y;
          }
        }
      }
    }
  }

  private updateTiles(dt: number): void {
    let changed = false;
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const pres = this.presence[i];
      pres.fill(0);
      // Soin : sur son propre camp ou un cœur possédé, un élève se régénère.
      const heals = t.owner !== NO_TEAM && (t.isCamp || t.suit === 'heart');
      this.hash.query(t.cx, t.cy, t.half, (u) => {
        if (!u.alive || !t.contains(u.x, u.y)) return;
        pres[u.team]++;
        if (heals && u.team === t.owner && u.hp < u.maxHp && !this.rhythm.starving[u.team]) {
          u.hp = Math.min(u.maxHp, u.hp + TUNING.regenPerSec * dt);
          u.healedAt = this.time;
        }
      });
      const ev = updateCapture(t, pres, dt);
      if (ev && ev.kind === 'captured') {
        changed = true;
        this.events.push({ kind: 'captured', x: t.cx, y: t.cy, team: ev.team, camp: t.isCamp });
      }

      // Apparition : seuls les camps produisent, au rythme du profil et des bonus.
      if (t.isCamp && t.owner !== NO_TEAM) {
        t.spawnTimer += dt;
        const interval = this.map.spawnInterval / this.mods[t.owner].prod;
        if (t.spawnTimer >= interval) {
          t.spawnTimer = 0;
          if (this.teamUnitCount(t.owner) < this.map.unitCap) {
            const a = this.rng.next() * Math.PI * 2;
            this.applyRally(t, this.spawnUnit(t.owner, t.cx + Math.cos(a) * 0.5, t.cy + Math.sin(a) * 0.5));
          }
        }
      }
    }
    if (changed) this.refreshMods();
  }

  private removeDead(): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.state === 'ko' && u.koTimer <= 0) {
        this.units.splice(i, 1);
        this.byId.delete(u.id);
      }
    }
  }

  /** Vide la file d'événements (sons, effets) et la retourne. */
  drainEvents(): WorldEvent[] {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  // ---------------------------------------------------------------- ralliement

  /** Point de ralliement de chaque camp (équipe qui l'a posé + position). */
  readonly rallies = new Map<Tile, { team: number; x: number; y: number }>();

  /**
   * Pose le point de ralliement du camp de `team` le plus proche de `p`.
   * Viser l'intérieur d'un de ses camps efface le ralliement de ce camp.
   * Retourne le camp concerné, ou null si l'équipe n'a aucun camp.
   */
  setRally(team: number, p: Vec2): { camp: Tile; cleared: boolean } | null {
    let best: Tile | null = null;
    let bd = Infinity;
    for (const t of this.tiles) {
      if (!t.isCamp || t.owner !== team) continue;
      if (t.contains(p.x, p.y, t.size / 2)) {
        this.rallies.delete(t);
        return { camp: t, cleared: true };
      }
      const d = dist2(p.x, p.y, t.cx, t.cy);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (!best) return null;
    const g = this.grid.clampPos(p, 0.3);
    this.rallies.set(best, { team, x: g.x, y: g.y });
    return { camp: best, cleared: false };
  }

  /** Point de ralliement valide d'un camp (posé par son propriétaire actuel), ou null. */
  rallyFor(camp: Tile): Vec2 | null {
    const r = this.rallies.get(camp);
    if (!r) return null;
    if (r.team !== camp.owner) {
      this.rallies.delete(camp);
      return null;
    }
    return { x: r.x, y: r.y };
  }

  /** Un élève qui naît dans un camp doté d'un ralliement s'y replie aussitôt. */
  private applyRally(camp: Tile, u: Unit): void {
    const r = this.rallyFor(camp);
    if (r) this.orderMove([u], r, false);
  }
}
