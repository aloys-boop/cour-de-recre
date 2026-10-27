// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { AI_PROFILES, BETRAYAL, DIFFICULTIES, STORAGE_KEY } from '../src/config';
import { ECONOMY_PROFILES, EconomyAi } from '../src/core/ai-economy';
import { TeamAi } from '../src/core/ai';
import { awardMerit } from '../src/core/merits';
import { bestPowerSpot } from '../src/core/powers';
import { loadProgress, migrateDifficulty, saveProgress, type Progress } from '../src/core/save';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';
import { Menu } from '../src/ui/menu';

const ARENA: MapDef = {
  id: 'test',
  name: 'Test',
  w: 16,
  h: 16,
  teams: 2,
  unitCap: 30,
  spawnInterval: 1000,
  startUnits: 0,
  tiles: [
    { kind: 'camp', x: 0, y: 0, owner: 0 },
    { kind: 'camp', x: 14, y: 14, owner: 1 },
  ],
};

function memoryStore(init: Record<string, string> = {}) {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}

describe('difficulté : 4 niveaux', () => {
  it('Facile, Normal, Difficile, Expert, dans cet ordre, dans le menu', () => {
    expect(DIFFICULTIES.map((d) => d.label)).toEqual(['Facile', 'Normal', 'Difficile', 'Expert']);
    const root = document.createElement('div');
    document.body.append(root);
    const played: string[] = [];
    const p: Progress = { unlocked: 1, wins: {}, muted: false, lastTeam: 0, lastDifficulty: 'normal' };
    new Menu(root, p, { onPlay: (s) => played.push(s.difficulty), onToggleSound: () => false, onInstallHelp: () => undefined }).show();
    const btns = [...root.querySelectorAll<HTMLButtonElement>('.diff-btn')];
    expect(btns.map((b) => b.textContent)).toEqual(['Facile', 'Normal', 'Difficile', 'Expert']);
    expect(btns[1].classList.contains('active')).toBe(true);
    btns[3].click();
    expect(btns[3].classList.contains('active')).toBe(true);
    (root.querySelector('.btn-play') as HTMLButtonElement).click();
    expect(played).toEqual(['expert']);
  });

  it('Difficile = l’ancien Normal, Expert = l’ancien Difficile, Facile inchangé', () => {
    expect(AI_PROFILES.facile).toEqual({ reaction: 2.6, groupMin: 5, keepHome: 0.5, aggression: 0.3, rallyRadius: 1.6, damage: 0.75 });
    expect(AI_PROFILES.difficile).toEqual({ reaction: 1.5, groupMin: 4, keepHome: 0.35, aggression: 0.6, rallyRadius: 1.4, damage: 1 });
    expect(AI_PROFILES.expert).toEqual({ reaction: 0.8, groupMin: 3, keepHome: 0.2, aggression: 0.9, rallyRadius: 1.2, damage: 1.15 });
    expect(BETRAYAL.difficile).toEqual({ strongerRatio: 1.8, chance: 0.3, endgameChance: 0.35 });
    expect(BETRAYAL.expert).toEqual({ strongerRatio: 1.45, chance: 0.6, endgameChance: 0.7 });
    expect(ECONOMY_PROFILES.difficile).toMatchObject({ interval: 4, margin: 1, smart: true, randomPick: 0, powerUse: 1, powerAim: 0 });
    expect(ECONOMY_PROFILES.expert).toMatchObject({ interval: 2, margin: 1, smart: true, randomPick: 0, powerUse: 1, powerAim: 0 });
  });

  it('nouveau Normal : plus lent, plus gros groupes, plus de défenseurs, dégâts ×0,9, dépenses moins optimales', () => {
    const n = AI_PROFILES.normal;
    const d = AI_PROFILES.difficile;
    expect(n.reaction).toBeGreaterThan(d.reaction);
    expect(n.groupMin).toBeGreaterThan(d.groupMin);
    expect(n.keepHome).toBeGreaterThan(d.keepHome);
    expect(n.damage).toBe(0.9);
    const en = ECONOMY_PROFILES.normal;
    const ed = ECONOMY_PROFILES.difficile;
    expect(en.interval).toBeGreaterThan(ed.interval); // achats retardés
    expect(en.margin).toBeGreaterThan(1);
    expect(en.randomPick).toBeGreaterThan(0); // choix parfois au hasard
    expect(en.powerUse).toBeLessThan(1); // pouvoirs moins souvent…
    expect(en.powerAim).toBeGreaterThan(0); // … et moins bien ciblés
    for (const id of ['sonnerie', 'neige', 'gouter'] as const) expect(en.powers![id]).toBeGreaterThan(ed.powers![id]);
    // Entre Facile et Difficile.
    expect(n.reaction).toBeLessThan(AI_PROFILES.facile.reaction);
    expect(n.damage).toBeGreaterThan(AI_PROFILES.facile.damage);
  });

  it('Normal : pouvoirs parfois laissés de côté, et lancés à côté du meilleur point', () => {
    let casts = 0;
    let offTarget = 0;
    const tries = 30;
    for (let seed = 1; seed <= tries; seed++) {
      const w = new World({ ...ARENA, seed }, 2, seed);
      awardMerit(w, 1, 1000, 0, 0, 'hold');
      for (let i = 0; i < 10; i++) w.spawnUnit(0, 7 + (i % 4) * 0.4, 7 + Math.floor(i / 4) * 0.4, false);
      for (let i = 0; i < 5; i++) w.spawnUnit(1, 8.5 + (i % 3) * 0.4, 9, false);
      w.update(1 / 60);
      w.drainEvents();
      const best = bestPowerSpot(w, 1, 'sonnerie')!;
      if (new EconomyAi(w, 1, 'normal').usePowers()) {
        casts++;
        const ev = w.drainEvents().find((e) => e.kind === 'power');
        if (ev && ev.kind === 'power' && Math.hypot(ev.x - best.x, ev.y - best.y) > 0.05) offTarget++;
      }
    }
    expect(casts).toBeGreaterThan(0);
    expect(casts).toBeLessThan(tries);
    expect(offTarget).toBe(casts);
  });

  it('Normal : choix d’achat parfois au hasard, Difficile toujours raisonné', () => {
    const picks = (diff: 'normal' | 'difficile') => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) {
        const w = new World({ ...ARENA, seed }, 2, seed);
        awardMerit(w, 1, 1000, 0, 0, 'hold');
        const eco = new EconomyAi(w, 1, diff);
        eco.allowPion = false; // sinon, riche, l'IA commence par un pion
        eco.think();
        const u = w.teamUpgrades[1];
        seen.add(`${u.prod}${u.hp}${u.dmg}${u.classes ? 1 : 0}`);
      }
      return seen.size;
    };
    expect(picks('difficile')).toBe(1);
    expect(picks('normal')).toBeGreaterThan(1);
  });

  it('réglages remplacés d’une IA (joueur témoin) sans toucher au profil commun', () => {
    const w = new World(ARENA, 2, 1);
    const ai = new TeamAi(w, 1, 'difficile', { reaction: 3 });
    expect(ai.profile.reaction).toBe(3);
    expect(ai.profile.groupMin).toBe(AI_PROFILES.difficile.groupMin);
    expect(AI_PROFILES.difficile.reaction).toBe(1.5);
  });
});

