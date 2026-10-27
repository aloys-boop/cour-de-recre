import { describe, expect, it } from 'vitest';
import { EconomyAi } from '../src/core/ai-economy';
import { TeamAi } from '../src/core/ai';
import { awardMerit, meritsOf } from '../src/core/merits';
import { buyPion, PION, pionOf, pionRespawnLeft } from '../src/core/pion';
import { castPower, frozen, POWERS, powerCooldown } from '../src/core/powers';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 16,
  h: 16,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 14, y: 14, owner: 1 },
  ],
};

function tick(world: World, seconds: number, each?: () => void) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) {
    each?.();
    world.update(step);
  }
}

function rich(w: World, team: number, n = 1000) {
  awardMerit(w, team, n, 0, 0, 'hold');
  w.drainEvents();
}

describe('pouvoirs de récré', () => {
  it('coûts en bons points, recharge de 45 à 60 s', () => {
    for (const p of Object.values(POWERS)) {
      expect(p.cost).toBeGreaterThan(0);
      expect(p.cooldown).toBeGreaterThanOrEqual(45);
      expect(p.cooldown).toBeLessThanOrEqual(60);
    }
    const w = new World(ARENA, 2, 1);
    expect(castPower(w, 0, 'neige', 8, 8)).toBe('pas-assez');
    rich(w, 0, POWERS.neige.cost);
    expect(castPower(w, 0, 'neige', 8, 8)).toBe('ok');
    expect(meritsOf(w, 0)).toBe(0);
    rich(w, 0);
    expect(castPower(w, 0, 'neige', 8, 8)).toBe('recharge');
    expect(powerCooldown(w, 0, 'neige')).toBe(POWERS.neige.cooldown);
    tick(w, POWERS.neige.cooldown + 0.1);
    expect(castPower(w, 0, 'neige', 8, 8)).toBe('ok');
    expect(castPower(w, 0, 'gouter', -1, 8)).toBe('hors-carte');
  });

  it('Sonnerie : fige les ennemis du rayon pendant 3 s, pas les amis', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 0);
    const foe = w.spawnUnit(1, 8, 8, false);
    const far = w.spawnUnit(1, 8, 12, false);
    const mine = w.spawnUnit(0, 8.5, 8, false);
    w.orderMove([foe, far], { x: 2, y: 8 });
    w.orderMove([mine], { x: 14, y: 8 });
    expect(castPower(w, 0, 'sonnerie', 8, 8)).toBe('ok');
    const x0 = foe.x;
    tick(w, 2.9);
    expect(foe.x).toBeCloseTo(x0, 5);
    expect(frozen(w, foe)).toBe(true);
    expect(frozen(w, mine)).toBe(false);
    expect(mine.x).toBeGreaterThan(9);
    expect(far.x).toBeLessThan(7.5);
    tick(w, 0.5);
    expect(frozen(w, foe)).toBe(false);
    tick(w, 1);
    expect(foe.x).toBeLessThan(x0 - 0.5);
  });

  it('Sonnerie : un élève figé ne frappe pas', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 0);
    const foe = w.spawnUnit(1, 8, 8, false);
    const mine = w.spawnUnit(0, 8.4, 8, false);
    castPower(w, 0, 'sonnerie', 8, 8);
    const hp = mine.hp;
    tick(w, 2.5);
    expect(mine.hp).toBe(hp);
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });

  it('Boules de neige : dégâts de zone sur les ennemis, KO récompensés', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 0, POWERS.neige.cost);
    const a = w.spawnUnit(1, 8, 8, false);
    const b = w.spawnUnit(1, 8.8, 8.3, false);
    const weak = w.spawnUnit(1, 7.5, 8, false);
    const out = w.spawnUnit(1, 8, 11, false);
    const mine = w.spawnUnit(0, 8.2, 7.6, false);
    weak.hp = 5;
    castPower(w, 0, 'neige', 8, 8);
    expect(a.hp).toBe(a.maxHp - POWERS.neige.power);
    expect(b.hp).toBe(b.maxHp - POWERS.neige.power);
    expect(weak.alive).toBe(false);
    expect(out.hp).toBe(out.maxHp);
    expect(mine.hp).toBe(mine.maxHp);
    expect(meritsOf(w, 0)).toBe(2);
    const ev = w.drainEvents();
    expect(ev.some((e) => e.kind === 'power' && e.id === 'neige' && e.hits === 3)).toBe(true);
  });

  it('Goûter : soigne les élèves amis du rayon', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 0);
    const mine = w.spawnUnit(0, 8, 8, false);
    const foe = w.spawnUnit(1, 8.5, 8, false);
    mine.hp = 10;
    foe.hp = 10;
    castPower(w, 0, 'gouter', 8, 8);
    expect(mine.hp).toBe(10 + POWERS.gouter.power);
    expect(foe.hp).toBe(10);
  });

  it('IA : pas de pouvoir en Facile ; en Normal, une sonnerie sur un gros groupe ennemi au contact', () => {
    const setup = () => {
      const w = new World(ARENA, 2, 1);
      rich(w, 1);
      for (let i = 0; i < 8; i++) w.spawnUnit(0, 7 + (i % 4) * 0.4, 7 + Math.floor(i / 4) * 0.4, false);
      for (let i = 0; i < 5; i++) w.spawnUnit(1, 8.5 + (i % 3) * 0.4, 9, false);
      w.update(1 / 60);
      return w;
    };
    const easy = setup();
    const e = new EconomyAi(easy, 1, 'facile');
    expect(e.usePowers()).toBe(false);
    const normal = setup();
    const n = new EconomyAi(normal, 1, 'difficile');
    expect(n.usePowers()).toBe(true);
    const ev = normal.drainEvents().find((x) => x.kind === 'power');
    expect(ev && ev.kind === 'power' && ev.id).toBe('sonnerie');
    expect(normal.units.filter((u) => u.team === 0 && frozen(normal, u)).length).toBeGreaterThanOrEqual(6);
  });
});

