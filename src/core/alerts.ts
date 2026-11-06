// Alertes (saison 1, point 1.4) : case attaquée, case perdue, camp en danger.
// Un joueur sur téléphone ne voit pas toute la cour : le jeu le prévient, sans le noyer.
// Logique pure, sans DOM : pilotée par Game, testée par Vitest.
import type { Suit } from './types';
import { NO_TEAM } from './types';
import type { Tile } from './tile';
import type { World } from './world';

export const ALERTS = {
  /** Rayon (cases) autour d'une case où un ennemi compte comme une menace. */
  radius: 2.6,
  /** Secondes de menace continue avant d'alerter (un ennemi qui passe ne déclenche rien). */
  delay: 2,
  /** Secondes de calme avant qu'une case déjà signalée puisse l'être à nouveau. */
  calm: 12,
  /** Écart minimal entre deux alertes (les menaces en attente sont regroupées). */
  minGap: 6,
  /** Intervalle entre deux examens de la cour (s). */
  scanEvery: 0.25,
};

export type AlertKind = 'camp' | 'perdue' | 'attaque';

export interface Alert {
  kind: AlertKind;
  /** Nombre de cases concernées (alerte regroupée au-delà de 1). */
  count: number;
  /** Point où emmener la caméra : la case la plus urgente. */
  x: number;
  y: number;
  text: string;
}

const GLYPH: Record<Suit, string> = { heart: '♥', spade: '♠', club: '♣', diamond: '♦' };
const RANK: Record<AlertKind, number> = { camp: 0, perdue: 1, attaque: 2 };

interface Watch {
  /** Début de la menace en cours (heure de jeu), ou null. */
  since: number | null;
  /** Dernière heure où la case était menacée. */
  lastThreat: number;
  /** Déjà signalée pendant cette menace. */
  told: boolean;
}

interface Pending {
  kind: AlertKind;
  tile: Tile;
  urgency: number;
}

/** Nom court d'une case pour le bandeau. */
function tileName(t: Tile): string {
  if (t.isCamp) return 'camp';
  if (t.kind === 'throne') return 'trône';
  return `case ${t.suit ? GLYPH[t.suit] : ''}`.trim();
}

/** Texte du bandeau. */
export function alertText(kind: AlertKind, tile: Tile, count: number): string {
  const nb = ' ';
  if (count > 1) {
    if (kind === 'perdue') return `${count} cases perdues${nb}!`;
    if (kind === 'camp') return `Ton camp est attaqué, et ${count - 1} autre${count > 2 ? 's' : ''} case${count > 2 ? 's' : ''}${nb}!`;
    return `${count} cases attaquées`;
  }
  if (kind === 'camp') return `Ton camp est attaqué${nb}!`;
  if (kind === 'perdue') return tile.isCamp ? `Camp perdu${nb}!` : `${capitalize(tileName(tile))} perdue`;
  return `${capitalize(tileName(tile))} attaquée`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Surveille les cases d'une équipe et produit des alertes :
 *  - « camp » : un de ses camps est menacé (ennemis à moins de 2,6 cases ou jauge ennemie) ;
 *  - « attaque » : une case bonus ou le trône est menacé depuis plus de 2 s ;
 *  - « perdue » : une case ou un camp vient de changer de main.
 * Une case n'est signalée qu'une fois par attaque (puis après 12 s de calme), et deux alertes sont
 * séparées d’au moins 6 s : ce qui arrive entre-temps est regroupé (« 3 cases attaquées »),
 * l'alerte pointant la case la plus urgente (camp, puis case perdue, puis jauge la plus avancée).
 */
export class AlertWatcher {
  private readonly watch = new Map<Tile, Watch>();
  private readonly owned = new Set<Tile>();
  private pending: Pending[] = [];
  private lastAlert = -Infinity;
  private scanTimer = 0;

  constructor(
    readonly world: World,
    readonly team: number,
  ) {
    for (const t of world.tiles) if (t.owner === team) this.owned.add(t);
  }

  /** Ennemis vivants (élèves, pions compris) autour d'une case. */
  private threatened(t: Tile): boolean {
    const w = this.world;
    if (t.capTeam !== NO_TEAM && t.capTeam !== this.team && t.cap > 0.02 && !w.isFriend(t.capTeam, this.team)) return true;
    const r2 = ALERTS.radius * ALERTS.radius;
    for (const u of w.units) {
      if (!u.alive || w.isFriend(u.team, this.team)) continue;
      const dx = u.x - t.cx;
      const dy = u.y - t.cy;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  /** À appeler à chaque pas de simulation ; retourne une alerte à afficher, ou null. */
  update(dt: number): Alert | null {
    this.scanTimer += dt;
    if (this.scanTimer < ALERTS.scanEvery) return null;
    this.scanTimer = 0;
    const w = this.world;
    const now = w.time;
    for (const t of w.tiles) {
      const mine = t.owner === this.team;
      // Case perdue (elle était à nous au dernier examen).
      if (!mine) {
        if (this.owned.delete(t) && t.owner !== NO_TEAM && !w.isFriend(t.owner, this.team)) {
          this.pending = this.pending.filter((p) => p.tile !== t);
          this.pending.push({ kind: 'perdue', tile: t, urgency: t.isCamp ? 2 : 1 });
        }
        this.watch.delete(t);
        continue;
      }
      this.owned.add(t);
      let s = this.watch.get(t);
      if (!s) this.watch.set(t, (s = { since: null, lastThreat: -Infinity, told: false }));
      if (this.threatened(t)) {
        if (s.since === null) s.since = now;
        s.lastThreat = now;
        if (!s.told && now - s.since >= ALERTS.delay) {
          s.told = true;
          const urgency = t.capTeam !== this.team && t.capTeam !== NO_TEAM ? t.cap : 0;
          this.pending.push({ kind: t.isCamp ? 'camp' : 'attaque', tile: t, urgency });
        }
      } else {
        s.since = null;
        if (s.told && now - s.lastThreat >= ALERTS.calm) s.told = false;
      }
    }
    // Menaces terminées avant d'avoir été annoncées : on les oublie.
    this.pending = this.pending.filter((p) => p.kind === 'perdue' || (p.tile.owner === this.team && this.watch.get(p.tile)?.since !== null));
    if (!this.pending.length || now - this.lastAlert < ALERTS.minGap) return null;
    const list = this.pending.sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.urgency - a.urgency);
    this.lastAlert = now;
    const top = list[0];
    const same = list.filter((p) => (top.kind === 'perdue' ? p.kind === 'perdue' : p.kind !== 'perdue'));
    // L'autre famille (pertes ou menaces) attend l'alerte suivante.
    this.pending = list.filter((p) => !same.includes(p));
    return { kind: top.kind, count: same.length, x: top.tile.cx, y: top.tile.cy, text: alertText(top.kind, top.tile, same.length) };
  }
}
