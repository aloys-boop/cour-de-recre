import './style.css';
import { Sfx } from './audio/sfx';
import { medalsFor, mergeMedals } from './core/challenges';
import { LEVELS } from './core/maps';
import { encodeMapCode, mapForCode, randomSeed, type MapCode } from './core/mapcode';
import { loadProgress, recordWin, saveProgress, type Progress } from './core/save';
import { Game, type GameOptions } from './game';
import { Hud } from './ui/hud';
import { Menu, type MenuState } from './ui/menu';
import { Overlay } from './ui/overlay';
import { codeBlock, medalsBlock } from './ui/share';

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

const menu = new Menu(menuRoot, progress, {
  onPlay: (state) => startGame(state),
  onToggleSound: toggleSound,
  onInstallHelp: () => overlay.installHelp(() => overlay.hide()),
});

function startGame(state: MenuState): void {
  sfx.unlock();
  progress = { ...progress, lastTeam: state.team, lastDifficulty: state.difficulty };
  saveProgress(progress);
  const code: MapCode = state.code ?? {
    spec: state.mode === 'escarmouche' ? { kind: 'escarmouche', ...state.skirmish } : { kind: 'campagne', level: state.mapIndex },
    seed: randomSeed(),
  };
  play(code, { playerColor: state.team, difficulty: state.difficulty });
}

/** Lance une partie à partir d'un code de carte (type de partie + graine) : même code, même disposition. */
function play(code: MapCode, o: Pick<GameOptions, 'playerColor' | 'difficulty'>): void {
  const mapIndex = code.spec.kind === 'campagne' ? code.spec.level : -1;
  launch({ map: mapForCode(code), mapIndex, playerColor: o.playerColor, difficulty: o.difficulty, seed: code.seed }, code);
}

function launch(opts: GameOptions, code: MapCode): void {
  const codeText = encodeMapCode(code);
  const campaign = code.spec.kind === 'campagne';
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
          [codeBlock(codeText)],
        );
      } else overlay.hide();
    },
    onEnd: (result, o) => {
      const win = result === 'victoire';
      const extras: HTMLElement[] = [];
      // Les victoires d'escarmouche ne débloquent pas la campagne et ne donnent pas de médailles.
      if (win && campaign) {
        progress = recordWin(progress, o.map.id, o.mapIndex, LEVELS.length);
        const earned = medalsFor({ win, homeCampLost: game?.homeCampLost ?? true, seconds: game?.world.time ?? Infinity });
        const merged = mergeMedals(progress.medals, o.map.id, earned);
        progress = { ...progress, medals: merged.medals };
        extras.push(medalsBlock(earned, merged.fresh));
        saveProgress(progress);
        menu.setProgress(progress);
      }
      extras.push(codeBlock(codeText, () => play(code, o)));
      const nextAvailable = win && campaign && o.mapIndex + 1 < LEVELS.length;
      overlay.end(win, o.map.name, {
        nextAvailable,
        // Rejouer et carte suivante : nouvelle disposition tirée au sort.
        onReplay: () => play({ spec: code.spec, seed: randomSeed() }, o),
        onNext: () => play({ spec: { kind: 'campagne', level: o.mapIndex + 1 }, seed: randomSeed() }, o),
        onMenu: () => backToMenu(),
        winText: campaign ? undefined : 'L’escarmouche est à toi !',
        extras,
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
