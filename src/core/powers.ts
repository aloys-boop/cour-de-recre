// Pouvoirs de récré : payés en bons points, avec une recharge par équipe, lancés sur une zone.
//  - Sonnerie : fige les ennemis dans le rayon (ils ne bougent ni ne frappent) ;
//  - Boules de neige : dégâts de zone sur les ennemis ;
//  - Goûter : soigne les élèves amis dans le rayon.
import { MERITS, awardMerit, canAfford, spendMerits } from './merits';
import { PION } from './pion';
import { unitVisible } from './fog';
import type { Unit } from './unit';
import type { World } from './world';

export type PowerId = 'sonnerie' | 'neige' | 'gouter';

export const POWER_IDS: readonly PowerId[] = ['sonnerie', 'neige', 'gouter'];

export interface PowerInfo {
  label: string;
  /** Effet en clair (bouton, aperçu). */
  blurb: string;
  cost: number;
  /** Recharge après usage (secondes). */
  cooldown: number;
  /** Rayon de la zone (cellules). */
  radius: number;
  /** Sonnerie : durée du gel ; neige : dégâts ; goûter : PV rendus. */
  power: number;
}

/** Réglages (valeurs réglées par simulation, voir README). */
export const POWERS: Record<PowerId, PowerInfo> = {
  sonnerie: { label: 'Sonnerie', blurb: 'Fige les ennemis 3 s', cost: 30, cooldown: 60, radius: 2.2, power: 3 },
  neige: { label: 'Boules de neige', blurb: 'Dégâts sur une zone', cost: 35, cooldown: 50, radius: 1.8, power: 30 },
  gouter: { label: 'Goûter', blurb: 'Soigne tes élèves', cost: 25, cooldown: 45, radius: 2.4, power: 45 },
};

export interface PowerEvent {
  kind: 'power';
  id: PowerId;
  team: number;
  x: number;
  y: number;
  radius: number;
  /** Élèves touchés (figés, blessés ou soignés). */
  hits: number;
}

/** Recharges en cours : fin de recharge (temps du monde) par équipe et par pouvoir. */
export class PowerState {
  readonly readyAt: Record<PowerId, number>[] = [];
  constructor(numTeams: number) {
    for (let t = 0; t < numTeams; t++) this.readyAt.push({ sonnerie: 0, neige: 0, gouter: 0 });
  }
}

/** Secondes de recharge restantes d'un pouvoir pour une équipe. */
export function powerCooldown(world: World, team: number, id: PowerId): number {
  return Math.max(0, (world.powers.readyAt[team]?.[id] ?? 0) - world.time);
}

export type PowerResult = 'ok' | 'recharge' | 'pas-assez' | 'hors-carte';

/** Lance un pouvoir de l'équipe en (x, y). */
export function castPower(world: World, team: number, id: PowerId, x: number, y: number): PowerResult {
  const info = POWERS[id];
  if (x < 0 || y < 0 || x >= world.map.w || y >= world.map.h) return 'hors-carte';
  if (powerCooldown(world, team, id) > 0) return 'recharge';
  if (!canAfford(world, team, info.cost)) return 'pas-assez';
  spendMerits(world, team, info.cost);
  world.powers.readyAt[team][id] = world.time + info.cooldown;
  const targets = unitsInZone(world, x, y, info.radius, (u) => (id === 'gouter' ? world.isFriend(u.team, team) : !world.isFriend(u.team, team)));
  let hits = 0;
  for (const u of targets) {
    if (id === 'sonnerie') {
      u.frozenUntil = world.time + info.power;
      u.engagedId = -1;
      u.supId = 0;
      u.pendingHit = 0;
      hits++;
    } else if (id === 'neige') {
      const ko = u.takeDamage(info.power, x, y);
      world.events.push({ kind: 'hit', x: u.x, y: u.y, team: u.team });
      hits++;
      if (ko) {
        world.events.push({ kind: 'ko', x: u.x, y: u.y, team: u.team, by: team });
        awardMerit(world, team, u.pion ? PION.koReward : MERITS.koUnit, u.x, u.y, 'ko');
      }
    } else if (u.hp < u.maxHp) {
      u.hp = Math.min(u.maxHp, u.hp + info.power);
      u.healedAt = world.time;
      hits++;
    }
  }
  world.events.push({ kind: 'power', id, team, x, y, radius: info.radius, hits });
  return 'ok';
}

/** Élèves vivants dans un disque (cellules), filtrés. */
export function unitsInZone(world: World, x: number, y: number, r: number, accept: (u: Unit) => boolean): Unit[] {
  const out: Unit[] = [];
  const r2 = r * r;
  for (const u of world.units) {
    if (!u.alive || !accept(u)) continue;
    const dx = u.x - x;
    const dy = u.y - y;
    if (dx * dx + dy * dy <= r2) out.push(u);
  }
  return out;
}

/** L'élève est-il figé par une sonnerie ? */
export function frozen(world: World, u: Unit): boolean {
  return u.frozenUntil > world.time;
}

/**
 * Meilleur point d'impact d'un pouvoir pour une IA : centre d'un élève (ennemi pour la sonnerie et
 * la neige, ami blessé pour le goûter) qui maximise le nombre d'élèves touchés dans le rayon.
 * Retourne la position et le nombre d'élèves touchés (pondéré pour le goûter par les PV manquants).
 */
export function bestPowerSpot(world: World, team: number, id: PowerId): { x: number; y: number; score: number } | null {
  const info = POWERS[id];
  const heal = id === 'gouter';
  const r2 = info.radius * info.radius;
  const accept = (u: Unit) =>
    u.alive &&
    (heal ? world.isFriend(u.team, team) && u.hp < u.maxHp * 0.7 : !world.isFriend(u.team, team) && unitVisible(world, team, u) && !(id === 'sonnerie' && frozen(world, u)));
  const cands = world.units.filter(accept);
  if (cands.length === 0) return null;
  const step = Math.max(1, Math.floor(cands.length / 40)); // au plus ~40 centres essayés
  let best: { x: number; y: number; score: number } | null = null;
  for (let i = 0; i < cands.length; i += step) {
    const c = cands[i];
    let score = 0;
    world.hash.query(c.x, c.y, info.radius, (u) => {
      if (!accept(u)) return;
      const dx = u.x - c.x;
      const dy = u.y - c.y;
      if (dx * dx + dy * dy > r2) return;
      score += heal ? Math.min(1, (u.maxHp - u.hp) / info.power) : 1;
    });
    if (!best || score > best.score) best = { x: c.x, y: c.y, score };
  }
  return best;
}
