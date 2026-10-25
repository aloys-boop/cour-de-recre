import { MEDAL_IDS, MEDAL_INFO, type MedalId, type MedalSet } from '../core/challenges';

/**
 * Petits blocs d'interface partagés par les fenêtres de pause et de fin :
 * code de carte avec bouton « Copier », médailles obtenues.
 */

/** Copie un texte dans le presse-papiers ; repli sur execCommand pour les navigateurs anciens. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refusé : on tente le repli */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.top = '0';
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}

/** Bloc « Code de carte » : le code, un bouton « Copier » et, en option, un bouton pour rejouer la même carte. */
export function codeBlock(code: string, onReplaySame?: () => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'code-box';
  const label = document.createElement('span');
  label.className = 'code-label';
  label.textContent = 'Code de carte';
  const value = document.createElement('span');
  value.className = 'code-value';
  value.textContent = code;
  const copy = document.createElement('button');
  copy.className = 'btn btn-secondary btn-small';
  copy.textContent = 'Copier';
  copy.addEventListener('click', async () => {
    const ok = await copyText(code);
    copy.textContent = ok ? 'Copié !' : 'Note le code';
    if (!ok) {
      // Dernier recours : on sélectionne le code pour une copie manuelle.
      const sel = window.getSelection?.();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(value);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    setTimeout(() => (copy.textContent = 'Copier'), 1800);
  });
  box.append(label, value, copy);
  if (onReplaySame) {
    const again = document.createElement('button');
    again.className = 'btn btn-secondary btn-small';
    again.textContent = 'Rejouer cette carte';
    again.addEventListener('click', onReplaySame);
    box.append(again);
  }
  return box;
}

/** Médailles d'une partie de campagne : obtenues ce coup-ci, nouvelles ou manquées. */
export function medalsBlock(earned: MedalSet, fresh: readonly MedalId[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'medal-box';
  for (const id of MEDAL_IDS) {
    const info = MEDAL_INFO[id];
    const m = document.createElement('div');
    m.className = 'medal' + (earned[id] ? ' on' : '') + (fresh.includes(id) ? ' fresh' : '');
    m.title = info.hint;
    const icon = document.createElement('span');
    icon.className = 'medal-icon';
    icon.textContent = info.glyph;
    const txt = document.createElement('span');
    txt.className = 'medal-text';
    txt.textContent = fresh.includes(id) ? `${info.label} (nouvelle)` : info.label;
    m.append(icon, txt);
    box.append(m);
  }
  return box;
}

/** Trois pastilles compactes pour la liste des cartes du menu. */
export function medalDots(set: MedalSet | undefined): HTMLElement {
  const box = document.createElement('span');
  box.className = 'medal-dots';
  const got = MEDAL_IDS.filter((id) => set?.[id]).length;
  box.setAttribute('aria-label', `${got} médaille${got > 1 ? 's' : ''} sur 3`);
  for (const id of MEDAL_IDS) {
    const d = document.createElement('i');
    d.className = set?.[id] ? 'on' : '';
    d.textContent = MEDAL_INFO[id].glyph;
    d.title = `${MEDAL_INFO[id].label} : ${MEDAL_INFO[id].hint.toLowerCase()}`;
    box.append(d);
  }
  return box;
}
