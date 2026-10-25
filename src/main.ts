import './style.css';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { endStats } from './core/stats';
import { medalsFor, mergeMedals } from './core/challenges';
import { LEVELS } from './core/maps';
import { encodeMapCode, mapForCode, randomSeed, type MapCode } from './core/mapcode';
import { loadProgress, recordWin, saveProgress, type Progress } from './core/save';
import { Game, type GameOptions } from './game';
import { Hud } from './ui/hud';
import { ControlsHud } from './ui/controls-hud';
import { Menu, type MenuState } from './ui/menu';
import { Overlay } from './ui/overlay';
import { TacticsHud } from './ui/tactics-hud';
import { codeBlock, medalsBlock } from './ui/share';
import { KingHud, kingEnd } from './ui/king-hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
const menuRoot = document.getElementById('menu')!;
const hudRoot = document.getElementById('hud')!;
const overlayRoot = document.getElementById('overlay')!;

let progress: Progress = loadProgress();
const sfx = new Sfx();
sfx.setMuted(progress.muted);
const music = new Music(sfx);
music.setEnabled(!progress.musicMuted);
const overlay = new Overlay(overlayRoot);
let game: Game | null = null;

function toggleSound(): boolean {
  sfx.unlock();
  progress = { ...progress, muted: !progress.muted };
  sfx.setMuted(progress.muted);
  music.refresh();
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
    diplomacy: {
      view: (team) => game?.diploView(team) ?? null,
      propose: (team) => void game?.proposeAlliance(team),
      breakOff: (team) => void game?.breakAlliance(team),
    },
  },
  progress.muted,
);
new ControlsHud(hudRoot, () => game, (text) => hud.showHint(text));
const kingHud = new KingHud(hudRoot);

// Bloc tactique : bascule Fuir / Charger.
const tactics = new TacticsHud(hudRoot, {
  onToggleCharge: () => {
    if (!game) return false;
    game.charge = !game.charge;
    hud.showHint(
      game.charge ? 'Charger : tes élèves se battent contre ce qu’ils croisent en chemin.' : 'Fuir : tes élèves courent sans riposter jusqu’à destination.',
      2400,
    );
    return game.charge;
  },
});

const menu = new Menu(menuRoot, progress, {
  onPlay: (state) => startGame(state),
  onToggleSound: toggleSound,
  onToggleMusic: () => {
    progress = { ...progress, musicMuted: !progress.musicMuted };
    saveProgress(progress);
    sfx.unlock();
    music.setEnabled(!progress.musicMuted);
    music.start();
    return !!progress.musicMuted;
  },
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
  play(code, { playerColor: state.team, difficulty: state.difficulty, rules: code.spec.kind === 'escarmouche' ? { ...state.rules } : undefined });
}

/** Lance une partie à partir d'un code de carte (type de partie + graine) : même code, même disposition. */
function play(code: MapCode, o: Pick<GameOptions, 'playerColor' | 'difficulty' | 'rules'>): void {
  const mapIndex = code.spec.kind === 'campagne' ? code.spec.level : -1;
  launch({ map: mapForCode(code), mapIndex, playerColor: o.playerColor, difficulty: o.difficulty, seed: code.seed, rules: code.spec.kind === 'escarmouche' ? o.rules : undefined }, code);
}

let tipTimer = 0;

function launch(opts: GameOptions, code: MapCode): void {
  const codeText = encodeMapCode(code);
  const campaign = code.spec.kind === 'campagne';
  game?.destroy();
  overlay.hide();
  menu.hide();
  hud.show();
  game = new Game(canvas, minimapCanvas, sfx, opts, {
    onHud: (world, selected) => (hud.update(world, selected, 0), kingHud.update(world, 0)),
    onRally: (cleared) =>
      hud.showHint(cleared ? 'Point de ralliement effacé.' : 'Point de ralliement posé : les nouveaux élèves de ce camp iront au drapeau.', 2400),
    onAnnounce: (text) => hud.showHint(text, 2600),
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
      const king = game ? kingEnd(game.world, game.playerTeam) : null;
      if (king) extras.push(king.block);
      extras.push(codeBlock(codeText, () => play(code, o)));
      const nextAvailable = win && campaign && o.mapIndex + 1 < LEVELS.length;
      // Victoire partagée : l'alliance gagne ensemble (couleurs des alliés sur l'écran de fin).
      const victors = game?.victors ?? [];
      const alliance = victors.length > 1 && game ? victors.map((t) => game!.world.teamColors[t]) : undefined;
      hud.closeDiplomacy();
      overlay.end(win, o.map.name, {
        alliance,
        nextAvailable,
        stats: game ? endStats(game.stats, game.world, game.playerTeam) : undefined,
        // Rejouer et carte suivante : nouvelle disposition tirée au sort.
        onReplay: () => play({ spec: code.spec, seed: randomSeed() }, o),
        onNext: () => play({ spec: { kind: 'campagne', level: o.mapIndex + 1 }, seed: randomSeed() }, o),
        onMenu: () => backToMenu(),
        winText: campaign ? undefined : king?.winText ?? 'L’escarmouche est à toi !',
        winTitle: king?.winTitle,
        loseText: king?.loseText,
        extras,
      });
    },
  });
  hud.update(game.world, 0, 0);
  kingHud.update(game.world, 0);
  tactics.set(game.charge);
  hud.showHint('Touche un élève puis le sol pour le déplacer (il fuit sans se battre) ; touche un ennemi pour attaquer.', 4200);
  // Puis, à partir de 3 équipes, un mot sur la diplomatie.
  clearTimeout(tipTimer);
  const g = game;
  if (opts.map.teams >= 3)
    tipTimer = window.setTimeout(() => {
      if (game === g && !g.over && !g.paused) hud.showHint('Touche la puce d’une équipe, en haut, pour lui proposer une alliance.', 3600);
    }, 4600);
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
window.addEventListener('pointerdown', () => (sfx.unlock(), music.start()), { once: false, passive: true });

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
