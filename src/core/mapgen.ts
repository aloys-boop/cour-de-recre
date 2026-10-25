import { Rng } from './rng';
import type { MapDef, Suit, TeamId, TileDef, Vec2 } from './types';

/** Un niveau : taille de la cour, nombre d'équipes et de cases bonus. La disposition est tirée au sort à chaque partie. */
export interface LevelDef {
  id: string;
  name: string;
  w: number;
  h: number;
  teams: number;
  tiles: number;
  obstacles: number;
  unitCap: number;
  spawnInterval: number;
  startUnits: number;
}

export const LEVELS: LevelDef[] = [
  { id: 'preau', name: 'Le préau', w: 12, h: 12, teams: 2, tiles: 14, obstacles: 2, unitCap: 20, spawnInterval: 6, startUnits: 6 },
  { id: 'cour', name: 'La grande cour', w: 14, h: 14, teams: 3, tiles: 16, obstacles: 3, unitCap: 24, spawnInterval: 5.5, startUnits: 6 },
  { id: 'gymnase', name: 'Le gymnase', w: 16, h: 16, teams: 4, tiles: 18, obstacles: 4, unitCap: 28, spawnInterval: 5, startUnits: 6 },
  { id: 'stade', name: 'Le stade', w: 18, h: 18, teams: 4, tiles: 20, obstacles: 5, unitCap: 30, spawnInterval: 5, startUnits: 7 },
  { id: 'campus', name: 'Le campus', w: 20, h: 20, teams: 4, tiles: 22, obstacles: 6, unitCap: 30, spawnInterval: 4.5, startUnits: 8 },
];

const SUITS: Suit[] = ['heart', 'spade', 'club', 'diamond'];

/**
 * Génère une carte jouable :
 *  - camps de 2 × 2 aux coins (ouest, est, nord, sud selon le nombre d'équipes) ;
 *  - cases bonus réparties au hasard, à distance des camps et les unes des autres,
 *    avec une disposition symétrique (rotation de 180°) pour 2 et 4 équipes ;
 *  - quelques obstacles, jamais collés aux cases ni aux camps ;
 *  - symboles équilibrés (autant de ♥, ♠, ♣, ♦ que possible).
 */
export function generateMap(level: LevelDef, seed: number): MapDef {
  const rng = new Rng(seed);
  const { w, h } = level;
  const tiles: TileDef[] = [];

  // Camps.
  const corners: Array<[number, number]> = [
    [0, h - 2], // ouest (équipe 0)
    [w - 2, 0], // est (équipe 1)
    [0, 0], // nord (équipe 2)
    [w - 2, h - 2], // sud (équipe 3)
  ];
  for (let t = 0; t < level.teams; t++) tiles.push({ kind: 'camp', x: corners[t][0], y: corners[t][1], owner: t as TeamId });

  const occupied = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (const c of tiles) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) occupied.add(key(c.x + dx, c.y + dy));

  const nearCamp = (x: number, y: number, margin: number): boolean =>
    corners.slice(0, level.teams).some(([cx, cy]) => Math.max(Math.abs(x - (cx + 0.5)), Math.abs(y - (cy + 0.5))) < 1 + margin);
  const symmetric = level.teams !== 3;
  const mirror = (x: number, y: number): Vec2 => ({ x: w - 1 - x, y: h - 1 - y });

  // Cases bonus.
  const placed: Vec2[] = [];
  const tooClose = (x: number, y: number, minDist: number): boolean =>
    placed.some((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < minDist);
  let attempts = 0;
  let minDist = 3;
  while (placed.length < level.tiles && attempts < 4000) {
    attempts++;
    if (attempts % 400 === 0 && minDist > 2) minDist--; // on desserre si la cour est trop pleine
    const x = rng.int(1, w - 2);
    const y = rng.int(1, h - 2);
    if (nearCamp(x, y, 2) || tooClose(x, y, minDist)) continue;
    const m = mirror(x, y);
    if (symmetric) {
      if (m.x === x && m.y === y) continue;
      if (nearCamp(m.x, m.y, 2) || tooClose(m.x, m.y, minDist) || Math.max(Math.abs(m.x - x), Math.abs(m.y - y)) < minDist) continue;
      placed.push({ x, y }, m);
    } else {
      placed.push({ x, y });
    }
  }
  if (placed.length > level.tiles) placed.length = level.tiles;
  // Symboles équilibrés : les quatre symboles sont distribués en boucle sur un ordre mélangé ;
  // sur une carte symétrique, chaque paire de cases miroir reçoit le même symbole (équité).
  const groups: number[][] = [];
  if (symmetric) for (let i = 0; i < placed.length; i += 2) groups.push(i + 1 < placed.length ? [i, i + 1] : [i]);
  else for (let i = 0; i < placed.length; i++) groups.push([i]);
  for (let i = groups.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [groups[i], groups[j]] = [groups[j], groups[i]];
  }
  const suitOf = new Map<number, Suit>();
  groups.forEach((g, k) => g.forEach((idx) => suitOf.set(idx, SUITS[k % 4])));
  placed.forEach((p, i) => {
    tiles.push({ kind: 'bonus', x: p.x, y: p.y, suit: suitOf.get(i)! });
    occupied.add(key(p.x, p.y));
  });

  // Obstacles : jamais sur ou contre une case, ni près d'un camp.
  const obstacles: Vec2[] = [];
  const touchesTile = (x: number, y: number): boolean => placed.some((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 1);
  attempts = 0;
  while (obstacles.length < level.obstacles && attempts < 2000) {
    attempts++;
    const x = rng.int(2, w - 3);
    const y = rng.int(2, h - 3);
    if (occupied.has(key(x, y)) || nearCamp(x, y, 3) || touchesTile(x, y)) continue;
    if (obstacles.some((o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) < 2)) continue;
    const m = mirror(x, y);
    if (symmetric) {
      if ((m.x === x && m.y === y) || occupied.has(key(m.x, m.y)) || nearCamp(m.x, m.y, 3) || touchesTile(m.x, m.y)) continue;
      if (Math.max(Math.abs(m.x - x), Math.abs(m.y - y)) < 2) continue;
      obstacles.push({ x, y }, m);
      occupied.add(key(x, y));
      occupied.add(key(m.x, m.y));
    } else {
      obstacles.push({ x, y });
      occupied.add(key(x, y));
    }
  }

  return {
    id: level.id,
    name: level.name,
    w,
    h,
    teams: level.teams,
    unitCap: level.unitCap,
    spawnInterval: level.spawnInterval,
    startUnits: level.startUnits,
    tiles,
    obstacles,
    seed,
  };
}

export function levelById(id: string): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}
