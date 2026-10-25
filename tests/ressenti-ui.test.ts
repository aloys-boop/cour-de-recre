// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Music } from '../src/audio/music';
import { Sfx } from '../src/audio/sfx';
import type { EndStats } from '../src/core/stats';
import { Overlay } from '../src/ui/overlay';

describe('écran de fin', () => {
  it('affiche le tableau des statistiques avant les boutons, joueur en évidence', () => {
    const root = document.createElement('div');
    const overlay = new Overlay(root);
    const stats: EndStats = {
      duration: 125,
      rows: [
        { team: 0, color: 3, isPlayer: true, produced: 12, koDealt: 9, koTaken: 4, captured: 6 },
        { team: 1, color: 0, isPlayer: false, produced: 8, koDealt: 4, koTaken: 9, captured: 2 },
      ],
    };
    overlay.end(true, 'Le Préau', { nextAvailable: true, onReplay: () => {}, onNext: () => {}, onMenu: () => {}, stats });
    const card = root.querySelector('.card')!;
    const table = card.querySelector('.end-stats table')!;
    expect(table.querySelectorAll('tr').length).toBe(3);
    const me = table.querySelector('tr.me')!;
    expect(me.textContent).toContain('Violet (toi)');
    expect([...me.querySelectorAll('td')].slice(1).map((td) => td.textContent)).toEqual(['12', '9', '4', '6']);
    expect(card.querySelector('.end-duration')!.textContent).toBe('Durée de la partie : 2 min 05 s');
    // Le tableau précède la rangée de boutons.
    const children = [...card.children];
    expect(children.indexOf(card.querySelector('.end-stats')!)).toBeLessThan(children.indexOf(card.querySelector('.row')!));
  });

  it('reste valide sans statistiques', () => {
    const root = document.createElement('div');
    new Overlay(root).end(false, 'X', { nextAvailable: false, onReplay: () => {}, onNext: () => {}, onMenu: () => {} });
    expect(root.querySelector('.end-stats')).toBeNull();
  });
});

describe('audio sans AudioContext', () => {
  it('la musique et les sons ne plantent pas et ne démarrent pas', () => {
    const sfx = new Sfx();
    sfx.unlock();
    const music = new Music(sfx);
    music.start();
    music.setEnabled(false);
    music.setEnabled(true);
    sfx.play('ko', 2);
    expect(music.isPlaying).toBe(false);
  });
});
