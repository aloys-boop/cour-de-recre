import { TEAM_COLORS, TEAM_NAMES } from '../config';
import type { World } from '../core/world';

export interface HudHooks {
  onSelectAll(): void;
  onCancel(): void;
  onPause(): void;
  onToggleSound(): boolean;
}

/** Barre de jeu : compteurs par équipe, boutons de sélection, pause et son. */
export class Hud {
  private chips: HTMLElement;
  private selCount: HTMLElement;
  private btnSound: HTMLButtonElement;
  private hint: HTMLElement;
  private hintTimer = 0;

  constructor(
    private root: HTMLElement,
    hooks: HudHooks,
    muted: boolean,
  ) {
    this.chips = root.querySelector('#team-chips')!;
    this.selCount = root.querySelector('#sel-count')!;
    this.hint = root.querySelector('#hint')!;
    this.btnSound = root.querySelector('#btn-sound')!;
    const btnPause = root.querySelector<HTMLButtonElement>('#btn-pause')!;
    const btnAll = root.querySelector<HTMLButtonElement>('#btn-select-all')!;
    const btnCancel = root.querySelector<HTMLButtonElement>('#btn-cancel')!;
    btnPause.innerHTML = pauseIcon();
    this.setSoundIcon(muted);
    btnAll.addEventListener('click', hooks.onSelectAll);
    btnCancel.addEventListener('click', hooks.onCancel);
    btnPause.addEventListener('click', hooks.onPause);
    this.btnSound.addEventListener('click', () => this.setSoundIcon(hooks.onToggleSound()));
  }

  show(): void {
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  setSoundIcon(muted: boolean): void {
    this.btnSound.innerHTML = soundIcon(muted);
    this.btnSound.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son');
  }

  update(world: World, selected: number, playerTeam: number): void {
    const stats = world.stats();
    const parts: string[] = [];
    for (let t = 0; t < world.numTeams; t++) {
      const c = world.teamColors[t];
      const s = stats[t];
      parts.push(
        `<span class="chip${t === playerTeam ? ' me' : ''}${s.alive ? '' : ' dead'}">` +
          `<span class="dot" style="background:${TEAM_COLORS[c].ui}"></span>` +
          `${TEAM_NAMES[c]} ${s.units} · ${s.tiles}/${world.tiles.length}</span>`,
      );
    }
    this.chips.innerHTML = parts.join('');
    this.selCount.textContent = selected > 0 ? `${selected} sélectionné${selected > 1 ? 's' : ''}` : '';
  }

  showHint(text: string, ms = 2600): void {
    this.hint.textContent = text;
    this.hint.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hint.classList.add('hidden'), ms);
  }
}

function pauseIcon(): string {
  return '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="2" width="4.5" height="14" rx="1" fill="#fff"/><rect x="10.5" y="2" width="4.5" height="14" rx="1" fill="#fff"/></svg>';
}

function soundIcon(muted: boolean): string {
  const speaker = '<path d="M2 7h3l4-3.5v11L5 11H2z" fill="#fff"/>';
  const waves = muted
    ? '<path d="M12 6l4 6M16 6l-4 6" stroke="#ff6a4a" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M11.5 6.5a3.5 3.5 0 010 5M13.5 4.5a6 6 0 010 9" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>';
  return `<svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true">${speaker}${waves}</svg>`;
}
