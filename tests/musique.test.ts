/**
 * v5.18 : musique synthétisée, partitions et humeur (sans navigateur).
 */
import { describe, expect, it } from 'vitest';
import { brightness, isFinale, layerLevel, LAYERS, MOOD, MusicMood, stepSeconds, THEMES, themeEvents, themeSeconds, themeVolume, type Layer, type ThemeId } from '../src/core/music-score';

const ALL: ThemeId[] = ['menu', 'partie', 'victoire', 'defaite'];
const layersAt = (theme: ThemeId, intensity: number): Set<Layer> => {
  const out = new Set<Layer>();
  for (let s = 0; s < THEMES[theme].length; s++) for (const e of themeEvents(theme, s, intensity)) out.add(e.layer);
  return out;
};

describe('partitions', () => {
  it('chaque thème a des notes jouables, dans une tessiture raisonnable', () => {
    for (const theme of ALL) {
      let notes = 0;
      for (let s = 0; s < THEMES[theme].length; s++) {
        for (const e of themeEvents(theme, s, 1)) {
          notes++;
          expect(e.dur).toBeGreaterThan(0);
          expect(e.gain).toBeGreaterThan(0);
          expect(e.gain).toBeLessThanOrEqual(1);
          if (e.voice === 'ton') {
            expect(e.midi).toBeGreaterThanOrEqual(36);
            expect(e.midi).toBeLessThanOrEqual(96);
          }
        }
      }
      expect(notes).toBeGreaterThanOrEqual(8);
    }
  });

  it('menu et partie bouclent ; victoire et défaite sont des jingles courts qui s’arrêtent', () => {
    expect(THEMES.menu.loop && THEMES.partie.loop).toBe(true);
    expect(themeEvents('partie', 64, 0)).toEqual(themeEvents('partie', 0, 0));
    for (const j of ['victoire', 'defaite'] as const) {
      expect(THEMES[j].loop).toBe(false);
      expect(themeSeconds(j)).toBeGreaterThan(1.5);
      expect(themeSeconds(j)).toBeLessThan(5);
      expect(themeEvents(j, THEMES[j].length, 0)).toEqual([]);
      // Aucune note ne dépasse la fin du jingle.
      for (let s = 0; s < THEMES[j].length; s++) for (const e of themeEvents(j, s)) expect(s + e.dur).toBeLessThanOrEqual(THEMES[j].length);
    }
  });

  it('les boucles durent quelques secondes et le pas suit le tempo', () => {
    expect(stepSeconds('partie')).toBeCloseTo(60 / 132 / 4, 6);
    expect(themeSeconds('partie')).toBeGreaterThan(6);
    expect(themeSeconds('menu')).toBeGreaterThan(6);
  });

  it('la mélodie de la bagarre suit l’accord de chaque mesure sur les temps forts', () => {
    const chords = [[9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]]; // la m, fa, do, sol (classes de hauteur)
    for (let bar = 0; bar < 4; bar++) {
      const lead = themeEvents('partie', bar * 16, 1).find((e) => e.layer === 'melodie');
      expect(lead).toBeDefined();
      expect(chords[bar]).toContain(lead!.midi! % 12);
    }
  });

  it('les partitions sont déterministes', () => {
    for (const theme of ALL) for (let s = 0; s < 40; s++) expect(themeEvents(theme, s, 0.6)).toEqual(themeEvents(theme, s, 0.6));
  });
});

