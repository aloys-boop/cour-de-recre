// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { generateMap } from '../src/core/mapgen';
import { CODE_LENGTH, decodeMapCode, encodeMapCode, LONG_CODE_LENGTH, mapForCode, type MapSpec } from '../src/core/mapcode';
import type { Progress } from '../src/core/save';
import { clampSkirmish, clampSuits, evenSuits, minTilesFor, SKIRMISH_TILES_MAX, SKIRMISH_TILES_MIN, skirmishLevel, type SuitCounts } from '../src/core/skirmish';
import type { MapDef, Suit } from '../src/core/types';
import { Menu, type MenuState } from '../src/ui/menu';

function count(map: MapDef): SuitCounts {
  const c: SuitCounts = { heart: 0, spade: 0, club: 0, diamond: 0 };
  for (const t of map.tiles) if (t.kind === 'bonus') c[t.suit as Suit]++;
  return c;
}

describe('cases bonus personnalisées (escarmouche)', () => {
  it('de 4 à 30 cases, quel que soit le nombre d’équipes', () => {
    expect(SKIRMISH_TILES_MIN).toBe(4);
    expect(SKIRMISH_TILES_MAX).toBe(30);
    for (let teams = 2; teams <= 8; teams++) {
      expect(minTilesFor(teams)).toBe(4);
      expect(clampSkirmish({ teams, size: 1, tiles: 4 }).tiles).toBe(4);
      expect(clampSkirmish({ teams, size: 1, tiles: 1 }).tiles).toBe(4);
      expect(clampSkirmish({ teams, size: 1, tiles: 99 }).tiles).toBe(30);
    }
  });

  it('répartition par symbole bornée : 0 à 30 chacun, total de 4 à 30', () => {
    expect(clampSuits({ heart: 0, spade: 0, club: 0, diamond: 0 })).toEqual({ heart: 1, spade: 1, club: 1, diamond: 1 });
    expect(clampSuits({ heart: 2, spade: 0, club: 0, diamond: 0 })).toEqual({ heart: 2, spade: 1, club: 1, diamond: 0 });
    const big = clampSuits({ heart: 30, spade: 30, club: 2, diamond: -5 });
    expect(big.heart + big.spade + big.club + big.diamond).toBe(30);
    expect(big.diamond).toBe(0);
    expect(clampSuits({ heart: 'x', spade: 4.4, club: 0, diamond: 0 })).toEqual({ heart: 0, spade: 4, club: 0, diamond: 0 });
    expect(evenSuits(18)).toEqual({ heart: 5, spade: 5, club: 4, diamond: 4 });
    const s = clampSkirmish({ teams: 4, size: 1, tiles: 12, suits: { heart: 6, spade: 0, club: 3, diamond: 1 } });
    expect(s).toEqual({ teams: 4, size: 1, tiles: 10, suits: { heart: 6, spade: 0, club: 3, diamond: 1 } });
    // Sans personnalisation : pas de champ « suits ».
    expect('suits' in clampSkirmish({ teams: 4, size: 1, tiles: 12 })).toBe(false);
  });

  it('la carte générée a exactement le nombre de cases demandé pour chaque symbole', () => {
    const cases: SuitCounts[] = [
      { heart: 4, spade: 0, club: 0, diamond: 0 },
      { heart: 0, spade: 0, club: 0, diamond: 30 },
      { heart: 5, spade: 3, club: 1, diamond: 4 },
      { heart: 1, spade: 1, club: 1, diamond: 1 },
      { heart: 10, spade: 0, club: 9, diamond: 0 },
    ];
    for (const suits of cases)
      for (let teams = 2; teams <= 8; teams++)
        for (const size of [0, 3])
          for (const seed of [1, 77]) {
            const map = generateMap(skirmishLevel({ teams, size, tiles: 0, suits }), seed);
            expect(count(map), `${teams} équipes, taille ${size}, ${JSON.stringify(suits)}`).toEqual(suits);
          }
  });

  it('carte symétrique : les cases miroir ont le même symbole quand les nombres sont pairs', () => {
    const map = generateMap(skirmishLevel({ teams: 4, size: 1, tiles: 0, suits: { heart: 6, spade: 2, club: 0, diamond: 4 } }), 5);
    const at = new Map(map.tiles.filter((t) => t.kind === 'bonus').map((t) => [`${t.x},${t.y}`, t.suit]));
    for (const t of map.tiles) if (t.kind === 'bonus') expect(at.get(`${map.w - 1 - t.x},${map.h - 1 - t.y}`)).toBe(t.suit);
  });

  it('4 cases à 8 équipes : carte jouable', () => {
    const map = generateMap(skirmishLevel({ teams: 8, size: 0, tiles: 4 }), 3);
    expect(map.tiles.filter((t) => t.kind === 'bonus')).toHaveLength(4);
    expect(map.tiles.filter((t) => t.kind === 'camp')).toHaveLength(8);
  });

  it('code de carte : court quand c’est possible, long (10 caractères) pour une escarmouche personnalisée', () => {
    const short: MapSpec = { kind: 'escarmouche', teams: 4, size: 1, tiles: 18 };
    expect(encodeMapCode({ spec: short, seed: 5 })).toHaveLength(CODE_LENGTH);
    const specs: MapSpec[] = [
      { kind: 'escarmouche', teams: 8, size: 3, tiles: 4 },
      { kind: 'escarmouche', teams: 2, size: 0, tiles: 9 },
      { kind: 'escarmouche', teams: 6, size: 2, tiles: 19 },
      { kind: 'escarmouche', teams: 3, size: 1, tiles: 13, suits: { heart: 5, spade: 3, club: 1, diamond: 4 } },
      { kind: 'escarmouche', teams: 5, size: 0, tiles: 30, suits: { heart: 0, spade: 30, club: 0, diamond: 0 } },
      { kind: 'escarmouche', teams: 4, size: 1, tiles: 18, suits: { heart: 5, spade: 5, club: 4, diamond: 4 } },
    ];
    for (const spec of specs)
      for (const seed of [0, 12345, 1048575]) {
        const code = encodeMapCode({ spec, seed });
        expect(code).toHaveLength(LONG_CODE_LENGTH);
        expect(decodeMapCode(code)).toEqual({ spec, seed });
        expect(decodeMapCode(code.toLowerCase().replace(/(.{5})/, '$1-'))).toEqual({ spec, seed });
        // Même code, même disposition.
        expect(mapForCode(decodeMapCode(code)!)).toEqual(mapForCode({ spec, seed }));
      }
    // La plupart des codes longs tapés au hasard sont refusés.
    const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let ok = 0;
    for (let i = 0; i < 2000; i++) {
      let s = '';
      for (let k = 0; k < 10; k++) s += A[(i * 7 + k * 13 + ((i * k) % 11)) % 32];
      if (decodeMapCode(s)) ok++;
    }
    expect(ok).toBeLessThan(40);
  });
});

