import { describe, expect, it } from 'vitest';
import { assignSlots, magnetTile, orderMoveExact, neighbourRadius, pickUnit, PICK_RADIUS_PX, spreadInTile, startFocus, startZoom, tileGoals, UNIT_PX_HEIGHT, type PickCandidate } from '../src/core/aim';
import { generateMap, LEVELS } from '../src/core/maps';
import { World } from '../src/core/world';
import { Camera } from '../src/render/camera';

const cand = (id: number, team: number, sx: number, sy: number, depth = 0): PickCandidate<number> => ({ unit: id, team, sx, sy, depth });

describe('priorité de sélection au doigt', () => {
  it('attrape l\'élève le plus proche dans un rayon d\'au moins 34 px, même dézoomé', () => {
    // Zoom 0,5 : la silhouette est minuscule, le rayon reste de 34 px.
    const z = 0.5;
    const c = [cand(1, 0, 100, 100 + 26 * z + 30), cand(2, 0, 300, 300)];
    expect(pickUnit(c, 100, 100, z, 0, false)?.unit).toBe(1);
    expect(pickUnit(c, 100, 100 - PICK_RADIUS_PX, z, 0, false)).toBeNull();
  });

  it('sans sélection, préfère ses élèves aux ennemis, même un peu plus loin', () => {
    const c = [cand(1, 1, 100, 126), cand(2, 0, 120, 126)];
    expect(pickUnit(c, 100, 100, 1, 0, false)?.unit).toBe(2);
  });

  it('avec une sélection, un ennemi vraiment sous le doigt passe avant ses élèves voisins', () => {
    const c = [cand(1, 1, 100, 126), cand(2, 0, 125, 126)];
    const r = pickUnit(c, 100, 100, 1, 0, true);
    expect(r?.unit).toBe(1);
    expect(r?.direct).toBe(true);
  });

  it('avec une sélection, un ennemi seulement proche ne vole pas le tap à ses élèves', () => {
    const c = [cand(1, 1, 100, 160), cand(2, 0, 100, 126)];
    expect(pickUnit(c, 100, 100, 1, 0, true)?.unit).toBe(2);
  });

  it('faute d\'élève du joueur, l\'ennemi à portée est visé ; à égalité, le plus devant', () => {
    expect(pickUnit([cand(1, 1, 100, 140)], 100, 100, 1, 0, true)?.unit).toBe(1);
    const c = [cand(1, 0, 100, 126, 3), cand(2, 0, 100, 126, 5)];
    expect(pickUnit(c, 100, 100, 1, 0, false)?.unit).toBe(2);
  });

  it('distingue un tap sur la silhouette d\'un tap à côté', () => {
    const c = [cand(1, 0, 100, 126)];
    expect(pickUnit(c, 100, 100, 1, 0, false)?.direct).toBe(true);
    expect(pickUnit(c, 128, 100, 1, 0, false)?.direct).toBe(false);
  });

  it('le voisinage d\'un groupe s\'élargit en cellules quand on dézoome', () => {
    expect(neighbourRadius(2)).toBeCloseTo(0.9);
    expect(neighbourRadius(0.5)).toBeGreaterThan(neighbourRadius(1));
    expect(neighbourRadius(0.5)).toBeGreaterThan(1.5);
  });
});

