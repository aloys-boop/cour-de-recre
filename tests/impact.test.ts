// @vitest-environment jsdom
/**
 * v5.17, coups qui « claquent » : pose de l'élève touché (éclair, recul, écrasement), étoiles
 * des KO, chaleur des bagarres qui dose le tremblement, réglage « Tremblement » mémorisé.
 */
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/config';
import { BrawlHeat, IMPACT, impactPose, koStars, noteImpact } from '../src/core/impact';
import { loadProgress, saveProgress } from '../src/core/save';
import { resetUnitIds } from '../src/core/unit';
import { World } from '../src/core/world';
import type { MapDef } from '../src/core/types';
import { Effects } from '../src/render/effects';
import type { Camera } from '../src/render/camera';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 8,
  h: 8,
  teams: 2,
  unitCap: 10,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 6, y: 6, owner: 1 },
  ],
};

/** Caméra minimale : tout est à l'écran. */
const CAM = { gridToScreen: (x: number, y: number) => ({ x: 100 + x, y: 100 + y }), viewW: 800, viewH: 400, zoom: 1 } as unknown as Camera;

describe('pose d’impact', () => {
  it('au repos sans coup reçu ou une fois l’impact passé', () => {
    expect(impactPose(5, -1, 1, 0)).toEqual({ flash: 0, ox: 0, oy: 0, sx: 1, sy: 1 });
    expect(impactPose(5, 5 - IMPACT.recoil, 1, 0)).toEqual({ flash: 0, ox: 0, oy: 0, sx: 1, sy: 1 });
  });

  it('éclair blanc franc au contact, qui s’éteint avant la fin du recul', () => {
    expect(impactPose(10, 10, 1, 0).flash).toBe(1);
    const mid = impactPose(10 + IMPACT.flash / 2, 10, 1, 0).flash;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(impactPose(10 + IMPACT.flash + 0.01, 10, 1, 0).flash).toBe(0);
  });

  it('recule dans le sens du coup, vu en isométrie, et s’écrase un instant', () => {
    const t = IMPACT.recoil * 0.25; // sommet du recul
    // Coup venu de la gauche de la grille (direction +x) : à l'écran, vers la droite et le bas.
    const px = impactPose(t, 0, 1, 0);
    expect(px.ox).toBeGreaterThan(0);
    expect(px.oy).toBeGreaterThan(0);
    // Direction +y : vers la gauche et le bas.
    const py = impactPose(t, 0, 0, 1);
    expect(py.ox).toBeLessThan(0);
    expect(py.oy).toBeGreaterThan(0);
    expect(px.sx).toBeGreaterThan(1);
    expect(px.sy).toBeLessThan(1);
    // Un KO recule plus fort qu'un coup simple.
    expect(Math.hypot(impactPose(t, 0, 1, 0, true).ox, impactPose(t, 0, 1, 0, true).oy)).toBeGreaterThan(Math.hypot(px.ox, px.oy) * 2);
  });

  it('le monde note l’instant et la direction du dernier coup, sans toucher au combat', () => {
    resetUnitIds();
    const world = new World(ARENA, 2, 42);
    const a = world.spawnUnit(0, 3, 3);
    const b = world.spawnUnit(1, 3.4, 3);
    expect(b.hitAt).toBe(-1);
    for (let t = 0; t < 3 && b.hitAt < 0 && a.hitAt < 0; t += 1 / 60) world.update(1 / 60);
    const hit = b.hitAt >= 0 ? b : a;
    expect(hit.hitAt).toBeGreaterThan(0);
    expect(hit.hitAt).toBeLessThanOrEqual(world.time);
    expect(Math.hypot(hit.hitDx, hit.hitDy)).toBeCloseTo(1, 5);
    // b est à droite de a : un coup de a pousse b vers +x.
    if (hit === b) expect(b.hitDx).toBeGreaterThan(0.5);
    else expect(a.hitDx).toBeLessThan(-0.5);
  });

  it('noteImpact normalise la direction, même au contact parfait', () => {
    const u = { x: 2, y: 2, hitAt: -1, hitDx: 0, hitDy: 0 };
    noteImpact(u, 4, 2, 2);
    expect(u.hitAt).toBe(4);
    expect(Number.isFinite(u.hitDx) && Number.isFinite(u.hitDy)).toBe(true);
    noteImpact(u, 5, 0, 2);
    expect(u.hitDx).toBeCloseTo(1);
    expect(u.hitDy).toBeCloseTo(0);
  });
});

