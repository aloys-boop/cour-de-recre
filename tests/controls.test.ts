import { describe, expect, it } from 'vitest';
import { centroid, ControlGroups, DoubleTap, nearestOwnCamp, onScreen } from '../src/core/controls';
import { generateMap, LEVELS } from '../src/core/maps';
import { World } from '../src/core/world';

describe('groupes mémorisés', () => {
  it('enregistre une sélection puis la rappelle', () => {
    const g = new ControlGroups();
    expect(g.count).toBe(3);
    expect(g.save(0, [4, 7, 9])).toBe(true);
    expect(g.recall(0, () => true)).toEqual([4, 7, 9]);
    expect(g.recall(1, () => true)).toEqual([]);
  });

  it('ne rappelle que les élèves encore en vie et oublie les disparus', () => {
    const g = new ControlGroups();
    g.save(1, [1, 2, 3, 4]);
    const alive = new Set([2, 4]);
    expect(g.aliveCount(1, (id) => alive.has(id))).toBe(2);
    expect(g.ids(1)).toEqual([1, 2, 3, 4]); // le décompte ne modifie rien
    expect(g.recall(1, (id) => alive.has(id))).toEqual([2, 4]);
    expect(g.ids(1)).toEqual([2, 4]);
  });

  it('un nouvel enregistrement remplace le groupe, sans doublons', () => {
    const g = new ControlGroups();
    g.save(2, [1, 2]);
    g.save(2, [5, 5, 6]);
    expect(g.ids(2)).toEqual([5, 6]);
    g.clear(2);
    expect(g.ids(2)).toEqual([]);
  });

  it('ignore les emplacements invalides', () => {
    const g = new ControlGroups();
    expect(g.save(3, [1])).toBe(false);
    expect(g.save(-1, [1])).toBe(false);
    expect(g.recall(5, () => true)).toEqual([]);
    expect(g.aliveCount(1.5, () => true)).toBe(0);
  });

  it('les groupes sont indépendants', () => {
    const g = new ControlGroups();
    const ids = [1, 2];
    g.save(0, ids);
    ids.push(3); // la sélection d'origine peut changer ensuite
    expect(g.ids(0)).toEqual([1, 2]);
    expect(g.ids(1)).toEqual([]);
  });
});

describe('repli au camp', () => {
  const tiles = [
    { isCamp: true, owner: 0, cx: 2, cy: 2 },
    { isCamp: true, owner: 1, cx: 10, cy: 10 },
    { isCamp: true, owner: 0, cx: 18, cy: 18 },
    { isCamp: false, owner: 0, cx: 11, cy: 11 },
  ];

  it('choisit le camp de l’équipe le plus proche du centre de la sélection', () => {
    expect(nearestOwnCamp(tiles, 0, { x: 3, y: 4 })).toBe(tiles[0]);
    expect(nearestOwnCamp(tiles, 0, { x: 12, y: 13 })).toBe(tiles[2]);
  });

  it('ignore les cases bonus et les camps adverses', () => {
    // La case bonus (11, 11) et le camp adverse (10, 10) sont plus près, mais ne comptent pas.
    expect(nearestOwnCamp(tiles, 0, { x: 10.5, y: 10.5 })?.cx).toBe(18);
    expect(nearestOwnCamp(tiles, 1, { x: 0, y: 0 })).toBe(tiles[1]);
  });

  it('renvoie null si l’équipe n’a plus de camp', () => {
    expect(nearestOwnCamp(tiles, 2, { x: 0, y: 0 })).toBeNull();
  });

  it('centre d’un ensemble de positions', () => {
    expect(centroid([])).toBeNull();
    expect(centroid([{ x: 0, y: 0 }, { x: 4, y: 2 }])).toEqual({ x: 2, y: 1 });
  });

  it('un ordre de repli vers le camp ramène les élèves et les soigne', () => {
    const map = generateMap(LEVELS[0], 42);
    const w = new World(map, map.teams, 7);
    const mine = w.units.filter((u) => u.team === 0);
    const camp = nearestOwnCamp(w.tiles, 0, centroid(mine.map((u) => u.pos))!)!;
    expect(camp.owner).toBe(0);
    // On éloigne et on blesse les élèves, puis on les renvoie au camp.
    for (const u of mine) {
      u.x = map.w / 2;
      u.y = map.h / 2;
      u.hp = 1;
    }
    w.orderMove(mine, { x: camp.cx, y: camp.cy });
    expect(mine.every((u) => u.order.kind === 'move' && !u.order.engage)).toBe(true);
    for (let t = 0; t < 30; t += 1 / 60) w.update(1 / 60);
    const healed = mine.filter((u) => u.alive && camp.contains(u.x, u.y) && u.hp > 1);
    expect(healed.length).toBeGreaterThan(0);
  });
});

describe('double-tap', () => {
  it('reconnaît un second tap rapide sur la même cible', () => {
    const d = new DoubleTap(350, 30);
    expect(d.hit(0, 'a', { x: 10, y: 10 })).toBe(false);
    expect(d.hit(200, 'a', { x: 15, y: 12 })).toBe(true);
    // Le tap suivant repart de zéro.
    expect(d.hit(300, 'a', { x: 15, y: 12 })).toBe(false);
  });

  it('refuse un tap trop lent, trop loin ou sur une autre cible', () => {
    const d = new DoubleTap(350, 30);
    d.hit(0, 'a', { x: 0, y: 0 });
    expect(d.hit(500, 'a', { x: 0, y: 0 })).toBe(false);
    expect(d.hit(600, 'a', { x: 80, y: 0 })).toBe(false);
    expect(d.hit(700, 'b', { x: 80, y: 0 })).toBe(false);
    expect(d.hit(800, 'b', { x: 80, y: 0 })).toBe(true);
  });

  it('fonctionne sans position (boutons)', () => {
    const d = new DoubleTap(380, Infinity);
    d.hit(0, 1);
    expect(d.hit(100, 2)).toBe(false);
    expect(d.hit(200, 2)).toBe(true);
  });
});

describe('sélection à l’écran', () => {
  it('teste si un point est dans la vue', () => {
    expect(onScreen({ x: 10, y: 10 }, 100, 50)).toBe(true);
    expect(onScreen({ x: -1, y: 10 }, 100, 50)).toBe(false);
    expect(onScreen({ x: 50, y: 51 }, 100, 50)).toBe(false);
    expect(onScreen({ x: -5, y: 10 }, 100, 50, 8)).toBe(true);
  });
});
