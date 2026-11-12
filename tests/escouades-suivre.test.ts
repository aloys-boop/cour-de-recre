import { describe, expect, it } from 'vitest';
import { assignConquest, assignEscort, escortWard, SQUAD, squadMembers, squadMode } from '../src/core/squads';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';

// Cour simple : deux camps aux coins, deux cases bonus.
const MAP: MapDef = {
  id: 's',
  name: 'S',
  w: 26,
  h: 26,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 24, y: 24, owner: 1 },
    { kind: 'bonus', x: 5, y: 4, suit: 'heart' },
    { kind: 'bonus', x: 16, y: 6, suit: 'spade' },
  ],
};

const tick = (w: World, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60);
};

function setup() {
  const w = new World(MAP, 2, 11);
  w.productionScale[0] = 0;
  w.productionScale[1] = 0;
  const escort = Array.from({ length: 4 }, (_, i) => w.spawnUnit(0, 4 + (i % 2) * 0.5, 10 + Math.floor(i / 2) * 0.5, false));
  const ward = Array.from({ length: 3 }, (_, i) => w.spawnUnit(0, 10 + i * 0.5, 12, false));
  return { w, escort, ward };
}

const centre = (us: readonly { x: number; y: number }[]) => ({
  x: us.reduce((s, u) => s + u.x, 0) / us.length,
  y: us.reduce((s, u) => s + u.y, 0) / us.length,
});
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('« Suivre » : l’escorte', () => {
  it('forme une escouade « follow » qui rejoint le protégé', () => {
    const { w, escort, ward } = setup();
    const sq = assignEscort(w, escort, ward.map((u) => u.id));
    expect(sq).not.toBeNull();
    expect(sq!.mode).toBe('follow');
    expect(squadMode(w, escort[0])).toBe('follow');
    expect(gap(centre(escort), centre(ward))).toBeGreaterThan(5);
    tick(w, 4);
    expect(gap(centre(escort), centre(ward))).toBeLessThan(SQUAD.followDist + 1.5);
  });

  it('suit le protégé quand il se déplace', () => {
    const { w, escort, ward } = setup();
    assignEscort(w, escort, ward.map((u) => u.id));
    tick(w, 3);
    w.orderMove(ward, { x: 12, y: 20 });
    tick(w, 8);
    expect(gap(centre(ward), { x: 12, y: 20 })).toBeLessThan(1.5);
    expect(gap(centre(escort), centre(ward))).toBeLessThan(SQUAD.followDist + 1.5);
    // L'ordre donné au protégé ne touche pas l'escorte.
    expect(squadMode(w, escort[0])).toBe('follow');
  });

  it('ne se protège pas elle-même et refuse un protégé vide', () => {
    const { w, escort } = setup();
    expect(assignEscort(w, escort, escort.map((u) => u.id))).toBeNull();
    expect(assignEscort(w, escort, [])).toBeNull();
    expect(escort.every((u) => u.squad === 0)).toBe(true);
  });

  it('jamais un élève d’une autre équipe comme protégé', () => {
    const { w, escort } = setup();
    const foe = w.spawnUnit(1, 12, 12, false);
    expect(assignEscort(w, escort, [foe.id])).toBeNull();
  });

  it('se jette sur un ennemi qui approche le protégé', () => {
    const { w, escort, ward } = setup();
    assignEscort(w, escort, ward.map((u) => u.id));
    tick(w, 4);
    const foe = w.spawnUnit(1, ward[0].x + 1.5, ward[0].y + 1, false);
    foe.frozenUntil = 999;
    tick(w, 1);
    expect(escort.some((u) => u.engagedId === foe.id)).toBe(true);
    tick(w, 8);
    expect(foe.alive).toBe(false);
    expect(squadMembers(w, escort[0].squad).length).toBe(4);
  });

  it('ne poursuit pas un ennemi loin du protégé (laisse)', () => {
    const { w, escort, ward } = setup();
    assignEscort(w, escort, ward.map((u) => u.id));
    tick(w, 4);
    const foe = w.spawnUnit(1, ward[0].x + 1.5, ward[0].y, false);
    tick(w, 0.6);
    // L'intrus fuit loin : l'escorte le lâche et revient.
    w.orderMove([foe], { x: 24, y: 2 });
    foe.frozenUntil = 0;
    tick(w, 6);
    for (const u of escort) expect(gap(u, centre(ward))).toBeLessThan(SQUAD.escortLeash + 2);
  });

  it('protège aussi les nouveaux membres d’une escouade suivie', () => {
    const { w, escort, ward } = setup();
    const conq = assignConquest(w, ward)!;
    const sq = assignEscort(w, escort, [ward[0].id], conq.id)!;
    expect(sq.wardSquad).toBe(conq.id);
    expect(escortWard(w, sq).length).toBe(3);
    const fresh = w.spawnUnit(0, 3, 3, false);
    fresh.squad = conq.id;
    expect(escortWard(w, sq).map((u) => u.id)).toContain(fresh.id);
  });

  it('se disperse quand il n’y a plus personne à escorter', () => {
    const { w, escort, ward } = setup();
    const sq = assignEscort(w, escort, ward.map((u) => u.id))!;
    for (const u of ward) {
      u.state = 'ko';
    }
    tick(w, 1);
    expect(w.squads.has(sq.id)).toBe(false);
    expect(escort.every((u) => u.squad === 0)).toBe(true);
    expect(w.escortsEnded.length).toBe(1);
    expect(w.escortsEnded[0].team).toBe(0);
  });

  it('un autre ordre libère l’élève de l’escorte', () => {
    const { w, escort, ward } = setup();
    assignEscort(w, escort, ward.map((u) => u.id));
    w.orderMove([escort[0]], { x: 2, y: 20 });
    expect(escort[0].squad).toBe(0);
    tick(w, 2);
    expect(escort[0].squad).toBe(0);
  });
});
