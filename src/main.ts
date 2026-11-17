import './style.css';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { endStats } from './core/stats';
import { medalsFor, mergeMedals } from './core/challenges';
import { LEVELS } from './core/maps';
import { encodeMapCode, randomSeed, type MapCode } from './core/mapcode';
import { mapWithRules } from './core/ghosts';
import { loadProgress, recordWin, saveProgress, type Progress } from './core/save';
import { Game, type GameOptions } from './game';
import { Hud } from './ui/hud';
import { ControlsHud } from './ui/controls-hud';
import { DiplomacyExtrasHud } from './ui/diplomacy-extras';
import { Menu, type MenuState } from './ui/menu';
import { Overlay } from './ui/overlay';
import { TacticsHud } from './ui/tactics-hud';
import { shakeBlock, TempoHud, tempoBlock } from './ui/tempo-hud';
import { tempoAllowed } from './core/tempo';
import { codeBlock, medalsBlock } from './ui/share';
import { KingHud, kingEnd } from './ui/king-hud';
import { CampPanel } from './ui/camp-panel';
import { ClassSection } from './ui/class-section';
import { PionSection } from './ui/pion-section';
import { RallySection } from './ui/rally-section';
import { ReinforceSection } from './ui/reinforce-section';
import { PowersHud } from './ui/powers-hud';
import { TutorialUi } from './ui/tutorial-ui';
import { AlertBanner } from './ui/alert-banner';
import { BrawlHud } from './ui/brawl-hud';
import { SpectateHud } from './ui/spectate-hud';
import { TUTORIAL_MAP } from './core/tutorial';

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
    onCountsOpen: () => sfx.play('select'),
    diplomacy: {
      view: (team) => game?.diploView(team) ?? null,
      propose: (team) => void game?.proposeAlliance(team),
      breakOff: (team) => void game?.breakAlliance(team),
    },
  },
  progress.muted,
);
new ControlsHud(hudRoot, () => game, (text) => hud.showHint(text));
new DiplomacyExtrasHud(hudRoot, () => game, hud, (text, ms) => hud.showHint(text, ms));
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

// Rythme (v5.14) : bouton de pause tactique, en Facile et Normal.
const tempoHud = new TempoHud(hudRoot, {
  onToggle: () => {
    if (!game) return false;
    const on = game.toggleTactical();
    if (on && game.tactical.count === 1) hud.showHint('Pause tactique : la cour est figée. Sélectionne, donne tes ordres, achète, puis touche ▶ pour reprendre.', 4200);
    return on;
  },
});

// Bons points (pastille) et panneau d'amélioration des camps.
const campPanel = new CampPanel(hudRoot, () => game, (text, ms) => hud.showHint(text, ms));
campPanel.addSection(new ClassSection((text, ms) => hud.showHint(text, ms)));
campPanel.addSection(new PionSection((text, ms) => hud.showHint(text, ms)));
campPanel.addSection(new RallySection((text, ms) => hud.showHint(text, ms)));
campPanel.addSection(new ReinforceSection((text, ms) => hud.showHint(text, ms)));
const powersHud = new PowersHud(hudRoot, () => game, (text, ms) => hud.showHint(text, ms));
const tutorialUi = new TutorialUi(hudRoot, () => skipTutorial());
const brawlHud = new BrawlHud(hudRoot, () => game);
const alertBanner = new AlertBanner(hudRoot, (a) => game?.goToAlert(a));
// Mode Équipes, suite (v5.16) : bandeau du spectateur quand on est éliminé.
const spectateHud = new SpectateHud(hudRoot, {
  onWatch: () => {
    const t = game?.watchTeammate() ?? -1;
    return t >= 0 && game ? game.world.teamColors[t] : -1;
  },
  onFast: () => game?.toggleSpectateFast() ?? false,
  onLeave: () => void game?.leaveSpectating(),
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
  onHowTo: () => overlay.howTo(() => overlay.hide()),
});

function startGame(state: MenuState): void {
  sfx.unlock();
  progress = { ...progress, lastTeam: state.team, lastDifficulty: state.difficulty };
  saveProgress(progress);
  if (state.mode === 'campagne' && state.tutorial && !state.code) return startTutorial();
  const code: MapCode = state.code ?? {
    spec: state.mode === 'escarmouche' ? { kind: 'escarmouche', ...state.skirmish } : { kind: 'campagne', level: state.mapIndex },
    seed: randomSeed(),
  };
  play(code, { playerColor: state.team, difficulty: state.difficulty, rules: code.spec.kind === 'escarmouche' ? { ...state.rules } : undefined });
}

/** Lance une partie à partir d'un code de carte (type de partie + graine) : même code, même disposition. */
function play(code: MapCode, o: Pick<GameOptions, 'playerColor' | 'difficulty' | 'rules'>): void {
  const mapIndex = code.spec.kind === 'campagne' ? code.spec.level : -1;
  launch({ map: mapWithRules(code, o.rules), mapIndex, playerColor: o.playerColor, difficulty: o.difficulty, seed: code.seed, rules: code.spec.kind === 'escarmouche' ? o.rules : undefined }, code);
}

