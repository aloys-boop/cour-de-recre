// Options de diplomatie de l'escarmouche : cadeaux entre alliés, appel à l'aide, tribut.
// Logique pure, sans DOM : pilotée par Game (pas de simulation), testée par Vitest.
// Chaque option ne fait rien tant que `world.rules.<option>` est faux (toujours le cas en campagne).
import { TUNING } from '../config';
import { TAG_LOANED } from './ai';
import { teamPlural, type Diplomacy } from './diplomacy';
import { Rng } from './rng';
import type { Tile } from './tile';
import { NO_TEAM, type Suit, type Vec2 } from './types';
import type { Unit } from './unit';
import type { World } from './world';

/** Réglages des options de diplomatie. */
export const EXTRAS = {
  /** Appel à l'aide : délai de recharge (s), durée de l'aide (s), part des élèves libres envoyés. */
  sosCooldown: 60,
  sosDuration: 25,
  sosShareCalm: 0.5,
  sosShareBusy: 0.3,
  /** Tribut : durée de la trêve (s), durée de validité d'une proposition d'IA (s). */
  truceSeconds: 30,
  offerSeconds: 8,
  /** Délai entre deux propositions de tribut d'une même IA (s). */
  offerCooldown: 60,
  /** Délai entre deux cadeaux d'une même IA (s). */
  giftCooldown: 45,
  /** Réflexion des IA (s, ± 30 %), première réflexion après `firstThink` s. */
  think: 4,
  firstThink: 20,
  /** Probabilités par réflexion, quand la situation s'y prête. */
  giftChance: 0.12,
  offerChance: 0.3,
  aiSosChance: 0.6,
};

/** Rôles d'IA (voir ai.ts) : 0 = libre, 1 = défense, 3 = regroupement. */
const TAG_FREE = 0;
const TAG_DEFEND = 1;
const TAG_RALLY = 3;

export const SUIT_GLYPH: Record<Suit, string> = { heart: '♥', spade: '♠', club: '♣', diamond: '♦' };

export interface ExtrasMessage {
  text: string;
  /** Concerne directement le joueur (ne doit pas être écrasé par une annonce mineure). */
  important: boolean;
}

/** Résultat d'une action du joueur : `text` est à afficher tel quel. */
export interface ActionResult {
  ok: boolean;
  text: string;
}

/** Proposition de tribut d'une IA au joueur (en attente de réponse). */
export interface TributeOffer {
  from: number;
  tile: Tile;
  /** Heure de jeu à laquelle la proposition expire. */
  expires: number;
}

interface Loan {
  unitId: number;
  /** Équipe aidée. */
  helping: number;
  until: number;
  target: Vec2;
}

const NB = ' ';
const grid = <T>(n: number, v: T): T[][] => Array.from({ length: n }, () => new Array<T>(n).fill(v));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, w: string) => `${n}${NB}${w}${n > 1 ? 's' : ''}`;

/**
 * Cadeaux, appels à l'aide et tributs.
 *  - Cadeaux (rules.gifts) : des élèves changent d'équipe (ils gardent leurs points de vie),
 *    ou une case bonus change de propriétaire (jamais un camp). Les IA alliées aident parfois
 *    un allié en difficulté.
 *  - Appel à l'aide (rules.sos) : chaque allié IA envoie 30 à 50 % de ses élèves libres défendre
 *    le camp de l'appelant pendant 25 s, puis les rend à sa stratégie. Recharge de 60 s.
 *  - Tribut (rules.tribute) : une case bonus contre 30 s de trêve (World.truce : pas de combat
 *    ni de capture entre les deux équipes). Les IA en mauvaise posture en proposent au joueur.
 */
export class DiplomacyExtras {
  private readonly n: number;
  private readonly rng: Rng;
  private readonly truceUntil: number[][];
  private readonly sosReadyAt: number[];
  private readonly giftReadyAt: number[];
  private readonly offerReadyAt: number[];
  private readonly timers: number[];
  private loans: Loan[] = [];
  private loanCheck = 0;
  private messages: ExtrasMessage[] = [];
  /** Proposition de tribut d'une IA en attente de la réponse du joueur. */
  offer: TributeOffer | null = null;

