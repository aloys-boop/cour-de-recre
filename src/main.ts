import './style.css';
import { Sfx } from './audio/sfx';
import { generateMap, LEVELS } from './core/maps';
import { loadProgress, recordWin, saveProgress, type Progress } from './core/save';
import { Game, type GameOptions } from './game';
import { Hud } from './ui/hud';
import { ControlsHud } from './ui/controls-hud';
import { Menu, type MenuState } from './ui/menu';
import { Overlay } from './ui/overlay';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
const menuRoot = document.getElementById('menu')!;
const hudRoot = document.getElementById('hud')!;
const overlayRoot = document.getElementById('overlay')!;

let progress: Progress = loadProgress();
const sfx = new Sfx();
sfx.setMuted(progress.muted);
const overlay = new Overlay(overlayRoot);
let game: Game | null = null;

function toggleSound(): boolean {
  sfx.unlock();
  progress = { ...progress, muted: !progress.muted };
  sfx.setMuted(progress.muted);
  saveProgress(progress);
  hud.setSoundIcon(progress.muted);
  return progress.muted;
}

const hud = new Hud(
  hudRoot,
  {
    onSelectAll: () => game?.selectAll(),
    onCancel: () => game?.clearSelection(),
    onPause: () => game?.setPaused(true),
    onToggleSound: toggleSound,
  },
  progress.muted,
);
new ControlsHud(hudRoot, () => game, (text) => hud.showHint(text));

const menu = new Menu(menuRoot, progress, {
  onPlay: (state) => startGame(state),
  onToggleSound: toggleSound,
  onInstallHelp: () => overlay.installHelp(() => overlay.hide()),
});

function startGame(state: MenuState): void {
  sfx.unlock();
  progress = { ...progress, lastTeam: state.team, lastDifficulty: state.difficulty };
  saveProgress(progress);
  launch({
    map: generateMap(LEVELS[state.mapIndex], newSeed()),
    mapIndex: state.mapIndex,
    playerColor: state.team,
    difficulty: state.difficulty,
  });
}

/** Graine de carte : un tirage différent à chaque partie. */
function newSeed(): number {
  return Math.floor(Math.random() * 1e9);
}

function launch(opts: GameOptions): void {
  game?.destroy();
  overlay.hide();
  menu.hide();
  hud.show();
  game = new Game(canvas, minimapCanvas, sfx, opts, {
    onHud: (world, selected) => hud.update(world, selected, 0),
    onPauseChange: (paused) => {
      if (paused) {
        overlay.pause(
          () => {
            overlay.hide();
            game?.setPaused(false);
          },
          () => backToMenu(),
        );
      } else overlay.hide();
    },
    onEnd: (result, o) => {
      const win = result === 'victoire';
      if (win) {
        progress = recordWin(progress, o.map.id, o.mapIndex, LEVELS.length);
        saveProgress(progress);
        menu.setProgress(progress);
      }
      const nextAvailable = win && o.mapIndex + 1 < LEVELS.length;
      overlay.end(win, o.map.name, {
        nextAvailable,
        // Rejouer et carte suivante : nouvelle disposition tirée au sort.
        onReplay: () => launch({ ...o, map: generateMap(LEVELS[o.mapIndex], newSeed()) }),
        onNext: () => launch({ ...o, map: generateMap(LEVELS[o.mapIndex + 1], newSeed()), mapIndex: o.mapIndex + 1 }),
        onMenu: () => backToMenu(),
      });
    },
  });
  hud.update(game.world, 0, 0);
  hud.showHint('Touche un élève puis le sol pour le déplacer (il fuit sans se battre) ; touche un ennemi pour attaquer.', 4200);
  game.start();
}

function backToMenu(): void {
  game?.destroy();
  game = null;
  overlay.hide();
  hud.hide();
  menu.setProgress(progress);
  menu.show();
}

// ---------------------------------------------------------------- global

window.addEventListener('resize', () => game?.resize());
window.addEventListener('orientationchange', () => setTimeout(() => game?.resize(), 150));

// Pause automatique quand l'application passe en arrière-plan.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game?.setPaused(true);
});
window.addEventListener('blur', () => game?.setPaused(true));

// Safari iOS : pas de zoom de page par pincement ni par double-tap.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener(
  'touchmove',
  (e) => {
    if ((e as TouchEvent & { scale?: number }).scale !== undefined && (e as TouchEvent & { scale?: number }).scale !== 1) e.preventDefault();
  },
  { passive: false },
);

// Première interaction : déverrouillage de l'audio (exigence d'iOS).
window.addEventListener('pointerdown', () => sfx.unlock(), { once: false, passive: true });

// Service worker : jeu hors ligne et installation sur l'écran d'accueil.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}

menu.show();

/** Accès à la partie en cours (tests d'intégration). */
export function __game(): Game | null {
  return game;
}