/** Lance le tutoriel (carte fixe, IA passive, étapes guidées). */
function startTutorial(): void {
  sfx.unlock();
  progress = { ...progress, tutorialSeen: true };
  saveProgress(progress);
  launch({ map: TUTORIAL_MAP, mapIndex: -1, playerColor: progress.lastTeam, difficulty: 'facile', seed: 1, tutorial: true }, null);
}

/** « Passer » : fin du tutoriel, retour au menu. */
function skipTutorial(): void {
  if (!game?.tutorial) return;
  game.tutorial.skip();
  backToMenu();
}

let tipTimer = 0;

// Banc d'essai des contrôles visuels (Playwright) : « ?banc » dans l'adresse expose la partie en cours.
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('banc')) {
  (window as unknown as { __partie: () => Game | null }).__partie = () => game;
}

function launch(opts: GameOptions, code: MapCode | null): void {
  const codeText = code ? encodeMapCode(code) : '';
  const campaign = code?.spec.kind === 'campagne';
  const tutorial = !!opts.tutorial;
  game?.destroy();
  overlay.hide();
  menu.hide();
  hud.show();
  opts = { ...opts, speed: progress.speed ?? 'normale', shake: progress.shake !== false };
  // Musique (v5.18) : thème « Bagarre », qui s'intensifie avec la partie.
  music.setIntensity(0);
  music.setTheme('partie');
  game = new Game(canvas, minimapCanvas, sfx, opts, {
    onHud: (world, selected) => (hud.update(world, selected, 0), kingHud.update(world, 0), campPanel.refresh(), powersHud.refresh()),
    onCampTap: (camp) => campPanel.open(camp),
    onFrame: () => (tutorialUi.refresh(), brawlHud.refresh(), music.setIntensity(game?.mood.level ?? 0)),
    onTutorial: (ev) => {
      if (ev.kind === 'step') {
        sfx.play('upgrade');
        // Le panneau du camp se referme une fois l'amélioration faite.
        if (game?.tutorial?.step.id === 'powerHelp') campPanel.close();
      }
    },
    onRally: (cleared) => {
      hud.showHint(cleared ? 'Point de ralliement effacé.' : 'Point de ralliement posé : les nouveaux élèves de ce camp iront au drapeau.', 2400);
      campPanel.refresh();
    },
    onAnnounce: (text) => hud.showHint(text, 2600),
    onHint: (text) => hud.showHint(text, 2800),
    onAlert: (a) => alertBanner.show(a),
    onTactical: (on) => tempoHud.set(on),
    onSpectate: () => {
      if (!game) return;
      campPanel.close();
      alertBanner.hide();
      const f = game.watchTeammate(false);
      spectateHud.show(f >= 0 ? game.world.teamColors[f] : -1);
      hud.showHint('Tu es KO, mais ton équipe tient ! Si elle gagne, tu gagnes avec elle.', 4200);
    },
    onPauseChange: (paused) => {
      if (paused) {
        hud.closeDiplomacy(); // le panneau ne doit pas recouvrir la pause
        hud.closeCounts();
        alertBanner.hide();

        const showPause = (): void =>
          overlay.pause(
            () => {
              overlay.hide();
              game?.setPaused(false);
            },
            () => backToMenu(),
            [...(tutorial ? [] : [rhythmBlock(opts)]), sensationsBlock(), ...(code ? [codeBlock(codeText)] : [])],
            () => overlay.howTo(showPause),
            tutorial ? undefined : () => game?.surrender(),
          );
        showPause();
      } else overlay.hide();
    },
    onEnd: (result, o) => {
      alertBanner.hide();
      const spectated = spectateHud.visible;
      spectateHud.hide();
      const win = result === 'victoire';
      music.setTheme(win ? 'victoire' : 'defaite');
      const surrendered = result === 'abandon';
      const extras: HTMLElement[] = [];
      tutorialUi.hide();
      if (tutorial) {
        if (win) {
          progress = { ...progress, tutorialSeen: true, tutorialDone: true };
          saveProgress(progress);
          menu.setProgress(progress);
        }
        hud.closeDiplomacy();
        hud.closeCounts();
        overlay.end(win, o.map.name, {
          nextAvailable: false,
          stats: game ? endStats(game.stats, game.world, game.playerTeam, game.tactical.count) : undefined,
          onReplay: () => startTutorial(),
          onNext: () => undefined,
          onMenu: () => backToMenu(),
          winTitle: 'Tutoriel réussi !',
          winText: 'Bravo, tu connais les bases. La campagne t’attend !',
          loseText: 'Pas grave : rejoue le tutoriel pour réessayer.',
        });
        return;
      }
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
      if (code) extras.push(codeBlock(codeText, () => play(code, o)));
      const nextAvailable = win && campaign && o.mapIndex + 1 < LEVELS.length;
      // Victoire partagée : l'alliance gagne ensemble (couleurs des alliés sur l'écran de fin).
      const victors = game?.victors ?? [];
      const alliance = victors.length > 1 && game ? victors.map((t) => game!.world.teamColors[t]) : undefined;
      hud.closeDiplomacy();
      hud.closeCounts();
      overlay.end(win, o.map.name, {
        alliance,
        nextAvailable,
        stats: game ? endStats(game.stats, game.world, game.playerTeam, game.tactical.count) : undefined,
        // Rejouer et carte suivante : nouvelle disposition tirée au sort.
        onReplay: () => (code ? play({ spec: code.spec, seed: randomSeed() }, o) : backToMenu()),
        onNext: () => play({ spec: { kind: 'campagne', level: o.mapIndex + 1 }, seed: randomSeed() }, o),
        onMenu: () => backToMenu(),
        winText: game?.sharedWin ? 'Tu étais KO, mais tes coéquipiers ont tenu jusqu’au bout. Bravo à toute l’équipe !' : campaign ? undefined : king?.winText ?? 'L’escarmouche est à toi !',
        winTitle: game?.sharedWin ? 'Victoire de l’équipe !' : king?.winTitle,
        loseText: surrendered
          ? 'Tu as abandonné la partie. Voici où en était la cour.'
          : spectated
            ? game?.leftSpectating
              ? 'Tu as quitté la partie avant la fin. Voici où en était la cour.'
              : 'Tes coéquipiers sont tombés à leur tour. Revanche ?'
            : king?.loseText,
        loseTitle: surrendered ? 'Abandon' : undefined,
        extras,
      });
    },
  });
  campPanel.close();
  spectateHud.hide();
  hud.update(game.world, 0, 0);
  kingHud.update(game.world, 0);
  campPanel.refresh();
  tactics.set(game.charge);
  tempoHud.set(false);
  tempoHud.setAvailable(tempoAllowed(opts.difficulty, tutorial) && progress.tacticalPause !== false);
  if (tutorial) tutorialUi.show(game);
  else {
    tutorialUi.hide();
    hud.showHint('Touche un élève puis le sol pour le déplacer (il fuit sans se battre) ; touche un ennemi pour attaquer.', 4200);
  }
  // Puis, à partir de 3 équipes, un mot sur la diplomatie.
  clearTimeout(tipTimer);
  const g = game;
  if (opts.map.teams >= 3 && !tutorial)
    tipTimer = window.setTimeout(() => {
      if (game !== g || g.over || g.paused) return;
      // Mode « Équipes » : pas de diplomatie, on présente plutôt les coéquipiers.
      if (g.teamGroups) hud.showHint('Mode Équipes\u00a0: les puces à poignée de main, en haut, sont tes coéquipiers. Vous gagnez ensemble.', 3800);
      else hud.showHint('Touche la puce d’une équipe, en haut, pour lui proposer une alliance.', 3600);
    }, 4600);
  game.start();
}

