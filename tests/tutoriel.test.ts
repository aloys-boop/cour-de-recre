import { describe, expect, it } from 'vitest';
import { meritsOf } from '../src/core/merits';
import { LEVELS } from '../src/core/maps';
import { decodeMapCode } from '../src/core/mapcode';
import { TUTORIAL_MAP, TUTORIAL_STEPS, TutorialState } from '../src/core/tutorial';
import { World } from '../src/core/world';

function tick(world: World, seconds: number, t?: TutorialState) {
  const step = 1 / 60;
  for (let s = 0; s < seconds; s += step) {
    world.update(step);
    for (const ev of world.drainEvents()) t?.onWorldEvent(ev);
    t?.update();
  }
}

describe('tutoriel : logique', () => {
  it('petite carte à 2 équipes, hors de la liste des niveaux (codes de carte inchangés)', () => {
    expect(TUTORIAL_MAP.teams).toBe(2);
    expect(TUTORIAL_MAP.w).toBeLessThanOrEqual(12);
    expect(LEVELS.map((l) => l.id)).not.toContain('tutoriel');
    expect(decodeMapCode('222222')).toEqual({ spec: { kind: 'campagne', level: 0 }, seed: 0 });
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(['select', 'box', 'move', 'capture', 'attack', 'rally', 'camera', 'merits', 'upgrade', 'power', 'win']);
    for (const s of TUTORIAL_STEPS) expect(s.text.length).toBeLessThanOrEqual(90);
  });

  it('chaque étape n’avance que sur l’action attendue', () => {
    const w = new World(TUTORIAL_MAP, 2, 1);
    const t = new TutorialState(w, 0);
    expect(t.step.id).toBe('select');
    t.onAction({ kind: 'move' });
    expect(t.index).toBe(0);
    t.onAction({ kind: 'select', box: false });
    expect(t.step.id).toBe('box');
    // Un tap ne vaut pas une sélection rectangle.
    t.onAction({ kind: 'select', box: false });
    expect(t.step.id).toBe('box');
    t.onAction({ kind: 'select', box: true });
    expect(t.step.id).toBe('move');
    t.onAction({ kind: 'move' });
    expect(t.step.id).toBe('capture');
    expect(t.drainEvents()).toEqual([
      { kind: 'step', index: 1 },
      { kind: 'step', index: 2 },
      { kind: 'step', index: 3 },
    ]);
  });

  it('IA passive et production adverse arrêtée jusqu’à la dernière étape', () => {
    const w = new World(TUTORIAL_MAP, 2, 1);
    const t = new TutorialState(w, 0);
    expect(t.aiActive).toBe(false);
    tick(w, 30, t);
    expect(w.teamUnitCount(1)).toBe(TUTORIAL_MAP.startUnits);
    expect(w.teamUnitCount(0)).toBeGreaterThan(TUTORIAL_MAP.startUnits);
  });

  it('capture d’une case, ennemis qui approchent, bons points offerts pour essayer', () => {
    const w = new World(TUTORIAL_MAP, 2, 1);
    const t = new TutorialState(w, 0);
    for (const a of ['select', 'select', 'move'] as const) t.onAction({ kind: a, box: t.step.id === 'box' });
    expect(t.step.id).toBe('capture');
    const heart = w.tiles.find((x) => x.suit === 'heart' && x.x === 3)!;
    w.orderMove(
      w.units.filter((u) => u.team === 0),
      { x: heart.cx, y: heart.cy },
    );
    for (let i = 0; i < 60 * 8 && t.step.id === 'capture'; i++) tick(w, 1 / 60, t);
    expect(heart.owner).toBe(0);
    expect(t.step.id).toBe('attack');
    // Deux Verts approchent.
    expect(w.units.filter((u) => u.team === 1).length).toBe(TUTORIAL_MAP.startUnits + 2);
    for (const a of ['attack', 'rally', 'camera'] as const) t.onAction({ kind: a });
    expect(t.step.id).toBe('merits');
    // Une autre case prise : bons points, étape franchie.
    const club = w.tiles.find((x) => x.suit === 'club')!;
    w.orderMove(
      w.units.filter((u) => u.team === 0 && u.alive),
      { x: club.cx, y: club.cy },
    );
    tick(w, 12, t);
    expect(t.step.id).toBe('upgrade');
    expect(meritsOf(w, 0)).toBeGreaterThanOrEqual(30);
    t.onAction({ kind: 'upgrade' });
    expect(t.step.id).toBe('power');
    expect(meritsOf(w, 0)).toBeGreaterThanOrEqual(30);
    t.onAction({ kind: 'power' });
    expect(t.step.id).toBe('win');
    expect(t.aiActive).toBe(true);
    expect(w.productionScale[1]).toBeGreaterThan(0);
    t.onVictory();
    expect(t.done).toBe(true);
    const evs = t.drainEvents();
    expect(evs[evs.length - 1]).toEqual({ kind: 'done' });
  });

  it('« Passer » termine le tutoriel ; la main vise un point de la carte', () => {
    const w = new World(TUTORIAL_MAP, 2, 1);
    const t = new TutorialState(w, 0);
    const p = t.targetPoint();
    expect(p).not.toBeNull();
    const mine = w.units.filter((u) => u.team === 0);
    expect(mine.some((u) => u.x === p!.x && u.y === p!.y)).toBe(true);
    t.skip();
    expect(t.done).toBe(true);
    t.onAction({ kind: 'select' });
    expect(t.done).toBe(true);
  });
});
