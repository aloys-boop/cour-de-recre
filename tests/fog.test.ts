import { describe, expect, it } from 'vitest';
import { TeamAi } from '../src/core/ai';
import { canTargetUnit, eventPerceived, FOG_INTERVAL, fogFor, pointVisible, tileView, unitVisible } from '../src/core/fog';
import { RULE_TOGGLES } from '../src/core/rules';
import { NO_TEAM, type MapDef } from '../src/core/types';
import { World } from '../src/core/world';

/** Cour 20 × 20 sans élèves de départ ; le camp du joueur au coin nord. */
const COUR: MapDef = {
  id: 'brouillard',
  name: 'Brouillard',
  w: 20,
  h: 20,
  teams: 3,
  unitCap: 10,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 18, y: 18, owner: 1 },
    { kind: 'camp', x: 0, y: 18, owner: 2 },
    { kind: 'bonus', x: 15, y: 4, suit: 'heart' },
  ],
};

function world(fog: boolean): World {
  const w = new World(COUR, 3, 3);
  w.rules = { mode: 'classique', fog };
  return w;
}

describe('brouillard de guerre', () => {
  it('est proposé dans les options d’escarmouche, désactivé par défaut', () => {
    expect(RULE_TOGGLES.some((t) => t.key === 'fog')).toBe(true);
    expect(new World(COUR, 3, 3).rules.fog).toBeFalsy();
  });

  it('option inactive : tout est visible et ciblable', () => {
    const w = world(false);
    const foe = w.spawnUnit(1, 15, 15, false);
    expect(fogFor(w, 0)).toBeNull();
    expect(pointVisible(w, 0, 17, 2)).toBe(true);
    expect(unitVisible(w, 0, foe)).toBe(true);
    expect(canTargetUnit(w, 0, foe)).toBe(true);
    expect(tileView(w, 0, w.tiles[1])).toEqual({ owner: 1, visible: true, seen: true });
  });

  it('option active : visible près d’un élève du joueur, pas au loin', () => {
    const w = world(true);
    w.spawnUnit(0, 10.5, 10.5, false);
    expect(pointVisible(w, 0, 12.5, 10.5)).toBe(true); // 2 cases
    expect(pointVisible(w, 0, 10.5, 13.5)).toBe(true); // 3 cases
    expect(pointVisible(w, 0, 15.5, 10.5)).toBe(false); // 5 cases
    expect(pointVisible(w, 0, 1, 1)).toBe(true); // sur son camp
    expect(pointVisible(w, 0, 4.2, 1)).toBe(true); // à 2,2 cases du bord du camp
    expect(pointVisible(w, 0, 5.5, 5.5)).toBe(false); // ni élève ni case proche
    // Le camp ennemi lointain : jamais vu, propriétaire inconnu.
    expect(tileView(w, 0, w.tiles[1])).toEqual({ owner: NO_TEAM, visible: false, seen: false });
  });

  it('le déjà-vu est conservé, avec le dernier propriétaire observé des cases', () => {
    const w = world(true);
    const scout = w.spawnUnit(0, 15.5, 5.5, false);
    const heart = w.tiles[3];
    heart.owner = 1;
    fogFor(w, 0, true);
    expect(tileView(w, 0, heart)).toEqual({ owner: 1, visible: true, seen: true });
    // L'éclaireur s'en va ; la case change de main hors de sa vue.
    scout.x = 3;
    scout.y = 3;
    heart.owner = 2;
    const fog = fogFor(w, 0, true)!;
    expect(fog.cellVisible(15, 4)).toBe(false);
    expect(fog.cellSeen(15, 4)).toBe(true);
    expect(fog.cellSeen(12, 12)).toBe(false);
    expect(tileView(w, 0, heart)).toEqual({ owner: 1, visible: false, seen: true });
  });

  it('les alliés partagent la vision', () => {
    const w = world(true);
    w.spawnUnit(1, 15.5, 15.5, false);
    const foe = w.spawnUnit(2, 16.5, 14.5, false);
    expect(pointVisible(w, 0, 15.5, 15.5)).toBe(false);
    expect(unitVisible(w, 0, foe)).toBe(false);
    w.setAllied(0, 1, true);
    fogFor(w, 0, true);
    expect(pointVisible(w, 0, 15.5, 15.5)).toBe(true);
    expect(pointVisible(w, 0, 19, 19)).toBe(true); // camp de l'allié
    expect(unitVisible(w, 0, foe)).toBe(true);
    // Un allié reste toujours visible, même loin de tout.
    const far = w.spawnUnit(1, 5.5, 12.5, false);
    expect(unitVisible(w, 0, far)).toBe(true);
  });

  it('un ennemi caché n’est pas ciblable ; il le devient en vue', () => {
    const w = world(true);
    const mine = w.spawnUnit(0, 8.5, 8.5, false);
    const foe = w.spawnUnit(1, 14.5, 8.5, false);
    expect(canTargetUnit(w, 0, foe)).toBe(false);
    mine.x = 12;
    fogFor(w, 0, true);
    expect(canTargetUnit(w, 0, foe)).toBe(true);
    expect(canTargetUnit(w, 0, mine)).toBe(false); // jamais ses propres élèves
  });

  it('les sons de combat hors vue sont coupés, pas les annonces', () => {
    const w = world(true);
    w.spawnUnit(0, 8.5, 8.5, false);
    expect(eventPerceived(w, 0, { kind: 'punch', x: 9, y: 9 })).toBe(true);
    expect(eventPerceived(w, 0, { kind: 'hit', x: 16, y: 9 })).toBe(false);
    expect(eventPerceived(w, 0, { kind: 'noCamp', x: 16, y: 9 })).toBe(true);
  });

  it('recalcule au plus toutes les 0,1 s de jeu', () => {
    const w = world(true);
    w.spawnUnit(0, 8.5, 8.5, false);
    const fog = fogFor(w, 0)!;
    const n = fog.computeCount;
    for (let i = 0; i < 60; i++) {
      w.update(1 / 60);
      fogFor(w, 0);
    }
    expect(fog.computeCount - n).toBeLessThanOrEqual(Math.ceil(1 / FOG_INTERVAL) + 1);
    expect(fog.computeCount - n).toBeGreaterThanOrEqual(8);
  });

  it('l’IA ne voit que ce que voient ses élèves et ses cases', () => {
    const w = world(true);
    const ai = new TeamAi(w, 1, 'normal');
    const hidden = w.spawnUnit(0, 3.5, 10.5, false);
    w.spawnUnit(1, 16.5, 16.5, false);
    expect(unitVisible(w, 1, hidden)).toBe(false);
    ai.update(5); // ne doit pas planter sans ennemi visible
    hidden.x = 15;
    hidden.y = 15;
    fogFor(w, 1, true);
    expect(unitVisible(w, 1, hidden)).toBe(true);
  });
});
