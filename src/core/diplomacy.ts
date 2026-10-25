// Diplomatie : propositions d'alliance, ruptures annoncées, attitude des IA.
// Logique pure, sans DOM : pilotée par Game (et les scripts de simulation), testée par Vitest.
import { BETRAYAL, DIPLOMACY, TEAM_PLURALS, TUNING } from '../config';
import { Rng } from './rng';
import type { Difficulty } from './types';
import type { World, WorldEvent } from './world';

/** Événements diplomatiques, à annoncer au joueur. */
export type DiploEvent =
  /** Réponse de `to` à une proposition d'alliance de `from`. */
  | { kind: 'reply'; from: number; to: number; accepted: boolean }
  /** `team` rompra son alliance avec `other` à l'heure de jeu `at`. */
  | { kind: 'warn'; team: number; other: number; at: number }
  /** `team` a rompu son alliance avec `other`. */
  | { kind: 'broken'; team: number; other: number };

export type ProposeResult = 'accepte' | 'refuse' | 'trop-tot' | 'deja' | 'invalide';
export type BreakResult = 'ok' | 'trop-tot' | 'deja' | 'invalide';

/** État diplomatique d'une paire, vu par le joueur. */
export interface DiploView {
  allied: boolean;
  /** Secondes avant la rupture annoncée, ou null. */
  breakingIn: number | null;
  /** Secondes avant de pouvoir changer d'alliance avec cette équipe (0 : possible). */
  cooldown: number;
  alive: boolean;
}

interface PendingBreak {
  team: number;
  other: number;
  at: number;
}

const grid = <T>(n: number, v: T): T[][] => Array.from({ length: n }, () => new Array<T>(n).fill(v));

/**
 * Diplomatie d'une partie. Le monde porte les alliances (World.allied) ; ce module décide
 * qui s'allie et quand :
 *  - une IA accepte une proposition quand c'est son intérêt : menace commune (une équipe
 *    nettement plus forte que les deux), ou proposeur pas plus fort qu'elle et sans rancune ;
 *    jamais si elle a été trahie récemment par lui, ni si l'alliance finirait la partie ;
 *  - les IA s'allient entre elles face à une menace, et de temps en temps sans raison ;
 *  - une IA rompt quand son allié devient trop fort ou quand l'ennemi commun est presque
 *    éliminé ; la rupture est annoncée quelques secondes à l'avance ;
 *  - une paire ne change pas d'alliance plus d'une fois toutes les 30 s.
 */
export class Diplomacy {
  readonly events: DiploEvent[] = [];
  private readonly n: number;
  private readonly lastChange: number[][];
  /** betrayedAt[victime][traître] : heure de la dernière trahison. */
  private readonly betrayedAt: number[][];
  /** attitude[a][b] : rancune (négatif) ou confiance de a envers b, entre -1 et 1. */
  readonly attitude: number[][];
  private pending: PendingBreak[] = [];
  private readonly timers: number[];
  private readonly rng: Rng;
  private readonly betrayal: (typeof BETRAYAL)[Difficulty];
  private tick = 0;

  constructor(
    readonly world: World,
    difficulty: Difficulty,
    /** Équipes dont la diplomatie est jouée par l'ordinateur. */
    readonly aiTeams: readonly number[],
    seed = 1,
  ) {
    this.n = world.numTeams;
    this.lastChange = grid(this.n, -Infinity);
    this.betrayedAt = grid(this.n, -Infinity);
    this.attitude = grid(this.n, 0);
    this.rng = new Rng(seed * 7919 + 17);
    this.betrayal = BETRAYAL[difficulty];
    // Première réflexion après une vingtaine de secondes, décalée selon l'équipe.
    this.timers = Array.from({ length: this.n }, (_, t) => DIPLOMACY.firstThink + t * 1.5);
  }

  private get time(): number {
    return this.world.time;
  }

  private alive(t: number): boolean {
    return this.world.teamUnitCount(t) > 0 || this.world.teamCampCount(t) > 0;
  }

  private aliveTeams(): number[] {
    const out: number[] = [];
    for (let t = 0; t < this.n; t++) if (this.alive(t)) out.push(t);
    return out;
  }

  /** Puissance estimée d'une équipe : vie × dégâts de ses élèves, camps et cases. */
  powers(): number[] {
    const w = this.world;
    const hp = new Array<number>(this.n).fill(0);
    for (const u of w.units) if (u.alive) hp[u.team] += u.hp;
    return hp.map((h, t) => (h / TUNING.unitHp) * w.mods[t].dmg + w.teamCampCount(t) * 5 * w.mods[t].prod + w.teamTileCount(t) * 0.5);
  }

  cooldownLeft(a: number, b: number): number {
    return Math.max(0, DIPLOMACY.pairCooldown - (this.time - this.lastChange[a][b]));
  }

  /** Secondes avant la rupture annoncée entre a et b, ou null. */
  breakingIn(a: number, b: number): number | null {
    const p = this.pending.find((x) => (x.team === a && x.other === b) || (x.team === b && x.other === a));
    return p ? Math.max(0, p.at - this.time) : null;
  }