describe('menu : cases bonus personnalisées', () => {
  function setup() {
    const root = document.createElement('div');
    document.body.append(root);
    const played: MenuState[] = [];
    const p: Progress = { unlocked: 2, wins: {}, muted: false, lastTeam: 0, lastDifficulty: 'normal' };
    new Menu(root, p, { onPlay: (s) => played.push(s), onToggleSound: () => false, onInstallHelp: () => undefined }).show();
    (root.querySelectorAll('.mode-btn')[1] as HTMLButtonElement).click();
    const btn = (label: string) => root.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement;
    return { root, played, btn };
  }

  it('total réglable de 4 à 30 cases', () => {
    const { root, btn } = setup();
    const value = () => root.querySelector('.skirmish .stepper-value')!.textContent;
    for (let i = 0; i < 40; i++) btn('Moins de cases').click();
    expect(value()).toBe('4');
    expect(btn('Moins de cases').disabled).toBe(true);
    for (let i = 0; i < 40; i++) btn('Plus de cases').click();
    expect(value()).toBe('30');
    expect(btn('Plus de cases').disabled).toBe(true);
  });

  it('« Personnalisés » : un nombre de cases par symbole, total de 4 à 30, transmis à la partie', () => {
    const { root, played, btn } = setup();
    const grid = root.querySelector('.suit-grid')!;
    expect(grid.classList.contains('hidden')).toBe(true);
    const modeBtns = root.querySelectorAll<HTMLButtonElement>('.suit-mode .opt-btn');
    expect([...modeBtns].map((b) => b.textContent)).toEqual(['Équilibrés', 'Personnalisés']);
    modeBtns[1].click();
    expect(grid.classList.contains('hidden')).toBe(false);
    const val = (s: Suit) => root.querySelector(`.suit-line[data-suit="${s}"] .stepper-value`)!.textContent;
    // Départ : les 18 cases à parts égales.
    expect(['heart', 'spade', 'club', 'diamond'].map((s) => val(s as Suit))).toEqual(['5', '5', '4', '4']);
    for (let i = 0; i < 10; i++) btn('Moins de cases ♠').click();
    expect(val('spade')).toBe('0');
    expect(btn('Moins de cases ♠').disabled).toBe(true);
    for (let i = 0; i < 20; i++) btn('Plus de cases ♥').click();
    expect(root.querySelector('.suit-note')!.textContent).toMatch(/Total : 30 cases/);
    expect(btn('Plus de cases ♦').disabled).toBe(true);
    expect(val('heart')).toBe('22');
    // On descend jusqu'au minimum de 4 cases au total.
    for (let i = 0; i < 30; i++) btn('Moins de cases ♥').click();
    for (let i = 0; i < 10; i++) btn('Moins de cases ♣').click();
    expect(root.querySelector('.suit-note')!.textContent).toMatch(/Total : 4 cases/);
    expect(btn('Moins de cases ♦').disabled).toBe(true);
    (root.querySelector('.btn-play') as HTMLButtonElement).click();
    const sk = played[0].skirmish;
    expect(sk.tiles).toBe(4);
    expect(sk.suits!.heart + sk.suits!.spade + sk.suits!.club + sk.suits!.diamond).toBe(4);
    expect(sk.suits!.spade).toBe(0);
  });

  it('retour à « Équilibrés » : le total est conservé, sans détail par symbole', () => {
    const { root, played, btn } = setup();
    const modeBtns = root.querySelectorAll<HTMLButtonElement>('.suit-mode .opt-btn');
    modeBtns[1].click();
    btn('Plus de cases ♣').click();
    btn('Plus de cases ♣').click();
    modeBtns[0].click();
    expect(root.querySelector('.suit-grid')!.classList.contains('hidden')).toBe(true);
    expect(root.querySelector('.skirmish .stepper-value')!.textContent).toBe('20');
    (root.querySelector('.btn-play') as HTMLButtonElement).click();
    expect(played[0].skirmish).toEqual({ teams: 4, size: 1, tiles: 20 });
  });

  it('un code long saisi dans le menu lance la carte personnalisée', () => {
    const { root, played } = setup();
    const spec: MapSpec = { kind: 'escarmouche', teams: 3, size: 2, tiles: 7, suits: { heart: 0, spade: 2, club: 5, diamond: 0 } };
    const input = root.querySelector('.code-input') as HTMLInputElement;
    input.value = encodeMapCode({ spec, seed: 99 });
    input.dispatchEvent(new Event('input'));
    expect(root.querySelector('.code-hint')!.textContent).toMatch(/7 cases \(0 ♥, 2 ♠, 5 ♣, 0 ♦\)/);
    (root.querySelector('.btn-play') as HTMLButtonElement).click();
    expect(played[0].code).toEqual({ spec, seed: 99 });
  });
});
