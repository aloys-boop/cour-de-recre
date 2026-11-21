/** Interface b (v5.22) : ondes sous le doigt, boutons qui s'enfoncent, fondus entre écrans. */
import { describe, expect, it } from 'vitest';
import {
  addRipple,
  attackTicks,
  easeOut,
  PRESS_MIN_MS,
  releaseDelay,
  RIPPLE,
  rippleKindFor,
  rippleLife,
  rippleRings,
  rippleStyle,
  rippleTeamColor,
  tickRipples,
  transitionMs,
  TRANSITION_REDUCED_MS,
  veilOpacity,
  type Ripple,
  type RippleKind,
} from '../src/core/feedback';
import { contrastRatio } from '../src/core/emblems';
import { TEAM_COLORS } from '../src/config';
import { HOW_TO } from '../src/ui/overlay';

const R = (kind: RippleKind, t: number): Ripple => ({ x: 100, y: 80, t, kind, team: '#7fd36a' });

describe('onde sous le doigt', () => {
  it('chaque ordre a sa couleur : déplacement, charge et attaque se distinguent', () => {
    const team = '#7fd36a';
    const colors = (['move', 'charge', 'attack'] as RippleKind[]).map((k) => rippleStyle(k, team).color);
    expect(new Set(colors).size).toBe(3);
    expect(rippleStyle('capture', team).color).toBe(team);
    expect(rippleStyle('select', team).color).toBe(team);
    // Seule l'attaque a des crans ; la sélection et le tap à vide sont plus petits et plus pâles.
    expect(rippleStyle('attack', team).ticks).toBe(true);
    expect(rippleStyle('move', team).ticks).toBe(false);
    expect(rippleStyle('select', team).maxR).toBeLessThan(rippleStyle('move', team).maxR);
    expect(rippleStyle('tap', team).alpha).toBeLessThan(rippleStyle('move', team).alpha);
  });

  it('l’onde s’ouvre en douceur, pâlit, puis s’éteint ; le second anneau part plus tard', () => {
    let lastR = 0;
    let lastA = 2;
    for (let t = 0; t < RIPPLE.life; t += 0.02) {
      const first = rippleRings(R('move', t), false)[0];
      expect(first.radius).toBeGreaterThanOrEqual(lastR);
      expect(first.alpha).toBeLessThanOrEqual(lastA);
      lastR = first.radius;
      lastA = first.alpha;
    }
    expect(lastR).toBeLessThanOrEqual(rippleStyle('move', '#fff').maxR);
    expect(rippleRings(R('move', 0.01), false)).toHaveLength(1);
    expect(rippleRings(R('move', RIPPLE.life * 0.5), false)).toHaveLength(2);
    expect(rippleRings(R('move', RIPPLE.life), false)).toHaveLength(0);
    // Départ rapide : à mi-vie, plus des trois quarts du chemin est fait.
    expect(easeOut(0.5)).toBeGreaterThan(0.85);
  });

  it('« réduire les animations » : un seul anneau, plus bref, crans sans rotation', () => {
    expect(rippleLife(true)).toBeLessThan(rippleLife(false));
    expect(rippleRings(R('move', 0.1), true)).toHaveLength(1);
    expect(rippleRings(R('move', RIPPLE.reducedLife), true)).toHaveLength(0);
    const a = attackTicks(R('attack', 0.1), true)!;
    const b = attackTicks(R('attack', 0.2), true)!;
    expect(a.angle).toBe(b.angle);
  });

  it('attaque : les quatre crans se referment sur le doigt', () => {
    const early = attackTicks(R('attack', 0.02), false)!;
    const late = attackTicks(R('attack', 0.4), false)!;
    expect(late.dist).toBeLessThan(early.dist);
    expect(late.alpha).toBeLessThan(early.alpha);
    expect(attackTicks(R('move', 0.1), false)).toBeNull();
    expect(attackTicks(R('attack', RIPPLE.life), false)).toBeNull();
  });

  it('les ondes vieillissent en temps réel, au plus six à l’écran', () => {
    let list: Ripple[] = [];
    for (let i = 0; i < 9; i++) addRipple(list, { x: i, y: 0, kind: 'tap', team: '#fff' });
    expect(list).toHaveLength(RIPPLE.max);
    expect(list[0].x).toBe(3); // les plus vieilles cèdent la place
    list = tickRipples(list, 0.3, false);
    expect(list).toHaveLength(6);
    list = tickRipples(list, 0.3, false);
    expect(list).toHaveLength(0);
    expect(tickRipples([{ ...R('move', 0) }], -1, false)[0].t).toBe(0);
  });

  it('l’ordre compris se lit dans ce que le geste a produit', () => {
    expect(rippleKindFor('move', true)).toBe('move');
    expect(rippleKindFor('charge', false)).toBe('charge');
    expect(rippleKindFor('attack', false)).toBe('attack');
    expect(rippleKindFor('capture', false)).toBe('capture');
    expect(rippleKindFor(null, true)).toBe('select');
    expect(rippleKindFor(null, false)).toBe('tap');
    expect(rippleKindFor('move', false, 'power')).toBe('power');
  });

  it('lisible sur le sol : couleur de l’équipe éclaircie, halo sombre à 3:1 au moins', () => {
    const floor = '#d2d2d4';
    expect(contrastRatio('#0a1028', floor)).toBeGreaterThanOrEqual(3);
    // La teinte claire des Noirs (gris foncé) est éclaircie : elle ne se confond plus avec le halo.
    const black = rippleTeamColor(TEAM_COLORS[0].light);
    expect(contrastRatio(black, '#0a1028')).toBeGreaterThan(contrastRatio(TEAM_COLORS[0].light, '#0a1028'));
    for (const c of TEAM_COLORS) expect(rippleTeamColor(c.light)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('boutons qui s’enfoncent', () => {
  it('un tap très bref reste visible au moins 110 ms', () => {
    expect(PRESS_MIN_MS).toBe(110);
    expect(releaseDelay(20)).toBe(90);
    expect(releaseDelay(500)).toBe(0);
    expect(releaseDelay(-5)).toBe(110);
  });
});

describe('fondus entre écrans', () => {
  it('le voile part plein et se lève en douceur, jamais plus d’une demi-seconde', () => {
    for (const k of ['partie', 'menu', 'fin'] as const) {
      const ms = transitionMs(k, false);
      expect(ms).toBeGreaterThan(200);
      expect(ms).toBeLessThanOrEqual(500);
      expect(transitionMs(k, true)).toBe(TRANSITION_REDUCED_MS);
      expect(veilOpacity(0, ms)).toBe(1);
      expect(veilOpacity(ms, ms)).toBe(0);
      let last = 1;
      for (let t = 0; t <= ms; t += 20) {
        const o = veilOpacity(t, ms);
        expect(o).toBeLessThanOrEqual(last);
        last = o;
      }
    }
    expect(veilOpacity(10, 0)).toBe(0);
  });

  it('« Comment jouer » explique l’onde sous le doigt', () => {
    const text = HOW_TO.find(([t]) => t === 'Déplacer et attaquer')![1];
    expect(text).toMatch(/onde/);
    expect(text).toMatch(/rouge à quatre crans/);
  });
});