/** Bloc « Rythme » du menu pause : vitesse et bouton de pause tactique, mémorisés. */
function rhythmBlock(opts: GameOptions): HTMLElement {
  return tempoBlock(
    { allowed: tempoAllowed(opts.difficulty, !!opts.tutorial), speed: progress.speed ?? 'normale', tacticalButton: progress.tacticalPause !== false },
    (speed) => {
      progress = { ...progress, speed };
      saveProgress(progress);
      game?.setSpeed(speed);
      sfx.play('select');
    },
    (on) => {
      progress = { ...progress, tacticalPause: on };
      saveProgress(progress);
      tempoHud.setAvailable(on && !!game && game.tactical.allowed);
      sfx.play('select');
    },
  );
}

/** Bloc « Sensations » du menu pause (v5.17) : tremblement de la caméra et musique (v5.18), mémorisés. */
function sensationsBlock(): HTMLElement {
  return shakeBlock(
    progress.shake !== false,
    (on) => {
      progress = { ...progress, shake: on };
      saveProgress(progress);
      game?.setShake(on);
      sfx.play('select');
      if (on) navigator.vibrate?.(12);
    },
    {
      on: !progress.musicMuted,
      onPick: (on) => {
        progress = { ...progress, musicMuted: !on };
        saveProgress(progress);
        menu.setProgress(progress);
        music.setEnabled(on);
        music.start();
        sfx.play('select');
      },
    },
  );
}

function backToMenu(): void {
  music.setTheme('menu');
  tempoHud.set(false);
  spectateHud.hide();
  alertBanner.hide();
  campPanel.close();
  tutorialUi.hide();
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

// Premier lancement : on propose le tutoriel (une seule fois ; il reste dans le menu).
if (!progress.tutorialSeen) {
  overlay.welcome(
    () => startTutorial(),
    () => {
      progress = { ...progress, tutorialSeen: true };
      saveProgress(progress);
      overlay.hide();
    },
  );
}

/** Accès à la partie en cours (tests d'intégration). */
export function __game(): Game | null {
  return game;
}

/** Accès à la musique (tests d'intégration). */
export function __music(): Music {
  return music;
}