  constructor(
    readonly world: World,
    readonly diplomacy: Diplomacy,
    readonly player = 0,
    seed = 1,
  ) {
    this.n = world.numTeams;
    this.rng = new Rng(seed * 4099 + 31);
    this.truceUntil = grid(this.n, -Infinity);
    this.sosReadyAt = new Array<number>(this.n).fill(0);
    this.giftReadyAt = new Array<number>(this.n).fill(0);
    this.offerReadyAt = new Array<number>(this.n).fill(0);
    this.timers = Array.from({ length: this.n }, (_, t) => EXTRAS.firstThink + t * 1.3);
    // La trêve passe par World.isFriend : pas de combat, pas de capture entre les deux équipes.
    if (world.rules.tribute) world.truce = (a, b) => this.truceUntil[a]?.[b] > this.world.time;
  }

  private get time(): number {
    return this.world.time;
  }

  private get rules() {
    return this.world.rules;
  }

  private get aiTeams(): readonly number[] {
    return this.diplomacy.aiTeams;
  }

  private name(t: number): string {
    return teamPlural(this.world.teamColors[t] ?? t);
  }

  /** « aux Verts » */
  private aux(t: number): string {
    return this.name(t).replace(/^les /, 'aux ');
  }

  /** « des Verts » */
  private des(t: number): string {
    return this.name(t).replace(/^les /, 'des ');
  }

  private alive(t: number): boolean {
    return this.world.teamUnitCount(t) > 0 || this.world.teamCampCount(t) > 0;
  }

  private valid(t: number): boolean {
    return Number.isInteger(t) && t >= 0 && t < this.n;
  }

  private say(text: string, important: boolean): void {
    this.messages.push({ text, important });
  }

  /** Vide la file des annonces (initiatives des IA, fins de trêve) et la retourne. */
  drainMessages(): ExtrasMessage[] {
    const out = this.messages;
    this.messages = [];
    return out;
  }

  // ---------------------------------------------------------------- cadeaux

  /**
   * Fait passer des élèves de `from` à son allié `to` (option Cadeaux). Ils gardent leurs points
   * de vie, quittent leur ordre et leur combat. Retourne le nombre d'élèves transférés.
   */
  giftUnits(from: number, to: number, ids: Iterable<number>): Unit[] {
    const w = this.world;
    if (!this.rules.gifts || !this.valid(from) || !this.valid(to) || !w.isAllied(from, to)) return [];
    const out: Unit[] = [];
    const maxHp = Math.max(1, Math.round(TUNING.unitHp * w.mods[to].hp));
    for (const id of ids) {
      const u = w.unitById(id);
      if (!u || !u.alive || u.team !== from) continue;
      (u as unknown as { team: number }).team = to;
      u.maxHp = Math.max(maxHp, u.hp);
      u.clearOrder();
      u.engagedId = -1;
      u.supId = 0;
      u.pendingHit = 0;
      u.aiTag = TAG_FREE;
      this.loans = this.loans.filter((l) => l.unitId !== u.id);
      out.push(u);
    }
    // Ceux qui se battaient contre eux (désormais amis) arrêtent d'eux-mêmes au pas suivant.
    return out;
  }

  /** Le joueur donne ses élèves sélectionnés à un allié ; ils quittent la sélection. */
  giftSelected(to: number, selected: Set<number>): ActionResult {
    if (!this.rules.gifts || !this.valid(to)) return { ok: false, text: 'Les cadeaux ne sont pas activés.' };
    if (!this.world.isAllied(this.player, to)) return { ok: false, text: `Tu ne peux faire de cadeau qu’à un allié.` };
    const ids = [...selected].filter((id) => {
      const u = this.world.unitById(id);
      return !!u && u.alive && u.team === this.player;
    });
    if (ids.length === 0) return { ok: false, text: `Sélectionne d’abord les élèves à donner ${this.aux(to)}.` };
    const given = this.giftUnits(this.player, to, ids);
    for (const u of given) selected.delete(u.id);
    return { ok: true, text: `${cap(this.name(to))} reçoivent ${plural(given.length, 'élève')}. Merci${NB}!` };
  }