  view(a: number, b: number): DiploView {
    return { allied: this.world.isAllied(a, b), breakingIn: this.breakingIn(a, b), cooldown: this.cooldownLeft(a, b), alive: this.alive(b) };
  }

  /** Une alliance entre a et b réunirait-elle toutes les équipes encore en vie ? */
  private wouldEnd(a: number, b: number): boolean {
    const alive = this.aliveTeams();
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) {
        const x = alive[i];
        const y = alive[j];
        const pair = (x === a && y === b) || (x === b && y === a);
        if (!pair && !this.world.isAllied(x, y)) return false;
      }
    return true;
  }

  /** Une équipe nettement plus forte que a et b, ennemie des deux ? */
  private commonThreat(a: number, b: number, pw: number[]): boolean {
    const w = this.world;
    const ref = Math.max(pw[a], pw[b]);
    for (const t of this.aliveTeams()) {
      if (t === a || t === b || w.isFriend(t, a) || w.isFriend(t, b)) continue;
      if (pw[t] > DIPLOMACY.threatRatio * ref) return true;
    }
    return false;
  }

  private recentlyBetrayed(victim: number, traitor: number): boolean {
    return this.time - this.betrayedAt[victim][traitor] < DIPLOMACY.betrayalMemory;
  }

  /** L'IA `ai` accepte-t-elle l'alliance proposée par `from` ? */
  accepts(ai: number, from: number, pw = this.powers()): boolean {
    if (this.recentlyBetrayed(ai, from)) return false;
    if (this.wouldEnd(ai, from)) return false;
    const allies = this.world.alliesOf(ai).length;
    if (allies >= DIPLOMACY.maxAlliesThreat) return false;
    if (this.commonThreat(ai, from, pw)) return true;
    if (allies >= DIPLOMACY.maxAllies) return false;
    // « Pas plus fort qu'elle », avec une petite marge (les profils d'équipe diffèrent).
    return pw[from] <= pw[ai] * 1.2 && this.attitude[ai][from] > -0.4;
  }

  /** Proposition d'alliance de `from` à `to` (une IA) : réponse immédiate. */
  propose(from: number, to: number): ProposeResult {
    const w = this.world;
    if (from === to || from < 0 || to < 0 || from >= this.n || to >= this.n) return 'invalide';
    if (!this.aiTeams.includes(to) || !this.alive(from) || !this.alive(to)) return 'invalide';
    if (w.isAllied(from, to)) return 'deja';
    if (this.cooldownLeft(from, to) > 0) return 'trop-tot';
    const accepted = this.accepts(to, from);
    if (accepted) {
      w.setAllied(from, to, true);
      this.lastChange[from][to] = this.lastChange[to][from] = this.time;
      this.attitude[to][from] = Math.max(this.attitude[to][from], 0);
    }
    this.events.push({ kind: 'reply', from, to, accepted });
    return accepted ? 'accepte' : 'refuse';
  }

  /** `team` annonce la rupture de son alliance avec `other` ; elle prend effet après le préavis. */
  requestBreak(team: number, other: number): BreakResult {
    if (team === other || team < 0 || other < 0 || team >= this.n || other >= this.n) return 'invalide';
    if (!this.world.isAllied(team, other)) return 'invalide';
    if (this.breakingIn(team, other) !== null) return 'deja';
    if (this.cooldownLeft(team, other) > 0) return 'trop-tot';
    const at = this.time + DIPLOMACY.breakNotice;
    this.pending.push({ team, other, at });
    this.events.push({ kind: 'warn', team, other, at });
    return 'ok';
  }

  /** Observe les événements du monde : un KO infligé par une équipe crée de la rancune. */
  record(ev: WorldEvent): void {
    if (ev.kind !== 'ko' || ev.by === undefined || ev.by === ev.team || ev.by < 0) return;
    const row = this.attitude[ev.team];
    if (row) row[ev.by] = Math.max(-1, row[ev.by] - 0.05);
  }

  recordAll(events: readonly WorldEvent[]): void {
    for (const ev of events) this.record(ev);
  }

  /** Vide la file d'événements diplomatiques et la retourne. */
  drainEvents(): DiploEvent[] {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  update(dt: number): void {
    const w = this.world;
    // Ruptures arrivées à échéance.
    if (this.pending.length) {
      const keep: PendingBreak[] = [];
      for (const p of this.pending) {
        if (!w.isAllied(p.team, p.other)) continue;
        if (this.time < p.at) {
          keep.push(p);
          continue;
        }
        w.setAllied(p.team, p.other, false);
        this.lastChange[p.team][p.other] = this.lastChange[p.other][p.team] = this.time;
        this.betrayedAt[p.other][p.team] = this.time;
        this.attitude[p.other][p.team] = -1;
        this.events.push({ kind: 'broken', team: p.team, other: p.other });
      }
      this.pending = keep;
    }
    // La rancune s'estompe lentement.
    this.tick += dt;
    if (this.tick >= 1) {
      const k = Math.min(0.2, 0.01 * this.tick);
      this.tick = 0;
      for (const row of this.attitude) for (let j = 0; j < row.length; j++) row[j] += (0 - row[j]) * k;
    }
    // Réflexion des IA.
    for (const ai of this.aiTeams) {
      this.timers[ai] -= dt;
      if (this.timers[ai] > 0) continue;
      this.timers[ai] = DIPLOMACY.thinkInterval * (0.7 + 0.6 * this.rng.next());
      if (this.alive(ai)) this.think(ai);
    }
  }

  private think(ai: number): void {
    const w = this.world;
    const pw = this.powers();
    const alive = this.aliveTeams();

    // --- Rupture -------------------------------------------------------------
    for (const b of w.alliesOf(ai)) {
      if (!this.alive(b) || this.breakingIn(ai, b) !== null || this.cooldownLeft(ai, b) > 0) continue;
      if (this.commonThreat(ai, b, pw)) continue; // on a encore besoin l'un de l'autre
      const enemies = alive.filter((t) => !w.isFriend(t, ai));
      const enemyPower = enemies.reduce((s, t) => s + pw[t], 0);
      let chance = 0;
      if (enemies.length === 0 || enemyPower < 0.25 * pw[ai]) chance = this.betrayal.endgameChance; // il ne reste presque que des alliés
      else if (pw[b] > this.betrayal.strongerRatio * pw[ai]) chance = this.betrayal.chance; // l'allié devient trop fort
      if (chance > 0 && this.rng.next() < chance) {
        this.requestBreak(ai, b);
        return;
      }
    }

    // --- Proposition à une autre IA ---------------------------------------------
    if (w.alliesOf(ai).length >= DIPLOMACY.maxAllies) return;
    const candidates = alive.filter(
      (t) =>
        t !== ai &&
        this.aiTeams.includes(t) &&
        !w.isFriend(t, ai) &&
        this.cooldownLeft(ai, t) === 0 &&
        !this.recentlyBetrayed(ai, t) &&
        !this.wouldEnd(ai, t),
    );
    if (candidates.length === 0) return;
    let threat = -1;
    for (const t of alive) if (!w.isFriend(t, ai) && (threat < 0 || pw[t] > pw[threat])) threat = t;
    if (threat >= 0 && pw[threat] > DIPLOMACY.threatRatio * pw[ai] && this.rng.next() < 0.6) {
      // Menace : on cherche le partenaire le plus solide (hors menace).
      const partners = candidates.filter((t) => t !== threat).sort((x, y) => pw[y] - pw[x]);
      if (partners.length) this.propose(ai, partners[0]);
      return;
    }
    if (this.rng.next() < 0.12) {
      // De temps en temps, une alliance de circonstance avec une équipe pas plus forte.
      const weak = candidates.filter((t) => pw[t] <= pw[ai] * 1.2);
      if (weak.length) this.propose(ai, weak[Math.floor(this.rng.next() * weak.length)]);
    }
  }
}

