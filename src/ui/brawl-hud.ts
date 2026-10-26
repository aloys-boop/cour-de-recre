import './brawl.css';
import { TEAM_COLORS } from '../config';
import { brawlsOf, type Brawl } from '../core/brawls';
import type { Game } from '../game';

/** Nombre maximal d'alertes de bagarre hors écran affichées en même temps. */
export const MAX_ALERTS = 3;

/**
 * Bagarres du joueur hors de l'écran : une mini-barre en haut de l'écran, placée du côté de
 * la bagarre, avec une flèche dans sa direction. Un tap centre la caméra (en glissant) dessus.
 */
export class BrawlHud {
  readonly el: HTMLElement;
  readonly alerts: HTMLButtonElement[] = [];
  private targets: Array<Brawl | null> = [];

  constructor(
    root: HTMLElement,
    private getGame: () => Game | null,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'brawl-alerts';
    for (let i = 0; i < MAX_ALERTS; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'brawl-alert hidden';
      b.innerHTML =
        '<svg class="ba-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h9M8 3.5L13 8l-5 4.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="ba-bar"></span>';
      b.addEventListener('click', () => {
        const g = this.getGame();
        const t = this.targets[i];
        if (g && t) g.cam.glideTo(t.x, t.y);
      });
      this.el.appendChild(b);
      this.alerts.push(b);
      this.targets.push(null);
    }
    root.appendChild(this.el);
  }

  /** Met à jour les alertes (appelé à chaque image). */
  refresh(): void {
    const g = this.getGame();
    const list: Array<{ b: Brawl; sx: number; sy: number }> = [];
    if (g && !g.over) {
      const cam = g.cam;
      for (const b of brawlsOf(g.world, g.playerTeam)) {
        const p = cam.gridToScreen(b.x, b.y);
        const m = 20;
        if (p.x >= -m && p.x <= cam.viewW + m && p.y >= -m && p.y <= cam.viewH + m) continue;
        list.push({ b, sx: p.x, sy: p.y });
      }
      list.sort((a, b) => b.b.size - a.b.size);
    }
    this.alerts.forEach((el, i) => {
      const item = list[i];
      this.targets[i] = item?.b ?? null;
      el.classList.toggle('hidden', !item);
      if (!item || !g) return;
      const cam = g.cam;
      const x = Math.max(70, Math.min(cam.viewW - 70, item.sx));
      el.style.left = `${Math.round(x)}px`;
      const angle = Math.atan2(item.sy - 70, item.sx - x) * (180 / Math.PI);
      el.querySelector<SVGElement>('.ba-arrow')!.style.transform = `rotate(${Math.round(angle)}deg)`;
      const bar = el.querySelector<HTMLElement>('.ba-bar')!;
      const key = item.b.teams.map((t, k) => `${t}:${Math.round(item.b.shares[k] * 100)}`).join(',');
      if (bar.dataset.key !== key) {
        bar.dataset.key = key;
        bar.innerHTML = item.b.teams
          .map((t, k) => `<i style="width:${(item.b.shares[k] * 100).toFixed(1)}%;background:${TEAM_COLORS[g.world.teamColors[t]]?.ui ?? '#888'}"></i>`)
          .join('');
        const me = item.b.teams.indexOf(g.playerTeam);
        el.setAttribute('aria-label', `Bagarre hors de l’écran (tu as ${Math.round((item.b.shares[me] ?? 0) * 100)} % de la force). Toucher pour y aller`);
      }
    });
  }
}