describe('couches de la bagarre', () => {
  it('au calme : basse, accords et mélodie feutrée, sans batterie ni arpèges', () => {
    const calm = layersAt('partie', 0);
    expect([...calm].sort()).toEqual(['accords', 'basse', 'melodie']);
    expect(layerLevel('partie', 'melodie', 0)).toBeCloseTo(LAYERS.melodie.floor, 6);
  });

  it('les couches entrent dans l’ordre : charleston, batterie, puis arpèges de mêlée', () => {
    expect(layersAt('partie', 0.3).has('charleston')).toBe(true);
    expect(layersAt('partie', 0.3).has('batterie')).toBe(false);
    expect(layersAt('partie', 0.6).has('batterie')).toBe(true);
    expect(layersAt('partie', 0.6).has('arpege')).toBe(false);
    expect(layersAt('partie', 1).has('arpege')).toBe(true);
    // Plus dense en mêlée qu'au calme.
    const count = (x: number) => Array.from({ length: 64 }, (_, s) => themeEvents('partie', s, x).length).reduce((a, b) => a + b, 0);
    expect(count(1)).toBeGreaterThan(count(0) * 2);
  });

  it('le niveau d’une couche monte sans à-coup avec l’intensité', () => {
    for (const layer of Object.keys(LAYERS) as Layer[]) {
      let prev = layerLevel('partie', layer, 0);
      for (let i = 1; i <= 100; i++) {
        const v = layerLevel('partie', layer, i / 100);
        expect(v).toBeGreaterThanOrEqual(prev);
        expect(v - prev).toBeLessThan(0.12);
        prev = v;
      }
      expect(layerLevel('partie', layer, 1)).toBe(1);
    }
  });

  it('le filtre s’ouvre et le volume monte avec l’intensité ; les autres thèmes ne bougent pas', () => {
    expect(brightness('partie', 1)).toBeGreaterThan(brightness('partie', 0) * 2.5);
    expect(themeVolume('partie', 1)).toBeGreaterThan(themeVolume('partie', 0));
    expect(themeVolume('partie', 1)).toBeLessThan(0.25);
    for (const t of ['menu', 'victoire', 'defaite'] as const) {
      expect(brightness(t, 0)).toBe(brightness(t, 1));
      expect(themeEvents(t, 0, 0)).toEqual(themeEvents(t, 0, 1));
    }
  });
});

describe('humeur de la partie', () => {
  const quiet = { heat: 0, finale: false, calm: false };
  it('monte vite avec la chaleur des bagarres, retombe lentement', () => {
    const m = new MusicMood();
    for (let i = 0; i < 60; i++) m.update(1 / 60, { ...quiet, heat: 0.7 });
    expect(m.level).toBe(1);
    let t = 0;
    while (m.level > 0.05 && t < 30) (m.update(1 / 60, quiet), (t += 1 / 60));
    expect(t).toBeGreaterThan(6);
    expect(t).toBeLessThan(10);
  });

  it('une alerte maintient la tension quelques secondes, puis elle retombe', () => {
    const m = new MusicMood();
    m.danger();
    for (let i = 0; i < 60; i++) m.update(1 / 60, quiet);
    expect(m.level).toBeCloseTo(MOOD.danger, 5);
    for (let i = 0; i < 60 * (MOOD.dangerHold - 1); i++) m.update(1 / 60, quiet);
    expect(m.level).toBeCloseTo(MOOD.danger, 5);
    for (let i = 0; i < 60 * 3; i++) m.update(1 / 60, quiet);
    expect(m.level).toBeLessThan(MOOD.danger);
  });

  it('finale : plancher de tension ; pause : retour au calme', () => {
    const m = new MusicMood();
    for (let i = 0; i < 120; i++) m.update(1 / 60, { ...quiet, finale: true });
    expect(m.level).toBeCloseTo(MOOD.finale, 5);
    expect(m.target({ heat: 1, finale: true, calm: true })).toBe(0);
  });

  it('fin de partie serrée : deux survivants sur une carte à plusieurs, ou un dernier carré sans camp', () => {
    const s = (alive: boolean, camps: number) => ({ alive, camps });
    expect(isFinale([s(true, 2), s(true, 1), s(true, 1)])).toBe(false);
    expect(isFinale([s(true, 2), s(false, 0), s(true, 1)])).toBe(true);
    expect(isFinale([s(true, 2), s(true, 2)])).toBe(false);
    expect(isFinale([s(true, 2), s(true, 0)])).toBe(true);
    expect(isFinale([s(true, 3), s(false, 0)])).toBe(false);
  });
});
