// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  STAT_POINT_VALUES,
  STAT_POINTS_MAX,
  STAT_POINTS_MIN,
  statValue,
  TEAM_NAMES,
  TEAM_POINT_BUDGET,
  TEAM_PROFILES,
  TEAM_STATS,
  TUNING,
} from '../src/config';
import type { MapDef } from '../src/core/types';
import { World } from '../src/core/world';
import type { Progress } from '../src/core/save';
import { Menu } from '../src/ui/menu';

describe('équipes : budget fixe de 12 points', () => {
  it('chaque équipe a exactement 12 points, de 1 à 5 par caractéristique', () => {
    expect(TEAM_POINT_BUDGET).toBe(12);
    expect(TEAM_PROFILES).toHaveLength(TEAM_NAMES.length);
    for (const p of TEAM_PROFILES) {
      const total = TEAM_STATS.reduce((s, k) => s + p.points[k], 0);
      expect(total).toBe(12);
      for (const k of TEAM_STATS) {
        expect(Number.isInteger(p.points[k])).toBe(true);
        expect(p.points[k]).toBeGreaterThanOrEqual(STAT_POINTS_MIN);
        expect(p.points[k]).toBeLessThanOrEqual(STAT_POINTS_MAX);
      }
    }
  });

  it('répartition de départ (vie / dégâts / production / vitesse)', () => {
    const pts = TEAM_PROFILES.map((p) => [p.points.hp, p.points.dmg, p.points.prod, p.points.speed]);
    expect(Object.fromEntries(TEAM_NAMES.map((n, i) => [n, pts[i].join('/')]))).toEqual({
      Noir: '3/3/3/3',
      Vert: '2/2/5/3',
      Jaune: '2/3/3/4',
      Violet: '4/4/1/3',
      Rouge: '2/5/2/3',
      Bleu: '5/3/2/2',
      Orange: '2/2/4/4',
      Rose: '4/3/3/2',
    });
  });

  it('les stats réelles viennent de la table de valeur d’un point : 3 points = ×1, croissantes', () => {
    for (const k of TEAM_STATS) {
      const t = STAT_POINT_VALUES[k];
      expect(t).toHaveLength(5);
      expect(t[2]).toBe(1);
      for (let i = 1; i < 5; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    }
    for (const p of TEAM_PROFILES) for (const k of TEAM_STATS) expect(p[k]).toBe(STAT_POINT_VALUES[k][p.points[k] - 1]);
    expect(TEAM_PROFILES[0].hp).toBe(1);
    expect(statValue('speed', 5)).toBe(STAT_POINT_VALUES.speed[4]);
    expect(statValue('hp', 9)).toBe(STAT_POINT_VALUES.hp[4]);
  });

  it('en partie : les PV et la vitesse des élèves suivent les points de leur couleur', () => {
    const map: MapDef = {
      id: 't',
      name: 'T',
      w: 12,
      h: 12,
      teams: 2,
      unitCap: 30,
      spawnInterval: 1000,
      startUnits: 1,
      tiles: [
        { kind: 'camp', x: 0, y: 0, owner: 0 },
        { kind: 'camp', x: 10, y: 10, owner: 1 },
      ],
    };
    const w = new World(map, 2, 1, [5, 2]); // Bleu (5 en vie) contre Jaune (4 en vitesse)
    const bleu = w.units.find((u) => u.team === 0)!;
    const jaune = w.units.find((u) => u.team === 1)!;
    expect(bleu.maxHp).toBe(Math.round(TUNING.unitHp * STAT_POINT_VALUES.hp[4]));
    expect(jaune.maxHp).toBe(Math.round(TUNING.unitHp * STAT_POINT_VALUES.hp[1]));
    expect(w.mods[1].speed).toBe(STAT_POINT_VALUES.speed[3]);
    expect(w.mods[0].speed).toBe(STAT_POINT_VALUES.speed[1]);
  });

  it('le menu affiche exactement les points de l’équipe (aucun arrondi)', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const p: Progress = { unlocked: 1, wins: {}, muted: false, lastTeam: 0, lastDifficulty: 'normal' };
    new Menu(root, p, { onPlay: () => undefined, onToggleSound: () => false, onInstallHelp: () => undefined }).show();
    const btns = root.querySelectorAll<HTMLButtonElement>('.team-btn');
    TEAM_PROFILES.forEach((prof, i) => {
      btns[i].click();
      const rows = [...root.querySelectorAll('.team-profile .stat')];
      expect(rows.map((r) => r.querySelector('span')!.textContent)).toEqual(['Vie', 'Dégâts', 'Production', 'Vitesse']);
      const lit = rows.map((r) => r.querySelectorAll('.boxes i.on').length);
      expect(lit).toEqual([prof.points.hp, prof.points.dmg, prof.points.prod, prof.points.speed]);
      expect(lit.reduce((a, b) => a + b, 0)).toBe(12);
      expect(root.querySelector('.team-blurb')!.textContent).toBe(prof.blurb);
    });
  });
});