  /** Points de référence d'une équipe : ses camps, sinon le centre de ses élèves, sinon le centre de la cour. */
  private anchors(team: number): Vec2[] {
    const w = this.world;
    const camps = w.tiles.filter((t) => t.isCamp && t.owner === team).map((t) => ({ x: t.cx, y: t.cy }));
    if (camps.length) return camps;
    let x = 0;
    let y = 0;
    let k = 0;
    for (const u of w.units)
      if (u.alive && u.team === team) {
        x += u.x;
        y += u.y;
        k++;
      }
    return [k ? { x: x / k, y: y / k } : { x: w.map.w / 2, y: w.map.h / 2 }];
  }

  /** Case bonus de `owner` la plus proche de l'équipe `toward` (jamais un camp), ou null. */
  nearestBonusTile(owner: number, toward: number): Tile | null {
    const pts = this.anchors(toward);
    let best: Tile | null = null;
    let bd = Infinity;
    for (const t of this.world.tiles) {
      if (t.kind !== 'bonus' || t.owner !== owner) continue;
      for (const p of pts) {
        const d = Math.hypot(t.cx - p.x, t.cy - p.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
    }
    return best;
  }

  /** Change le propriétaire d'une case bonus (jamais un camp) ; les bonus sont recalculés. */
  transferTile(tile: Tile, from: number, to: number): boolean {
    if (tile.kind !== 'bonus' || tile.owner !== from || !this.valid(to) || from === to) return false;
    tile.owner = to;
    tile.cap = 0;
    tile.capTeam = NO_TEAM;
    this.world.refreshMods();
    return true;
  }

  /** Cède à son allié `to` une case bonus de `from` (la plus proche de l'allié par défaut). */
  cedeTile(from: number, to: number, tile: Tile | null = this.nearestBonusTile(from, to)): Tile | null {
    if (!this.rules.gifts || !tile || !this.world.isAllied(from, to)) return null;
    return this.transferTile(tile, from, to) ? tile : null;
  }

  /** Le joueur cède à un allié sa case bonus la plus proche de lui. */
  playerCedeTile(to: number): ActionResult {
    if (!this.rules.gifts || !this.valid(to)) return { ok: false, text: 'Les cadeaux ne sont pas activés.' };
    if (!this.world.isAllied(this.player, to)) return { ok: false, text: `Tu ne peux céder une case qu’à un allié.` };
    const t = this.cedeTile(this.player, to);
    if (!t) return { ok: false, text: 'Tu n’as aucune case bonus à céder (les camps ne se donnent pas).' };
    return { ok: true, text: `Tu cèdes une case ${SUIT_GLYPH[t.suit!]} ${this.aux(to)}.` };
  }

  // ---------------------------------------------------------------- appel à l'aide

  /** Secondes avant que `team` puisse de nouveau appeler à l'aide (0 : possible). */
  sosCooldownLeft(team = this.player): number {
    return Math.max(0, (this.sosReadyAt[team] ?? 0) - this.time);
  }

  /** Nombre d'élèves alliés en route ou en défense pour `team`. */
  helpersFor(team = this.player): number {
    return this.loans.filter((l) => l.helping === team).length;
  }

  /** Ennemis de `team` à moins de `r` d'un point. */
  private enemiesNear(team: number, p: Vec2, r: number): number {
    let k = 0;
    for (const u of this.world.units) if (u.alive && !this.world.isFriend(u.team, team) && Math.hypot(u.x - p.x, u.y - p.y) < r) k++;
    return k;
  }

  /** Camp de `team` le plus menacé (le plus d'ennemis autour), ou null. */
  private campToDefend(team: number): Tile | null {
    let best: Tile | null = null;
    let bk = -1;
    for (const t of this.world.tiles) {
      if (!t.isCamp || t.owner !== team) continue;
      const k = this.enemiesNear(team, { x: t.cx, y: t.cy }, 3.5);
      if (k > bk) {
        bk = k;
        best = t;
      }
    }
    return best;
  }

  /** Un des camps de `team` est-il menacé ? */
  private campThreatened(team: number, min = 2): boolean {
    return this.world.tiles.some((t) => t.isCamp && t.owner === team && this.enemiesNear(team, { x: t.cx, y: t.cy }, 3.5) >= min);
  }

  /**
   * `team` appelle à l'aide : chaque allié IA (sans rupture annoncée) envoie une partie de ses
   * élèves libres défendre son camp le plus menacé. Retourne le nombre d'élèves envoyés par allié.
   */
  callSos(team: number): { result: 'ok' | 'off' | 'recharge' | 'sans-camp' | 'sans-allie' | 'personne'; sent: Map<number, number> } {
    const w = this.world;
    const sent = new Map<number, number>();
    if (!this.rules.sos || !this.valid(team)) return { result: 'off', sent };
    if (this.sosCooldownLeft(team) > 0) return { result: 'recharge', sent };
    const camp = this.campToDefend(team);
    if (!camp) return { result: 'sans-camp', sent };
    const allies = w.alliesOf(team).filter((a) => this.aiTeams.includes(a) && this.alive(a) && this.diplomacy.breakingIn(team, a) === null);
    if (allies.length === 0) return { result: 'sans-allie', sent };
    const target = { x: camp.cx, y: camp.cy };
    for (const a of allies) {
      const mine = w.units.filter((u) => u.alive && u.team === a && !u.pion && u.aiTag !== TAG_LOANED);
      const free = mine.filter((u) => (u.aiTag === TAG_FREE || u.aiTag === TAG_RALLY) && u.state !== 'attacking');
      const pool = free.length ? free : mine.filter((u) => u.aiTag !== TAG_DEFEND && u.state !== 'attacking');
      // Selon sa propre situation : moins de renfort si son camp est menacé.
      const share = this.campThreatened(a) ? EXTRAS.sosShareBusy : EXTRAS.sosShareCalm;
      let k = Math.round(pool.length * share);
      if (k === 0 && pool.length >= 2) k = 1;
      if (k === 0) continue;
      const squad = pool.sort((p, q) => Math.hypot(p.x - target.x, p.y - target.y) - Math.hypot(q.x - target.x, q.y - target.y)).slice(0, k);
      w.orderMove(squad, target, true);
      for (const u of squad) {
        u.aiTag = TAG_LOANED;
        this.loans.push({ unitId: u.id, helping: team, until: this.time + EXTRAS.sosDuration, target });
      }
      sent.set(a, squad.length);
    }
    if (sent.size === 0) return { result: 'personne', sent };
    this.sosReadyAt[team] = this.time + EXTRAS.sosCooldown;
    return { result: 'ok', sent };
  }

  /** Bouton SOS du joueur. */
  playerSos(): ActionResult {
    const r = this.callSos(this.player);
    const wait = Math.ceil(this.sosCooldownLeft());
    switch (r.result) {
      case 'off':
        return { ok: false, text: 'L’appel à l’aide n’est pas activé.' };
      case 'recharge':
        return { ok: false, text: `Patience${NB}: nouvel appel possible dans ${wait}${NB}s.` };
      case 'sans-camp':
        return { ok: false, text: 'Tu n’as plus de camp à défendre.' };
      case 'sans-allie':
        return { ok: false, text: `Personne pour t’aider${NB}: allie-toi d’abord avec une équipe.` };
      case 'personne':
        return { ok: false, text: 'Tes alliés n’ont aucun élève de libre pour l’instant.' };
      case 'ok': {
        const total = [...r.sent.values()].reduce((s, k) => s + k, 0);
        const who = [...r.sent.keys()].map((a) => this.name(a)).join(' et ');
        return { ok: true, text: `SOS${NB}! ${plural(total, 'élève')} (${who}) viennent défendre ton camp.` };
      }
    }
  }

  private updateLoans(dt: number): void {
    if (this.loans.length === 0) return;
    const w = this.world;
    this.loanCheck -= dt;
    const recheck = this.loanCheck <= 0;
    if (recheck) this.loanCheck = 0.5;
    const keep: Loan[] = [];
    for (const l of this.loans) {
      const u = w.unitById(l.unitId);
      if (!u || !u.alive) continue;
      if (this.time >= l.until || !w.isAllied(u.team, l.helping)) {
        // Fin de l'aide : l'élève retourne à la stratégie de son équipe.
        u.aiTag = TAG_FREE;
        if (u.engagedId < 0) u.clearOrder();
        continue;
      }
      keep.push(l);
      // Il reste près du camp défendu (sans lâcher un combat en cours).
      if (recheck && u.engagedId < 0 && u.order.kind === 'none' && Math.hypot(u.x - l.target.x, u.y - l.target.y) > 2.2) {
        w.orderMove([u], l.target, true);
      }
    }
    this.loans = keep;
  }

  // ---------------------------------------------------------------- tribut et trêve

  /** Secondes de trêve restantes entre a et b (0 : pas de trêve). */
  truceLeft(a: number, b = this.player): number {
    return Math.max(0, (this.truceUntil[a]?.[b] ?? -Infinity) - this.time);
  }

  /** Trêve entre a et b : les combats en cours entre eux cessent. */
  startTruce(a: number, b: number, seconds = EXTRAS.truceSeconds): void {
    if (!this.valid(a) || !this.valid(b) || a === b) return;
    this.truceUntil[a][b] = this.truceUntil[b][a] = this.time + seconds;
    for (const u of this.world.units) {
      if (u.team !== a && u.team !== b) continue;
      const e = u.engagedId >= 0 ? this.world.unitById(u.engagedId) : undefined;
      if (e && (e.team === a || e.team === b) && e.team !== u.team) {
        u.engagedId = -1;
        u.pendingHit = 0;
        if (u.order.kind === 'attack') u.clearOrder();
      }
    }
  }

  /** L'IA `ai` accepte-t-elle un tribut de `payer` ? Elle refuse si elle est sur le point de l'écraser. */
  acceptsTribute(ai: number, payer: number): boolean {
    const w = this.world;
    if (!this.nearestBonusTile(payer, ai)) return false;
    // Elle est en train de prendre un camp du payeur : une case ne vaut pas ce camp.
    if (w.tiles.some((t) => t.isCamp && t.owner === payer && t.capTeam === ai && t.cap > 0.25)) return false;
    const pw = this.diplomacy.powers();
    return pw[ai] < 3 * Math.max(0.01, pw[payer]);
  }

  /** Le joueur paie un tribut (une case bonus) à une équipe non alliée contre une trêve. */
  payTribute(to: number): ActionResult {
    const w = this.world;
    if (!this.rules.tribute || !this.valid(to) || to === this.player) return { ok: false, text: 'Le tribut n’est pas activé.' };
    if (w.isAllied(this.player, to)) return { ok: false, text: 'Pas de tribut entre alliés.' };
    if (!this.alive(to)) return { ok: false, text: 'Cette équipe est éliminée.' };
    const left = Math.ceil(this.truceLeft(to));
    if (left > 0) return { ok: false, text: `Trêve déjà en cours avec ${this.name(to)} (${left}${NB}s).` };
    const tile = this.nearestBonusTile(this.player, to);
    if (!tile) return { ok: false, text: `${cap(this.name(to))} refusent${NB}: tu n’as aucune case bonus à leur offrir.` };
    if (!this.acceptsTribute(to, this.player)) return { ok: false, text: `${cap(this.name(to))} refusent le tribut.` };
    this.transferTile(tile, this.player, to);
    this.startTruce(this.player, to);
    if (this.offer?.from === to) this.offer = null;
    return { ok: true, text: `${cap(this.name(to))} acceptent la case ${SUIT_GLYPH[tile.suit!]}${NB}: trêve de ${EXTRAS.truceSeconds}${NB}s.` };
  }

  /** Le joueur accepte la proposition de tribut en attente. */
  acceptOffer(): ActionResult {
    const o = this.offer;
    this.offer = null;
    if (!o || this.time > o.expires) return { ok: false, text: 'La proposition a expiré.' };
    if (this.world.isAllied(o.from, this.player) || !this.transferTile(o.tile, o.from, this.player))
      return { ok: false, text: 'La proposition n’est plus valable.' };
    this.startTruce(o.from, this.player);
    return { ok: true, text: `Tribut accepté${NB}: la case ${SUIT_GLYPH[o.tile.suit!]} est à toi, trêve de ${EXTRAS.truceSeconds}${NB}s avec ${this.name(o.from)}.` };
  }

  /** Le joueur refuse la proposition de tribut en attente. */
  refuseOffer(): ActionResult {
    const o = this.offer;
    this.offer = null;
    if (!o) return { ok: false, text: '' };
    return { ok: true, text: `Tu refuses le tribut ${this.des(o.from)}.` };
  }

  // ---------------------------------------------------------------- boucle

  update(dt: number): void {
    const w = this.world;
    // Fins de trêve.
    for (let a = 0; a < this.n; a++)
      for (let b = a + 1; b < this.n; b++) {
        const until = this.truceUntil[a][b];
        if (until !== -Infinity && this.time >= until) {
          this.truceUntil[a][b] = this.truceUntil[b][a] = -Infinity;
          if (a === this.player || b === this.player) this.say(`Fin de la trêve avec ${this.name(a === this.player ? b : a)}${NB}!`, true);
        }
      }
    this.updateLoans(dt);
    if (this.offer && (this.time > this.offer.expires || this.offer.tile.owner !== this.offer.from || w.isAllied(this.offer.from, this.player))) {
      if (this.time > this.offer.expires) this.say(`Proposition de tribut ${this.des(this.offer.from)} expirée.`, false);
      this.offer = null;
    }
    if (!this.rules.gifts && !this.rules.sos && !this.rules.tribute) return;
    for (const ai of this.aiTeams) {
      this.timers[ai] -= dt;
      if (this.timers[ai] > 0) continue;
      this.timers[ai] = EXTRAS.think * (0.7 + 0.6 * this.rng.next());
      if (this.alive(ai)) this.think(ai);
    }
  }

  private think(ai: number): void {
    if (this.rules.sos) this.thinkSos(ai);
    if (this.rules.gifts) this.thinkGift(ai);
    if (this.rules.tribute) this.thinkTribute(ai);
  }

  /** L'IA appelle ses alliés quand son camp est attaqué. */
  private thinkSos(ai: number): void {
    const w = this.world;
    if (this.sosCooldownLeft(ai) > 0 || w.alliesOf(ai).length === 0) return;
    const camp = this.campToDefend(ai);
    if (!camp) return;
    const p = { x: camp.cx, y: camp.cy };
    const foes = this.enemiesNear(ai, p, 3.5);
    let own = 0;
    for (const u of w.units) if (u.alive && u.team === ai && Math.hypot(u.x - p.x, u.y - p.y) < 3.5) own++;
    if (foes < 3 || foes <= own * 1.2 || this.rng.next() > EXTRAS.aiSosChance) return;
    const r = this.callSos(ai);
    const helpers = [...r.sent.keys()].map((a) => this.name(a)).join(' et ');
    if (w.isAllied(ai, this.player)) {
      // Le joueur est prévenu, même si aucune IA ne peut répondre (à lui d'y aller).
      this.sosReadyAt[ai] = Math.max(this.sosReadyAt[ai], this.time + EXTRAS.sosCooldown);
      this.say(`${cap(this.name(ai))} appellent à l’aide${NB}: leur camp est attaqué${NB}!${r.sent.size ? ` ${cap(helpers)} y vont.` : ''}`, true);
    } else if (r.result === 'ok') {
      this.say(`${cap(helpers)} volent au secours ${this.des(ai)}.`, false);
    }
  }

  /** Un allié en difficulté reçoit parfois quelques élèves (ou une case) d'une IA alliée. */
  private thinkGift(ai: number): void {
    const w = this.world;
    if (this.time < this.giftReadyAt[ai]) return;
    const mine = w.units.filter((u) => u.alive && u.team === ai && !u.pion && u.aiTag !== TAG_LOANED);
    if (mine.length < 8) return;
    const pw = this.diplomacy.powers();
    const needy = w
      .alliesOf(ai)
      .filter((t) => this.alive(t) && this.diplomacy.breakingIn(ai, t) === null)
      .filter((t) => w.teamUnitCount(t) <= 4 || pw[t] < 0.45 * pw[ai] || (w.teamCampCount(t) === 0 && w.teamUnitCount(t) > 0))
      .sort((a, b) => pw[a] - pw[b]);
    if (needy.length === 0 || this.rng.next() > EXTRAS.giftChance) return;
    const to = needy[0];
    this.giftReadyAt[ai] = this.time + EXTRAS.giftCooldown;
    const tile = w.teamTileCount(ai) >= 3 && this.rng.next() < 0.3 ? this.nearestBonusTile(ai, to) : null;
    if (tile && this.cedeTile(ai, to, tile)) {
      const glyph = SUIT_GLYPH[tile.suit!];
      if (to === this.player) this.say(`Cadeau${NB}! ${cap(this.name(ai))} te cèdent une case ${glyph}.`, true);
      else this.say(`${cap(this.name(ai))} cèdent une case ${glyph} ${this.aux(to)}.`, false);
      return;
    }
    const free = mine.filter((u) => (u.aiTag === TAG_FREE || u.aiTag === TAG_RALLY) && u.state !== 'attacking');
    const k = Math.min(4, Math.max(2, Math.floor(mine.length * 0.2)), free.length);
    if (k === 0) return;
    const home = this.anchors(to)[0];
    const squad = free.sort((p, q) => Math.hypot(p.x - home.x, p.y - home.y) - Math.hypot(q.x - home.x, q.y - home.y)).slice(0, k);
    const given = this.giftUnits(ai, to, squad.map((u) => u.id));
    if (given.length === 0) return;
    // Les élèves offerts rejoignent leur nouvelle équipe.
    w.orderMove(given, home, false);
    if (to === this.player) this.say(`Cadeau${NB}! ${cap(this.name(ai))} t’offrent ${plural(given.length, 'élève')}.`, true);
    else this.say(`${cap(this.name(ai))} offrent ${plural(given.length, 'élève')} ${this.aux(to)}.`, false);
  }

  /** Une IA en mauvaise posture face au joueur lui propose un tribut. */
  private thinkTribute(ai: number): void {
    const w = this.world;
    const me = this.player;
    if (this.offer || this.time < this.offerReadyAt[ai] || w.isAllied(ai, me) || this.truceLeft(ai, me) > 0 || !this.alive(me)) return;
    const tile = this.nearestBonusTile(ai, me);
    if (!tile) return;
    const pw = this.diplomacy.powers();
    const losingCamp = w.tiles.some((t) => t.isCamp && t.owner === ai && t.capTeam === me && t.cap > 0.2);
    let siege = 0;
    for (const t of w.tiles) {
      if (!t.isCamp || t.owner !== ai) continue;
      for (const u of w.units) if (u.alive && u.team === me && Math.hypot(u.x - t.cx, u.y - t.cy) < 4) siege++;
    }
    const bad = losingCamp || (pw[me] > 1.8 * pw[ai] && siege >= 3);
    if (!bad || this.rng.next() > EXTRAS.offerChance) return;
    this.offerReadyAt[ai] = this.time + EXTRAS.offerCooldown;
    this.offer = { from: ai, tile, expires: this.time + EXTRAS.offerSeconds };
    this.say(`${cap(this.name(ai))} proposent un tribut${NB}: une case ${SUIT_GLYPH[tile.suit!]} contre ${EXTRAS.truceSeconds}${NB}s de trêve.`, true);
  }
}
