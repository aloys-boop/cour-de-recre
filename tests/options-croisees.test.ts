// Interactions entre options d'escarmouche fusionnées séparément.
import { describe, expect, it } from 'vitest';
import { mapWithRules } from '../src/core/ghosts';
import { withThrone } from '../src/core/king';
import type { MapCode } from '../src/core/mapcode';

const cells = (t: { kind: string; x: number; y: number }) => {
  const n = t.kind === 'bonus' ? 1 : 2;
  const out: string[] = [];
  for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) out.push(`${t.x + dx},${t.y + dy}`);
  return out;
};

describe('options croisées', () => {
  it('Roi de la cour + camps fantômes : rien ne chevauche le trône', () => {
    for (let teams = 2; teams <= 8; teams++) {
      for (const size of [0, 1, 2, 3]) {
        for (const seed of [1, 77, 4242]) {
          const code: MapCode = { spec: { kind: 'escarmouche', teams, size, tiles: teams >= 5 ? 20 : 14 }, seed };
          const map = withThrone(mapWithRules(code, { mode: 'roi', ghostCamps: true }));
          const used = new Set<string>();
          for (const t of map.tiles)
            for (const c of cells(t)) {
              expect(used.has(c)).toBe(false);
              used.add(c);
            }
          for (const o of map.obstacles ?? []) expect(used.has(`${o.x},${o.y}`)).toBe(false);
          expect(map.tiles.filter((t) => t.kind === 'throne').length).toBe(1);
        }
      }
    }
  });
});
