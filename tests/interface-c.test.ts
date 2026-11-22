/**
 * v5.23, saison 2, interface c : accueil vivant (élèves qui jouent au chat derrière le titre),
 * carte d'équipe qui se retourne, jauges qui se remplissent case après case.
 */
import { describe, expect, it } from 'vitest';
import { FLIP_MS, gaugeDelay, hopOffset, kidCount, MenuScene, runFrame, SCENE } from '../src/core/menu-scene';

function run(s: MenuScene, seconds: number, dt = 1 / 30): void {
  for (let t = 0; t < seconds; t += dt) s.step(dt);
}

describe('accueil vivant : la partie de chat', () => {
  it('un élève par équipe au plus, toutes couleurs différentes, un seul chat', () => {
    const s = new MenuScene(844, 3);
    expect(s.kids.length).toBe(kidCount(844));
    expect(s.kids.length).toBeLessThanOrEqual(8);
    expect(new Set(s.kids.map((k) => k.team)).size).toBe(s.kids.length);
    expect(s.kids.filter((k) => k.role === 'chat')).toHaveLength(1);
    expect(kidCount(320)).toBeGreaterThanOrEqual(3);
    expect(kidCount(2000)).toBe(8);
  });

  it('le chat compte avant de partir, puis finit par toucher quelqu’un : les rôles s’échangent', () => {
    const s = new MenuScene(844, 5);
    const first = s.chat;
    const x0 = first.x;
    run(s, SCENE.count * 0.9);
    expect(first.x).toBeCloseTo(x0, 5); // il compte, immobile
    run(s, 30);
    expect(s.tags).toBeGreaterThan(0);
    expect(s.kids.filter((k) => k.role === 'chat')).toHaveLength(1);
  });

  it('touché : « Touché ! », le nouveau chat compte, l’ancien ne peut pas être retouché tout de suite', () => {
    const s = new MenuScene(844, 9);
    const before = s.tags;
    let guard = 0;
    while (s.tags === before && guard++ < 3000) s.step(1 / 30);
    expect(s.tags).toBe(before + 1);
    const chat = s.chat;
    expect(chat.freeze).toBeGreaterThan(SCENE.count - 0.1);
    expect(s.pops[s.pops.length - 1]?.text).toBe('Touché !');
    const old = s.kids.find((k) => k.immune > 0)!;
    expect(old).toBeDefined();
    expect(old.role).toBe('libre');
  });

  it('les élèves libres détalent quand le chat approche', () => {
    const s = new MenuScene(844, 11);
    const chat = s.chat;
    chat.freeze = 0;
    const prey = s.kids.find((k) => k !== chat)!;
    chat.x = 400;
    prey.x = 460;
    prey.lane = chat.lane;
    prey.immune = 0;
    run(s, 0.4);
    expect(prey.vx).toBeGreaterThan(30); // il s'enfuit vers la droite
  });

  it('personne ne sort de la bande, même après des minutes ou un rétrécissement', () => {
    const s = new MenuScene(844, 2);
    run(s, 120);
    s.setWidth(400);
    run(s, 10);
    for (const k of s.kids) {
      expect(k.x).toBeGreaterThanOrEqual(SCENE.margin);
      expect(k.x).toBeLessThanOrEqual(400 - SCENE.margin);
      expect(k.lane).toBeGreaterThanOrEqual(0);
      expect(k.lane).toBeLessThanOrEqual(1);
    }
  });

  it('un onglet revenu de veille ne téléporte personne (pas plafonné)', () => {
    const s = new MenuScene(844, 4);
    run(s, 2);
    const xs = s.kids.map((k) => k.x);
    s.step(30);
    s.kids.forEach((k, i) => expect(Math.abs(k.x - xs[i])).toBeLessThanOrEqual(SCENE.chase * SCENE.maxStep + 1));
  });

  it('même graine, même partie de chat (déterministe)', () => {
    const a = new MenuScene(844, 21);
    const b = new MenuScene(844, 21);
    run(a, 8);
    run(b, 8);
    expect(a.kids.map((k) => k.x)).toEqual(b.kids.map((k) => k.x));
  });

  it('choisir une équipe : son élève saute de joie et crie « Moi ! »', () => {
    const s = new MenuScene(844, 6);
    const team = s.kids[2].team;
    expect(s.cheer(team)).toBe(true);
    const k = s.kids[2];
    expect(k.hop).toBe(SCENE.hopTime);
    expect(s.pops[s.pops.length - 1]?.text).toBe('Moi !');
    const x = k.x;
    run(s, SCENE.hopTime / 2);
    expect(k.x).toBeCloseTo(x, 0); // il saute sur place
    run(s, SCENE.hopTime);
    expect(k.hop).toBe(0);
    // Équipe absente de la cour (bande étroite) : rien ne casse.
    const small = new MenuScene(320, 6);
    const absent = [0, 1, 2, 3, 4, 5, 6, 7].find((t) => !small.kids.some((k) => k.team === t))!;
    expect(small.cheer(absent)).toBe(false);
  });

  it('les onomatopées s’éteignent et ne s’accumulent pas', () => {
    const s = new MenuScene(844, 6);
    for (const k of s.kids) s.cheer(k.team);
    expect(s.pops.length).toBeLessThanOrEqual(SCENE.popMax);
    run(s, SCENE.popLife + 0.1);
    expect(s.pops.filter((p) => p.text === 'Moi !')).toHaveLength(0);
  });

  it('saut : deux bonds, au sol au début et à la fin ; pas de course à l’arrêt', () => {
    expect(hopOffset(0)).toBe(0);
    expect(hopOffset(SCENE.hopTime)).toBeCloseTo(0, 5);
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => hopOffset((i / 50) * SCENE.hopTime)));
    expect(peak).toBeGreaterThan(SCENE.hopHeight * 0.6);
    expect(peak).toBeLessThanOrEqual(SCENE.hopHeight);
    const s = new MenuScene(844, 1);
    const k = s.kids[0];
    k.vx = 0;
    expect(runFrame(k)).toBe(-1);
    k.vx = 60;
    k.freeze = 0;
    expect(runFrame(k)).toBeGreaterThanOrEqual(0);
  });

  it('ordre de dessin : du fond vers le devant', () => {
    const s = new MenuScene(844, 8);
    const lanes = s.drawOrder().map((k) => k.lane);
    expect(lanes).toEqual([...lanes].sort((a, b) => a - b));
  });
});

describe('cartes qui se retournent et jauges', () => {
  it('retournement court (moins d’un tiers de seconde), jauges case après case puis ligne après ligne', () => {
    expect(FLIP_MS).toBeLessThan(330);
    expect(gaugeDelay(0, 0)).toBe(0);
    expect(gaugeDelay(1, 0)).toBeGreaterThan(gaugeDelay(0, 0));
    expect(gaugeDelay(0, 1)).toBeGreaterThan(gaugeDelay(0, 0));
    expect(gaugeDelay(4, 3)).toBeLessThan(500); // tout est plein en moins d'une demi-seconde
  });
});
