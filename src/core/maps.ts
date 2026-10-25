import type { MapDef, Suit, TeamId, TileDef, Vec2 } from './types';

const SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club'];

function tiles(points: Array<[number, number, TeamId?]>): TileDef[] {
  return points.map(([x, y, owner], i) => ({ x, y, suit: SUITS[i % 4], owner }));
}

function obstacles(points: Array<[number, number]>): Vec2[] {
  return points.map(([x, y]) => ({ x, y }));
}

/**
 * Les cases de départ sont placées aux quatre points cardinaux de la cour
 * (en vue iso : ouest = x faible / y fort, est = x fort / y faible).
 * Équipe 0 : ouest, 1 : est, 2 : nord, 3 : sud.
 */
export const MAPS: MapDef[] = [
  {
    id: 'preau',
    name: 'Le préau',
    w: 9,
    h: 9,
    teams: 2,
    unitCap: 18,
    spawnInterval: 7,
    startUnits: 6,
    tiles: tiles([
      [1, 7, 0],
      [7, 1, 1],
      [4, 4],
      [2, 2],
      [6, 6],
    ]),
  },
  {
    id: 'cour',
    name: 'La grande cour',
    w: 11,
    h: 11,
    teams: 3,
    unitCap: 22,
    spawnInterval: 6.5,
    startUnits: 6,
    tiles: tiles([
      [1, 9, 0],
      [9, 1, 1],
      [1, 1, 2],
      [5, 5],
      [9, 9],
      [3, 5],
      [7, 5],
      [5, 2],
      [5, 8],
    ]),
    obstacles: obstacles([
      [3, 7],
      [7, 3],
    ]),
  },
  {
    id: 'gymnase',
    name: 'Le gymnase',
    w: 13,
    h: 13,
    teams: 4,
    unitCap: 26,
    spawnInterval: 6,
    startUnits: 6,
    tiles: tiles([
      [1, 11, 0],
      [11, 1, 1],
      [1, 1, 2],
      [11, 11, 3],
      [6, 6],
      [3, 6],
      [9, 6],
      [6, 3],
      [6, 9],
      [3, 3],
      [9, 9],
      [9, 3],
      [3, 9],
    ]),
    obstacles: obstacles([
      [5, 5],
      [7, 7],
      [5, 7],
      [7, 5],
    ]),
  },
  {
    id: 'stade',
    name: 'Le stade',
    w: 15,
    h: 15,
    teams: 4,
    unitCap: 30,
    spawnInterval: 5.5,
    startUnits: 7,
    tiles: tiles([
      [1, 13, 0],
      [13, 1, 1],
      [1, 1, 2],
      [13, 13, 3],
      [7, 7],
      [4, 7],
      [10, 7],
      [7, 4],
      [7, 10],
      [3, 3],
      [11, 11],
      [11, 3],
      [3, 11],
      [1, 7],
      [13, 7],
      [7, 1],
      [7, 13],
    ]),
    obstacles: obstacles([
      [5, 5],
      [6, 5],
      [9, 9],
      [8, 9],
      [5, 9],
      [5, 8],
      [9, 5],
      [9, 6],
    ]),
  },
  {
    id: 'campus',
    name: 'Le campus',
    w: 18,
    h: 18,
    teams: 4,
    unitCap: 30,
    spawnInterval: 5,
    startUnits: 8,
    tiles: tiles([
      [1, 16, 0],
      [16, 1, 1],
      [1, 1, 2],
      [16, 16, 3],
      [8, 8],
      [9, 9],
      [4, 8],
      [13, 9],
      [8, 4],
      [9, 13],
      [3, 3],
      [14, 14],
      [14, 3],
      [3, 14],
      [1, 8],
      [16, 9],
      [8, 1],
      [9, 16],
      [5, 12],
      [12, 5],
      [5, 5],
      [12, 12],
    ]),
    obstacles: obstacles([
      [6, 6],
      [7, 6],
      [6, 7],
      [11, 11],
      [10, 11],
      [11, 10],
      [6, 11],
      [6, 10],
      [11, 6],
      [10, 6],
      [8, 10],
      [9, 7],
    ]),
  },
];

export function mapById(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
