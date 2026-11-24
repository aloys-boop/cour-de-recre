// Banc du dessin (v5.25) : la vraie application dans Chromium (844 × 390 ×3), Le tournoi figé
// (pause) à 240 élèves, vue d'ensemble puis zoom ×2. On redessine la même image N fois :
// « appel » = temps passé dans le code de dessin, « avec tracé » = en forçant Chromium à peindre
// (lecture d'un pixel). Moins bruité que perf-iphone.ts pour comparer deux versions du dessin.
//   npm run build && npm run preview
//   npx tsx scripts/dev/banc-dessin.ts [adresse] [images=120]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');

const url = process.argv[2] ?? 'http://localhost:4173/?banc';
const N = Number(process.argv[3] ?? 120);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await context.newPage();
await page.goto(url);
await page.waitForTimeout(800);
await page.evaluate(() => (window as unknown as { __plafond: (s: number) => unknown }).__plafond(55));
await page.waitForTimeout(2500);
// Code passé en texte : tsx ajoute des aides (« __name ») absentes de la page.
const res = (await page.evaluate(`(() => {
  const n = ${N};
  const g = window.__partie();
  g.paused = true;
  const cv = document.querySelector('canvas');
  const ctx = cv.getContext('2d');
  function run(flush) {
    for (let i = 0; i < 10; i++) g.render();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      g.render();
      if (flush) ctx.getImageData(0, 0, 1, 1);
    }
    return (performance.now() - t0) / n;
  }
  // Appels au canvas par image (indépendant de la machine) : on compte chaque méthode du contexte.
  const proto = CanvasRenderingContext2D.prototype;
  const counts = {};
  let counting = false;
  for (const k of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, k);
    if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
    const f = d.value;
    proto[k] = function (...a) { if (counting) counts[k] = (counts[k] || 0) + 1; return f.apply(this, a); };
  }
  function calls() {
    g.render();
    for (const k in counts) delete counts[k];
    counting = true;
    g.render();
    counting = false;
    let total = 0;
    let paint = 0;
    for (const k in counts) {
      total += counts[k];
      if (['fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'drawImage', 'fillText', 'strokeText'].includes(k)) paint += counts[k];
    }
    return total + ' (dont ' + paint + ' tracés)';
  }
  const out = { units: g.world.units.length };
  for (const patterns of [false, true]) {
    const m = patterns ? ' motifs' : '';
    g.setPatterns(patterns);
    g.cam.fit();
    out['ensemble' + m + ' appel'] = run(false);
    out['ensemble' + m + ' appels canvas'] = calls();
    out['ensemble' + m + ' dont'] = JSON.stringify(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6));
    out['ensemble' + m + ' avec tracé'] = run(true);
    g.cam.zoom *= 2;
    g.cam.centerOnGrid(g.world.map.w / 2, g.world.map.h / 2);
    out['zoom ×2' + m + ' appel'] = run(false);
  }
  return out;
})()`)) as Record<string, number | string>;
for (const [k, v] of Object.entries(res)) console.log(`${k.padEnd(26)} ${typeof v === 'string' || k === 'units' || k.includes('canvas') ? v : v.toFixed(2) + ' ms'}`);
await browser.close();
