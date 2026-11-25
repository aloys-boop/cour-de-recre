// Garde-fou de fluidité (v5.26) : ce que vaut chaque cran, à conditions égales. La vraie application
// dans Chromium (844 × 390 ×3, doigt, processeur ralenti), Le tournoi à 240 élèves, vue d'ensemble
// puis mêlée ×2 ; chaque cran est figé (`forceQuality`) et mesuré au compteur d'images.
//   npm run build && npm run preview
//   npx tsx scripts/dev/crans.ts [ralentissement=4] [secondes=6] [adresse=http://localhost:4173/?banc]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');

const slow = Number(process.argv[2] ?? 4);
const seconds = Number(process.argv[3] ?? 6);
const url = process.argv[4] ?? 'http://localhost:4173/?banc';
const f = (x: number, d = 1) => x.toFixed(d).replace('.', ',');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await context.newPage();
await page.goto(url);
await page.waitForTimeout(800);
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
console.log(`Processeur ralenti ×${slow}, ${seconds} s par mesure`);
for (const scene of ['ensemble', 'mêlée ×2']) {
  for (const level of [0, 1, 2, 0, 1, 2]) {
    await page.evaluate(`window.__plafond(55)`);
    await page.waitForTimeout(800);
    await page.evaluate(`(() => { const g = window.__partie(); g.forceQuality(${level}); const w = g.world; g.cam.fit();
      if (${scene === 'mêlée ×2'}) { for (let t = 0; t < w.numTeams; t++) w.orderMove(w.units.filter((u) => u.team === t), { x: w.map.w / 2, y: w.map.h / 2 }, true);
        g.cam.zoom *= 2; g.cam.centerOnGrid(w.map.w / 2, w.map.h / 2); } })()`);
    await page.waitForTimeout(1000);
    await page.evaluate(`window.__partie().meter.reset()`);
    await page.waitForTimeout(seconds * 1000);
    const s = (await page.evaluate(`(() => { const g = window.__partie(); return { ...g.meter.stats(), dpr: g.pixelRatio }; })()`)) as Record<string, number>;
    console.log(`${scene.padEnd(9)} cran ${level} (×${f(s.dpr)}) ${f(s.fps)} i/s, ${f(s.droppedShare * 100)} % sautées, travail ${f(s.work, 2)} ms (dessin ${f(s.render, 2)}), 95e ${f(s.workP95, 2)}`);
  }
}
await browser.close();
