// Fluidité en conditions iPhone simulées (v5.24) : la vraie application, dans Chromium, à
// 844 × 390 points (iPhone en paysage), écran ×3, doigt, processeur ralenti (×4 par défaut),
// Le tournoi à 8 équipes × 30 élèves, IA Expert. Mesure lue sur le compteur d'images du jeu
// (`core/frame-meter.ts`) : images par seconde, images sautées, travail par image.
//   npm run build && npm run preview   (dans un autre terminal, port 4173)
//   npx tsx scripts/dev/perf-iphone.ts [ralentissement=4] [secondes=8] [adresse]
// v5.26 : le garde-fou de fluidité est actif comme chez le joueur (cran affiché en fin de ligne) ;
// GARDE=0 devant la commande le coupe, pour comparer.
// Le dessin de Chromium sans carte graphique (SwiftShader) est bien plus lent que celui d'un
// iPhone : les chiffres sont un plafond pessimiste, à comparer d'une version à l'autre.
import { createRequire } from 'node:module';
// Playwright est installé hors du projet (outil de la machine, pas une dépendance du jeu).
const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');

const slow = Number(process.argv[2] ?? 4);
const seconds = Number(process.argv[3] ?? 8);
const url = process.argv[4] ?? 'http://localhost:4173/cour-de-recre/?banc';

interface Stats {
  frames: number;
  fps: number;
  dropped: number;
  droppedShare: number;
  work: number;
  sim: number;
  render: number;
  workP95: number;
  workWorst: number;
  units: number;
  level: number;
  dpr: number;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForTimeout(800);
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });

type Scenario = { name: string; setup: string };
const scenarios: Scenario[] = [
  // Partie qui tourne, vue d'ensemble : toute la cour et ses 240 élèves à l'écran.
  { name: 'ensemble', setup: `g.cam.fit();` },
  // Mêlée générale au centre, zoom ×2 : beaucoup d'effets, d'onomatopées et de barres de bagarre.
  {
    name: 'mêlée ×2',
    setup: `const w = g.world; for (let t = 0; t < w.numTeams; t++) w.orderMove(w.units.filter((u) => u.team === t), { x: w.map.w / 2, y: w.map.h / 2 }, true);
            g.cam.fit(); g.cam.zoom *= 2; g.cam.centerOnGrid(w.map.w / 2, w.map.h / 2);`,
  },
  // Même chose avec les motifs d'équipe (liserés et emblèmes en plus).
  { name: 'mêlée motifs', setup: `g.setPatterns(true);` },
];

const results: Array<[string, Stats]> = [];
for (const [i, sc] of scenarios.entries()) {
  if (i === 0) {
    await page.evaluate(() => {
      const w = window as unknown as { __plafond: (seed?: number) => unknown };
      w.__plafond(55);
    });
    if (process.env.GARDE === '0') await page.evaluate('window.__partie().setAutoQuality(false)');
    await page.waitForTimeout(1500);
  }
  await page.evaluate(sc.setup.length ? `(() => { const g = window.__partie(); ${sc.setup} })()` : '0');
  await page.waitForTimeout(1000);
  await page.evaluate(() => (window as unknown as { __partie: () => { meter: { reset(): void } } }).__partie().meter.reset());
  await page.waitForTimeout(seconds * 1000);
  const s = await page.evaluate(() => {
    const g = (window as unknown as { __partie: () => { meter: { stats(): object }; world: { units: unknown[] }; qualityLevel: number; pixelRatio: number } }).__partie();
    return { ...g.meter.stats(), units: g.world.units.length, level: g.qualityLevel, dpr: g.pixelRatio } as Stats;
  });
  results.push([sc.name, s]);
}

const f = (x: number, d = 1) => x.toFixed(d).replace('.', ',');
console.log(`Processeur ralenti ×${slow}, ${seconds} s par scénario, 844 × 390 ×3 (canvas ×2)`);
for (const [name, s] of results) {
  console.log(
    `${name.padEnd(13)} ${f(s.fps)} i/s, ${f(s.droppedShare * 100)} % d'images sautées, travail ${f(s.work, 2)} ms ` +
      `(simulation ${f(s.sim, 2)}, dessin ${f(s.render, 2)}), 95e centile ${f(s.workP95, 2)}, pire ${f(s.workWorst, 2)}, ${s.units} élèves, cran ${s.level} (canvas ×${f(s.dpr)})`,
  );
}
if (errors.length) console.log('Erreurs :', errors.join(' | '));
await browser.close();
