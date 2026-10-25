// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { encodeMapCode } from '../src/core/mapcode';
import type { Progress } from '../src/core/save';
import { Menu, type MenuState } from '../src/ui/menu';
import { codeBlock, medalsBlock } from '../src/ui/share';

function setup(progress: Partial<Progress> = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const played: MenuState[] = [];
  const p: Progress = { unlocked: 2, wins: {}, muted: false, lastTeam: 0, lastDifficulty: 'normal', ...progress };
  const menu = new Menu(root, p, {
    onPlay: (s) => played.push(s),
    onToggleSound: () => false,
    onInstallHelp: () => undefined,
  });
  menu.show();
  const click = (sel: string, i = 0) => (root.querySelectorAll(sel)[i] as HTMLButtonElement).click();
  return { root, played, click };
}

describe('menu : escarmouche, code de carte, médailles', () => {
  it('lance une escarmouche avec les réglages choisis', () => {
    const { root, played, click } = setup();
    const tabs = root.querySelectorAll('.mode-btn');
    expect([...tabs].map((t) => t.textContent)).toEqual(['Campagne', 'Escarmouche']);
    click('.mode-btn', 1);
    click('.opt-btn', 1); // 3 équipes
    click('.opt-btn', 10); // cour immense (après les 7 boutons d'équipes, de 2 à 8)
    const plus = root.querySelector('[aria-label="Plus de cases"]') as HTMLButtonElement;
    plus.click();
    plus.click();
    click('.btn-play');
    expect(played).toHaveLength(1);
    expect(played[0].mode).toBe('escarmouche');
    expect(played[0].skirmish).toEqual({ teams: 3, size: 3, tiles: 20 });
    expect(played[0].code).toBeUndefined();
  });

  it('affiche trois pastilles de médailles par carte débloquée', () => {
    const { root } = setup({ medals: { preau: { victoire: true, eclair: true } } });
    const dots = root.querySelectorAll('.map-btn')[0].querySelectorAll('.medal-dots i');
    expect(dots).toHaveLength(3);
    expect([...dots].map((d) => d.classList.contains('on'))).toEqual([true, false, true]);
    // Carte verrouillée : pas de pastilles.
    expect(root.querySelectorAll('.map-btn')[3].querySelector('.medal-dots')).toBeNull();
  });

  it('valide le code de carte saisi', () => {
    const { root, played, click } = setup();
    const input = root.querySelector('.code-input') as HTMLInputElement;
    const hint = root.querySelector('.code-hint')!;
    input.value = 'ZZZZZZ';
    input.dispatchEvent(new Event('input'));
    click('.btn-play');
    expect(played).toHaveLength(0);
    expect(hint.classList.contains('error')).toBe(true);

    // Niveau 4 pas encore débloqué.
    input.value = encodeMapCode({ spec: { kind: 'campagne', level: 3 }, seed: 12 });
    input.dispatchEvent(new Event('input'));
    expect(hint.textContent).toMatch(/pas encore débloqué/);

    const code = encodeMapCode({ spec: { kind: 'escarmouche', teams: 2, size: 0, tiles: 12 }, seed: 4321 });
    input.value = code.toLowerCase();
    input.dispatchEvent(new Event('input'));
    expect(hint.textContent).toBe('Carte partagée : Escarmouche : 2 équipes, cour petite, 12 cases');
    click('.btn-play');
    expect(played[0].code).toEqual({ spec: { kind: 'escarmouche', teams: 2, size: 0, tiles: 12 }, seed: 4321 });
  });

  it('blocs de fin de partie : code copiable et médailles', () => {
    const box = codeBlock('K7MQ2P', () => undefined);
    expect(box.querySelector('.code-value')!.textContent).toBe('K7MQ2P');
    expect([...box.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Copier', 'Rejouer cette carte']);
    const medals = medalsBlock({ victoire: true, camp: true }, ['camp']);
    const items = medals.querySelectorAll('.medal');
    expect(items).toHaveLength(3);
    expect(items[1].classList.contains('fresh')).toBe(true);
    expect(items[2].classList.contains('on')).toBe(false);
  });
});
