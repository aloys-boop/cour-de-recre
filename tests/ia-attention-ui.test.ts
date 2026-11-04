// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Progress } from '../src/core/save';
import { HOW_TO } from '../src/ui/overlay';
import { Menu } from '../src/ui/menu';

describe('attention des IA dans l’interface', () => {
  it('sous les boutons de difficulté, une ligne suit le niveau choisi', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const p: Progress = { unlocked: 1, wins: {}, muted: false, lastTeam: 0, lastDifficulty: 'normal' };
    new Menu(root, p, { onPlay: () => undefined, onToggleSound: () => false, onInstallHelp: () => undefined }).show();
    const hint = root.querySelector('.diff-hint')!;
    expect(hint.textContent).toContain('18 ordres par minute');
    const btns = [...root.querySelectorAll<HTMLButtonElement>('.diff-btn')];
    btns[0].click();
    expect(hint.textContent).toContain('10 ordres par minute');
    btns[3].click();
    expect(hint.textContent).toContain('40 ordres par minute');
  });

  it('« Comment jouer » explique que les IA ne sont pas partout à la fois', () => {
    const r = HOW_TO.find(([t]) => t === 'Les IA');
    expect(r?.[1]).toContain('attention limitée');
  });
});