describe('sauvegarde : passage à 4 niveaux', () => {
  it('ancienne sauvegarde : « normal » → « difficile », « difficile » → « expert », « facile » inchangé', () => {
    for (const [old, now] of [
      ['normal', 'difficile'],
      ['difficile', 'expert'],
      ['facile', 'facile'],
      ['n’importe quoi', 'normal'],
    ]) {
      const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ unlocked: 2, wins: {}, muted: false, lastTeam: 1, lastDifficulty: old }) });
      expect(loadProgress(store).lastDifficulty).toBe(now);
    }
    expect(migrateDifficulty('normal', undefined)).toBe('difficile');
    expect(migrateDifficulty('normal', 2)).toBe('normal');
    expect(migrateDifficulty('expert', 2)).toBe('expert');
  });

  it('une sauvegarde convertie puis réenregistrée n’est pas convertie deux fois', () => {
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ unlocked: 2, wins: {}, muted: false, lastTeam: 1, lastDifficulty: 'normal' }) });
    const p = loadProgress(store);
    expect(p.lastDifficulty).toBe('difficile');
    saveProgress(p, store);
    expect(loadProgress(store).lastDifficulty).toBe('difficile');
    // Nouveau Normal choisi et enregistré : relu tel quel.
    saveProgress({ ...p, lastDifficulty: 'normal' }, store);
    expect(JSON.parse(store.data[STORAGE_KEY]).difficultyScale).toBe(2);
    expect(loadProgress(store).lastDifficulty).toBe('normal');
    // Première partie : Normal par défaut.
    expect(loadProgress(memoryStore()).lastDifficulty).toBe('normal');
  });
});