/** « les Verts », « les Jaunes »… */
export function teamPlural(color: number): string {
  return `les ${TEAM_PLURALS[color] ?? 'Autres'}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Texte d'annonce d'un événement diplomatique pour le joueur, ou null s'il n'y a rien à dire.
 * `important` : l'événement concerne le joueur (il ne doit pas être écrasé par une annonce mineure).
 */
export function diploMessage(ev: DiploEvent, player: number, colors: readonly number[]): { text: string; important: boolean } | null {
  const name = (t: number) => teamPlural(colors[t] ?? t);
  const s = ' ';
  switch (ev.kind) {
    case 'reply':
      if (ev.from === player) return { text: ev.accepted ? `${cap(name(ev.to))} acceptent l’alliance.` : `${cap(name(ev.to))} refusent.`, important: true };
      if (ev.to === player) return null;
      return ev.accepted ? { text: `${cap(name(ev.from))} et ${name(ev.to)} s’allient.`, important: false } : null;
    case 'warn': {
      const secs = Math.max(1, Math.round(DIPLOMACY.breakNotice));
      if (ev.team === player) return { text: `Tu romps l’alliance avec ${name(ev.other)} dans ${secs}${s}s.`, important: true };
      if (ev.other === player) return { text: `${cap(name(ev.team))} vont rompre l’alliance dans ${secs}${s}s${s}!`, important: true };
      return { text: `${cap(name(ev.team))} vont rompre l’alliance avec ${name(ev.other)} dans ${secs}${s}s${s}!`, important: false };
    }
    case 'broken':
      if (ev.team === player) return { text: `Alliance rompue avec ${name(ev.other)}.`, important: true };
      if (ev.other === player) return { text: `${cap(name(ev.team))} ont rompu l’alliance${s}!`, important: true };
      return { text: `${cap(name(ev.team))} et ${name(ev.other)} ne sont plus alliés.`, important: false };
  }
}