describe('aimantation des ordres sur les cases', () => {
  const bonus = { cx: 5.5, cy: 5.5, size: 1, half: 0.62, id: 'b' };
  const camp = { cx: 2, cy: 2, size: 2, half: 1.05, id: 'c' };

  it('vise une case quand le doigt est dans son losange agrandi de 35 %', () => {
    expect(magnetTile([bonus, camp], { x: 5.5, y: 5.5 })?.id).toBe('b');
    expect(magnetTile([bonus, camp], { x: 5.5 + 0.66, y: 5.3 })?.id).toBe('b');
    expect(magnetTile([bonus, camp], { x: 5.5 + 0.7, y: 5.5 })).toBeNull();
    expect(magnetTile([bonus, camp], { x: 3.3, y: 0.8 })?.id).toBe('c');
    expect(magnetTile([bonus, camp], { x: 8, y: 8 })).toBeNull();
  });

  it('entre deux cases, choisit la plus proche relativement à sa taille', () => {
    const near = { cx: 6.5, cy: 5.5, size: 1, half: 0.62, id: 'n' };
    expect(magnetTile([bonus, near], { x: 5.9, y: 5.5 })?.id).toBe('b');
    expect(magnetTile([bonus, near], { x: 6.1, y: 5.5 })?.id).toBe('n');
  });

  it('un seul élève va au centre de la case', () => {
    expect(spreadInTile(1, 5.5, 5.5, 0.62)).toEqual([{ x: 5.5, y: 5.5 }]);
  });

  it('un groupe se répartit à l\'intérieur de la zone de capture, sans doublon', () => {
    for (const n of [2, 5, 12, 30]) {
      for (const t of [bonus, camp]) {
        const pts = spreadInTile(n, t.cx, t.cy, t.half);
        expect(pts).toHaveLength(n);
        for (const p of pts) {
          expect(Math.abs(p.x - t.cx)).toBeLessThan(t.half);
          expect(Math.abs(p.y - t.cy)).toBeLessThan(t.half);
        }
        const keys = new Set(pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`));
        expect(keys.size).toBe(n);
      }
    }
  });

  it('un point non praticable est ramené au centre', () => {
    const pts = spreadInTile(6, 5.5, 5.5, 0.62, 0.1, (x) => x <= 5.5);
    for (const p of pts) expect(p.x).toBeLessThanOrEqual(5.5);
  });

  it('chaque élève reçoit une place distincte, la plus proche possible', () => {
    const from = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const slots = [{ x: 9, y: 0 }, { x: 1, y: 0 }];
    expect(assignSlots(from, slots)).toEqual([{ x: 1, y: 0 }, { x: 9, y: 0 }]);
    const goals = tileGoals([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 9, y: 9 }], camp);
    expect(new Set(goals).size).toBe(3);
    for (const g of goals) expect(Math.max(Math.abs(g.x - camp.cx), Math.abs(g.y - camp.cy))).toBeLessThan(camp.half);
  });
});

describe('répartition dans une vraie partie', () => {
  it('des élèves envoyés un par un sur leurs places finissent tous sur la case', () => {
    const w = new World(generateMap(LEVELS[0], 7), 2, 7);
    const tile = w.tiles.find((t) => !t.isCamp)!;
    const units = w.units.filter((u) => u.team === 0);
    const goals = tileGoals(units.map((u) => u.pos), tile, (x, y) => w.grid.walkable(x, y));
    orderMoveExact(w, units, goals);
    for (let i = 0; i < 60 * 15; i++) w.update(1 / 60);
    for (const u of units) expect(tile.contains(u.x, u.y)).toBe(true);
  });
});

describe('zoom de départ sur iPhone en paysage', () => {
  it('les élèves font au moins 44 px, la base et le centre de la cour restent visibles', () => {
    const sizes = [...LEVELS.map((l) => l.w), 26];
    for (const s of sizes) {
      const level = { ...LEVELS[4], w: s, h: s };
      const map = generateMap(level, 3);
      const cam = new Camera();
      cam.setMap(map.w, map.h);
      cam.setView(844, 390);
      cam.fit();
      cam.zoom = startZoom(Math.min(cam.maxZoom, cam.zoom * 1.35), cam.maxZoom);
      expect(cam.zoom * UNIT_PX_HEIGHT).toBeGreaterThanOrEqual(44);
      const home = map.tiles.find((t) => t.kind === 'camp' && t.owner === 0)!;
      const hx = home.x + 1;
      const hy = home.y + 1;
      const cx = map.w / 2;
      const cy = map.h / 2;
      const f = startFocus({ x: hx, y: hy }, { x: cx, y: cy }, cam.zoom, 844, 390);
      cam.centerOnGrid(f.x, f.y);
      const ph = cam.gridToScreen(hx, hy);
      expect(ph.x).toBeGreaterThan(40);
      expect(ph.x).toBeLessThan(804);
      expect(ph.y).toBeGreaterThan(40);
      expect(ph.y).toBeLessThan(350);
      // Un bout de la cour vers le centre : aux deux tiers du chemin depuis la base, au moins.
      const pm = cam.gridToScreen(hx + (cx - hx) * 0.66, hy + (cy - hy) * 0.66);
      expect(pm.x).toBeGreaterThan(0);
      expect(pm.x).toBeLessThan(844);
    }
  });
});