describe('étoiles des KO', () => {
  const ko = TUNING.koSeconds;
  it('trois étoiles qui tournent, ni avant la chute ni après la disparition', () => {
    expect(koStars(0, ko)).toEqual([]);
    expect(koStars(ko, ko)).toEqual([]);
    const a = koStars(0.5, ko);
    expect(a).toHaveLength(IMPACT.stars);
    expect(a.every((s) => s.alpha > 0 && s.alpha <= 1)).toBe(true);
    const b = koStars(0.6, ko);
    expect(b[0].dx).not.toBeCloseTo(a[0].dx, 3);
    // Fondu avant la fin.
    const late = koStars(ko - 0.12, ko);
    expect(late.length === 0 || late[0].alpha < a[0].alpha).toBe(true);
  });

  it('deux KO simultanés ne tournent pas en phase (graine par élève)', () => {
    expect(koStars(0.5, ko, 1)[0].dx).not.toBeCloseTo(koStars(0.5, ko, 2)[0].dx, 3);
  });
});

describe('chaleur des bagarres', () => {
  it('un KO isolé tremble à peine, une mêlée secoue plus fort et plus longtemps', () => {
    const h = new BrawlHeat();
    const first = h.ko()!;
    expect(first.amp).toBeLessThan(2.5);
    expect(first.dur).toBe(IMPACT.shakeDur);
    for (let i = 0; i < 10; i++) h.hit();
    h.ko();
    const third = h.ko()!;
    expect(third.amp).toBeGreaterThan(first.amp * 1.8);
    expect(h.big).toBe(true);
    expect(third.dur).toBe(IMPACT.shakeBigDur);
    expect(third.amp).toBeLessThanOrEqual(IMPACT.shakeMax);
  });

  it('retombe seule en quelques secondes', () => {
    const h = new BrawlHeat();
    for (let i = 0; i < 5; i++) h.ko();
    expect(h.heat).toBe(1);
    for (let t = 0; t < 2.5; t += 0.1) h.update(0.1);
    expect(h.heat).toBe(0);
  });

  it('tremblement coupé : aucun tremblement, mais la chaleur compte toujours', () => {
    const h = new BrawlHeat();
    h.shakeEnabled = false;
    expect(h.ko()).toBeNull();
    expect(h.shake(4, 0.2)).toBeNull();
    expect(h.heat).toBeGreaterThan(0);
  });
});

describe('effets à l’écran', () => {
  const koAt = (fx: Effects, n: number) => {
    for (let i = 0; i < n; i++) fx.onEvent({ kind: 'ko', x: 1, y: 1, team: 1 }, CAM);
  };

  it('le tremblement décale la vue, et plus du tout une fois coupé', () => {
    const on = new Effects(() => 0.99);
    koAt(on, 1);
    on.update(0.01);
    expect(on.shaking).toBe(true);
    const off = new Effects(() => 0.99);
    off.heat.shakeEnabled = false;
    koAt(off, 5);
    off.onEvent({ kind: 'captured', x: 1, y: 1, team: 0, camp: true } as never, CAM);
    off.update(0.01);
    expect(off.shaking).toBe(false);
    expect(off.sx).toBe(0);
    expect(off.sy).toBe(0);
  });

  it('une grosse mêlée affiche « Mêlée ! » une seule fois et prévient le jeu', () => {
    const fx = new Effects(() => 0.5);
    koAt(fx, 1);
    expect(fx.meleeStarted).toBe(false);
    koAt(fx, 3);
    expect(fx.meleeStarted).toBe(true);
    fx.meleeStarted = false;
    koAt(fx, 3);
    expect(fx.meleeStarted).toBe(false);
  });
});

describe('réglage « Tremblement »', () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };

  it('une ancienne sauvegarde (sans le champ) garde le tremblement activé', () => {
    const s = store();
    s.setItem('cour-de-recre.v2', JSON.stringify({ unlocked: 3, wins: { a: 1 }, muted: false, lastTeam: 7, lastDifficulty: 'normal', difficultyScale: 2 }));
    const p = loadProgress(s);
    expect(p.shake).toBe(true);
    expect(p.unlocked).toBe(3);
    expect(p.lastTeam).toBe(7);
  });

  it('coupé, il le reste après rechargement', () => {
    const s = store();
    saveProgress({ ...loadProgress(s), shake: false }, s);
    expect(loadProgress(s).shake).toBe(false);
  });
});

describe('« Comment jouer »', () => {
  it('la rubrique « Bagarres » explique les effets et le réglage, dans le chapitre des bases', async () => {
    const { HOW_TO, HOW_TO_CHAPTERS } = await import('../src/ui/overlay');
    const r = HOW_TO.find(([t]) => t === 'Bagarres');
    expect(r?.[1]).toContain('Sensations');
    expect(r?.[1]).toContain('Mêlée');
    expect(HOW_TO_CHAPTERS[0].sections).toContain('Bagarres');
  });
});
