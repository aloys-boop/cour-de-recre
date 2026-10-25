// HUD et écran de fin du mode « Roi de la cour » : compteurs de règne (toi, le meneur et le
// tenant du trône) et temps de règne final de chaque équipe.
import './king.css';
import { TEAM_COLORS, TEAM_NAMES, TEAM_PLURALS } from '../config';
import { KING, formatReign, isKingMode, reignLeader } from '../core/king';
import { NO_TEAM } from '../core/types';
import type { World } from '../core/world';

const CROWN_SVG =
  '<svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">' +
  '<path d="M1 3l4 4 4-6 4 6 4-4-1.5 9h-13z" fill="#ffc928" stroke="#3a2a00" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<rect x="2.5" y="11" width="13" height="2" fill="#c98a00"/></svg>';

/** Compteurs de règne, affichés sous la ligne des bonus pendant une partie en mode Roi. */
export class KingHud {
  private el: HTMLElement;
  private rows: HTMLElement;
  private head: HTMLElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'king-hud hidden';
    this.el.setAttribute('role', 'status');
    this.head = document.createElement('div');
    this.head.className = 'king-head';
    this.rows = document.createElement('div');
    this.rows.className = 'king-rows';
    this.el.append(this.head, this.rows);
    (root.querySelector('.hud-top-left') ?? root).appendChild(this.el);
  }

  update(world: World, playerTeam: number): void {
    const on = isKingMode(world.rules) && !!world.king.find(world);
    this.el.classList.toggle('hidden', !on);
    if (!on) return;
    const k = world.king;
    const throne = k.throne!;
    const holder = throne.owner;
    const head = holder === NO_TEAM ? 'Trône libre' : holder === playerTeam ? 'Tu tiens le trône' : `Trône : ${TEAM_PLURALS[world.teamColors[holder]] ?? '?'}`;
    const headHtml = `${CROWN_SVG}<span>${head}${throne.contested ? ' (contesté)' : ''}</span>`;
    if (this.head.innerHTML !== headHtml) this.head.innerHTML = headHtml;
    // Lignes : toi, le meneur, le tenant (sans doublon), au plus trois.
    const teams: number[] = [playerTeam];
    for (const t of [reignLeader(world), holder]) if (t !== NO_TEAM && !teams.includes(t)) teams.push(t);
    while (this.rows.children.length < teams.length) this.rows.append(this.row());
    while (this.rows.children.length > teams.length) this.rows.lastElementChild!.remove();
    teams.forEach((t, i) => {
      const r = this.rows.children[i] as HTMLElement;
      const c = world.teamColors[t];
      const v = k.reignOf(t);
      (r.querySelector('.dot') as HTMLElement).style.background = TEAM_COLORS[c]?.ui ?? '#888';
      setText(r.querySelector('.king-name')!, t === playerTeam ? 'Toi' : TEAM_PLURALS[c] ?? '?');
      setText(r.querySelector('.king-time')!, formatReign(v));
      const fill = r.querySelector('.king-fill') as HTMLElement;
      fill.style.width = `${Math.min(100, (v / KING.winSeconds) * 100).toFixed(1)}%`;
      fill.style.background = TEAM_COLORS[c]?.ui ?? '#888';
      r.classList.toggle('holder', t === holder);
      r.classList.toggle('me', t === playerTeam);
    });
    this.el.setAttribute('aria-label', `Règne : ${teams.map((t) => `${t === playerTeam ? 'toi' : TEAM_PLURALS[world.teamColors[t]]} ${formatReign(k.reignOf(t))}`).join(', ')} sur ${formatReign(KING.winSeconds)}`);
  }

  private row(): HTMLElement {
    const r = document.createElement('div');
    r.className = 'king-row';
    r.innerHTML = '<span class="dot"></span><span class="king-name"></span><span class="king-bar"><span class="king-fill"></span></span><span class="king-time"></span>';
    return r;
  }
}

function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** Textes de l'écran de fin du mode Roi (titre, phrases) et ligne des temps de règne. */
export interface KingEnd {
  winTitle?: string;
  winText?: string;
  loseText?: string;
  block: HTMLElement;
}

/** Écran de fin d'une partie en mode Roi, ou null dans les autres modes. */
export function kingEnd(world: World, playerTeam: number): KingEnd | null {
  if (!isKingMode(world.rules) || !world.king.find(world)) return null;
  const k = world.king;
  const out: KingEnd = { block: reignBlock(world, playerTeam) };
  const w = k.winner;
  if (w === NO_TEAM) return out;
  const who = `Les ${TEAM_PLURALS[world.teamColors[w]] ?? 'Autres'}`;
  const dur = `${KING.winSeconds / 60} minutes`;
  if (w === playerTeam) {
    out.winTitle = 'Roi de la cour !';
    out.winText = `Tes élèves ont tenu le trône ${dur} : la cour est à toi !`;
  } else {
    out.winText = `${who} ont tenu le trône ${dur}.`;
    out.loseText = `${who} ont tenu le trône ${dur} : ils sont rois de la cour.`;
  }
  return out;
}

/** Ligne « Temps de règne » : chaque équipe, de la plus longue à la plus courte. */
function reignBlock(world: World, playerTeam: number): HTMLElement {
  const k = world.king;
  const box = document.createElement('div');
  box.className = 'king-end';
  const title = document.createElement('div');
  title.className = 'king-end-title';
  title.innerHTML = `${CROWN_SVG}<span>Temps de règne</span>`;
  const list = document.createElement('div');
  list.className = 'king-end-list';
  const teams = Array.from({ length: world.numTeams }, (_, t) => t).sort((a, b) => k.reignOf(b) - k.reignOf(a) || a - b);
  for (const t of teams) {
    const c = world.teamColors[t];
    const item = document.createElement('span');
    item.className = 'king-end-item' + (t === playerTeam ? ' me' : '') + (t === k.winner ? ' king' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = TEAM_COLORS[c]?.ui ?? '#888';
    item.append(dot, document.createTextNode(`${TEAM_NAMES[c] ?? '?'}${t === playerTeam ? ' (toi)' : ''} ${formatReign(k.reignOf(t))}`));
    list.append(item);
  }
  box.append(title, list);
  return box;
}
