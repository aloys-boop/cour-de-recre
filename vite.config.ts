import { defineConfig } from 'vitest/config';

// Chemins relatifs : le jeu fonctionne aussi bien à la racine d'un domaine
// que sous /<nom-du-depot>/ (GitHub Pages) ou derrière n'importe quel préfixe.
const base = process.env.BASE_PATH ?? './';

export default defineConfig({
  base,
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
