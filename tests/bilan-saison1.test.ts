// @vitest-environment jsdom
/**
 * 1.7 Bilan saison 1 (v5.15) : « Comment jouer » rangé en chapitres, synthèse des outils
 * contre la micro, et tous les gestes de la saison expliqués quelque part.
 */
import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS } from '../src/core/tutorial';
import { HOW_TO, HOW_TO_CHAPTERS, Overlay, TOOLS_TITLE } from '../src/ui/overlay';

describe('« Comment jouer » en chapitres', () => {
  it('chaque rubrique est dans un chapitre, une seule fois, et dans le même ordre', () => {
    const titles = HOW_TO.map(([t]) => t);
    const inChapters = HOW_TO_CHAPTERS.flatMap((c) => c.sections);
    expect(inChapters).toEqual(titles);
    expect(new Set(titles).size).toBe(titles.length);
    expect(HOW_TO_CHAPTERS.map((c) => c.id)).toEqual(['bases', 'progresser', 'outils', 'autres']);
    for (const c of HOW_TO_CHAPTERS) expect(c.tab.length).toBeLessThanOrEqual(11);
  });

  it('la synthèse des outils nomme chaque outil de la saison 1', () => {
    const text = HOW_TO.find(([t]) => t === TOOLS_TITLE)?.[1] ?? '';
    for (const tool of ['« Garder »', '« Défendre »', '« Conquérir »', '« Suivre »', '« Auto »', 'alertes', 'sablier']) expect(text).toContain(tool);
    const outils = HOW_TO_CHAPTERS.find((c) => c.id === 'outils')!;
    expect(outils.sections[0]).toBe(TOOLS_TITLE);
    for (const s of ['Garnisons', 'Défense', 'Conquête', 'Escorte', 'Renforts', 'Alertes', 'Rythme']) expect(outils.sections).toContain(s);
  });

  it('typographie : ni tiret cadratin ni demi-cadratin, ni apostrophe droite dans les textes', () => {
    for (const [t, x] of HOW_TO) {
      expect(`${t} ${x}`).not.toMatch(/[—–]/);
      expect(`${t} ${x}`).not.toMatch(/'/);
    }
    for (const s of TUTORIAL_STEPS) expect(s.text).not.toMatch(/[—–']/);
  });

  it('l’écran affiche quatre onglets ; toucher un onglet l’allume', () => {
    document.body.innerHTML = '<div id="overlay" class="hidden"></div>';
    const root = document.getElementById('overlay')!;
    const overlay = new Overlay(root);
    let closed = false;
    overlay.howTo(() => (closed = true));
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('.howto-tab')];
    expect(tabs.map((b) => b.textContent)).toEqual(HOW_TO_CHAPTERS.map((c) => c.tab));
    expect(tabs[0].classList.contains('on')).toBe(true);
    expect(root.querySelectorAll('.howto-chapter').length).toBe(4);
    expect(root.querySelectorAll('.howto-body section').length).toBe(HOW_TO.length);
    expect(root.querySelector('.howto-tools h3')!.textContent).toBe(TOOLS_TITLE);
    tabs[2].click();
    expect(tabs[2].classList.contains('on')).toBe(true);
    expect(tabs[0].classList.contains('on')).toBe(false);
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Retour')!.click();
    expect(closed).toBe(true);
  });
});

describe('tutoriel : les outils de la saison 1', () => {
  it('« Garder » puis « Conquérir » sont enseignés, dans cet ordre', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(ids.indexOf('conquer')).toBe(ids.indexOf('guard') + 1);
    const step = TUTORIAL_STEPS.find((s) => s.id === 'conquer')!;
    expect(step.target).toEqual({ kind: 'button', selector: '#btn-conquer' });
    expect(step.text.length).toBeLessThanOrEqual(90);
  });
});

describe('espaces insécables (v5.15)', () => {
  it('guillemets et ponctuation double ne restent jamais seuls en bout de ligne', async () => {
    const { insecables, stepText } = await import('../src/core/tutorial');
    expect(insecables('touche « Conquérir » : ils partent ! Prêt ?')).toBe('touche «\u00a0Conquérir\u00a0»\u00a0: ils partent\u00a0! Prêt\u00a0?');
    for (const s of TUTORIAL_STEPS) expect(stepText(s, 1)).not.toMatch(/« | »| [:;!?]/);
  });
});

describe('écran de fin : pauses tactiques (v5.15)', () => {
  it('la ligne de durée compte les pauses tactiques, et rien sans pause', async () => {
    const { durationLine } = await import('../src/core/stats');
    expect(durationLine({ duration: 185 })).toBe('Durée de la partie : 3\u00a0min 05\u00a0s');
    expect(durationLine({ duration: 185, tacticalPauses: 0 })).toBe('Durée de la partie : 3\u00a0min 05\u00a0s');
    expect(durationLine({ duration: 45, tacticalPauses: 1 })).toBe('Durée de la partie : 45\u00a0s, 1 pause tactique');
    expect(durationLine({ duration: 45, tacticalPauses: 4 })).toBe('Durée de la partie : 45\u00a0s, 4 pauses tactiques');
  });

  it('endStats ne garde le champ que s’il y a eu des pauses', async () => {
    const { endStats } = await import('../src/core/stats');
    const { World } = await import('../src/core/world');
    const { TUTORIAL_MAP } = await import('../src/core/tutorial');
    const w = new World(TUTORIAL_MAP);
    const stats = { teams: [] } as unknown as Parameters<typeof endStats>[0];
    expect(endStats(stats, w, 0).tacticalPauses).toBeUndefined();
    expect(endStats(stats, w, 0, 3).tacticalPauses).toBe(3);
  });
});