describe('pion', () => {
  it('achat une fois par camp, coûteux, 400 PV, ne compte pas dans l’effectif', () => {
    const w = new World(ARENA, 2, 1);
    expect(buyPion(w, 0, w.tiles[0])).toBe('pas-assez');
    rich(w, 0, PION.cost + 10);
    expect(buyPion(w, 0, w.tiles[1])).toBe('pas-ton-camp');
    expect(buyPion(w, 0, w.tiles[0])).toBe('ok');
    expect(meritsOf(w, 0)).toBe(10);
    expect(buyPion(w, 0, w.tiles[0])).toBe('deja');
    const p = pionOf(w, w.tiles[0])!;
    expect(p.maxHp).toBe(400);
    expect(p.hp).toBe(400);
    expect(w.teamUnitCount(0)).toBe(0);
    expect(w.stats()[0].units).toBe(0);
    w.refreshMods();
    expect(p.maxHp).toBe(400);
  });

  it('reste près du camp et frappe les intrus, sans les poursuivre au loin', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 0);
    buyPion(w, 0, w.tiles[0]);
    const p = pionOf(w, w.tiles[0])!;
    const intruder = w.spawnUnit(1, 3, 2.5, false);
    tick(w, 3);
    expect(intruder.alive).toBe(false);
    // Un ennemi qui passe loin du camp n'est pas pris en chasse.
    const passer = w.spawnUnit(1, 8, 8, false);
    tick(w, 3);
    expect(passer.alive).toBe(true);
    expect(Math.hypot(p.x - 1, p.y - 1)).toBeLessThan(2.5);
    // Un intrus qui s'enfuit : le pion ne le suit pas au-delà de sa laisse.
    const runner = w.spawnUnit(1, 2.8, 2.8, false);
    tick(w, 0.4);
    w.orderMove([runner], { x: 14, y: 2 });
    tick(w, 6);
    expect(Math.hypot(p.x - 1, p.y - 1)).toBeLessThan(PION.leash + 0.5);
  });

  it('réapparaît 60 s après un KO ; disparaît si le camp est capturé', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 0);
    buyPion(w, 0, w.tiles[0]);
    const p = pionOf(w, w.tiles[0])!;
    p.takeDamage(1000, 0, 0);
    tick(w, 2);
    expect(pionOf(w, w.tiles[0])).toBeNull();
    expect(pionRespawnLeft(w, w.tiles[0])).toBeGreaterThan(57);
    tick(w, 58.5);
    const back = pionOf(w, w.tiles[0]);
    expect(back).not.toBeNull();
    expect(back!.hp).toBe(400);
    // Camp capturé : le pion s'en va et ne revient pas.
    w.tiles[0].owner = 1;
    tick(w, 2);
    expect(pionOf(w, w.tiles[0])).toBeNull();
    expect(w.tiles[0].pionBought).toBe(false);
    tick(w, 61);
    expect(w.units.some((u) => u.pion)).toBe(false);
  });

  it('mettre un pion KO rapporte des bons points', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 0);
    buyPion(w, 0, w.tiles[0]);
    const p = pionOf(w, w.tiles[0])!;
    p.hp = 3;
    const before = meritsOf(w, 1);
    w.spawnUnit(1, p.x + 0.4, p.y, false);
    tick(w, 3);
    expect(p.alive).toBe(false);
    expect(meritsOf(w, 1) - before).toBe(PION.koReward);
  });

  it('l’IA ne commande pas son pion et en achète un pour un camp menacé', () => {
    const w = new World(ARENA, 2, 1);
    rich(w, 1, PION.cost);
    for (let i = 0; i < 8; i++) w.spawnUnit(0, 13 + (i % 3) * 0.4, 12.5 + Math.floor(i / 3) * 0.4, false);
    w.update(1 / 60);
    const eco = new EconomyAi(w, 1, 'expert');
    expect(eco.buyPionIfUseful([w.tiles[1]])).toBe(true);
    const ai = new TeamAi(w, 1, 'expert');
    const p = pionOf(w, w.tiles[1])!;
    tick(w, 3, () => ai.update(1 / 60));
    expect(p.aiTag).toBe(0);
  });
});
