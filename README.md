# Cour de Récré

Jeu de stratégie en temps réel isométrique, jouable au doigt sur iPhone (Safari) et installable comme application hors ligne. Remake personnel et non commercial, inspiré dans l'esprit d'un jeu Flash des années 2000 : tous les graphismes, sons et le nom sont originaux et générés par le code.

Quatre équipes d'élèves en uniforme (Noir, Vert, Jaune, Violet) se disputent les cases d'une cour de récréation. Tu diriges l'une d'elles, les trois autres sont contrôlées par l'ordinateur.

## Règles du jeu

- **Les cases.** La cour est parsemée de cases blanches marquées d'un symbole de carte (pique, cœur, carreau, trèfle). Une case prend la couleur de l'équipe qui la contrôle.
- **Capturer.** Des élèves d'une seule équipe doivent rester sur une case pendant environ 3 secondes (jauge visible sous le symbole). Plus ils sont nombreux, plus c'est rapide (jusqu'à 2 fois). Si une autre équipe tient déjà une jauge, il faut d'abord la vider. Une case occupée par plusieurs équipes est **contestée** (pointillés rouges) : rien ne bouge tant que le combat n'est pas tranché.
- **Renforts.** Chaque case possédée fait apparaître régulièrement un nouvel élève de son équipe, dans la limite d'un plafond par équipe (18 à 30 selon la carte).
- **Combat.** Les élèves se battent à coups de poing au corps à corps. Un élève inoccupé engage de lui-même les ennemis qui s'approchent. À zéro point de vie, il s'assoit, KO, puis disparaît.
- **Victoire.** Une équipe gagne quand elle contrôle toutes les cases ou qu'elle est la dernière à avoir encore des élèves ou des cases. Tu perds dès que tu n'as plus ni élèves ni cases.
- **Progression.** Cinq cartes de taille croissante (du Préau au Campus). Chaque victoire débloque la suivante ; la progression est sauvegardée sur l'appareil.
- **Difficulté.** Facile, Normal ou Difficile : les IA réagissent plus vite, attaquent avec de plus petits groupes, gardent moins de défenseurs et frappent plus fort.

## Contrôles tactiles

| Geste | Effet |
| --- | --- |
| Tap sur un élève | Sélectionne l'élève et ses voisins proches |
| Appui long puis glisser | Rectangle de sélection |
| Tap sur le sol | Ordre de déplacement (marqueur blanc) |
| Tap sur un ennemi | Ordre d'attaque (marqueur rouge) |
| Glisser à un doigt | Déplacer la caméra |
| Pincer / glisser à deux doigts | Zoom et caméra |
| Tap sur la mini-carte | Centrer la vue à cet endroit |
| Boutons | « Tout sélectionner », « Annuler », pause, son |

À la souris : clic, clic maintenu pour le rectangle, glisser pour la caméra, molette pour zoomer.

Le jeu se met automatiquement en pause quand l'application passe en arrière-plan. En mode portrait, un écran demande de tourner le téléphone.

## Jouer et installer sur iPhone

1. Ouvrir l'URL du jeu dans **Safari**.
2. Toucher le bouton **Partager** (carré avec une flèche vers le haut).
3. Choisir **« Sur l'écran d'accueil »**, puis **Ajouter**.
4. Lancer le jeu depuis l'icône : il s'ouvre en plein écran, en paysage, et fonctionne hors ligne après le premier chargement.

## Lancer en local

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev        # serveur de développement (accessible sur le réseau local avec --host)
npm test           # tests unitaires et test d'intégration (Vitest)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production
npm run icons      # régénère les icônes PWA (Python 3 + Pillow)
```

Pour tester sur un iPhone pendant le développement, lance `npm run dev` et ouvre l'adresse `http://<ip-de-ton-ordinateur>:5173` dans Safari. L'audio démarre à la première interaction, comme l'exige iOS.

## Déploiement

Le dépôt contient un workflow GitHub Actions (`.github/workflows/deploy.yml`) qui teste, construit et publie `dist/` sur GitHub Pages à chaque push sur `main`. Dans les réglages du dépôt, « Pages » doit être configuré sur la source **GitHub Actions**. Les chemins du build sont relatifs, le jeu fonctionne donc sous n'importe quel préfixe d'URL.

## Architecture

```
src/
  config.ts            couleurs d'équipe, réglages de jeu, profils d'IA
  main.ts              démarrage, menu, HUD, pause automatique, service worker
  game.ts              une partie : boucle, sélection, ordres, caméra, fin de partie
  core/                logique pure, sans navigateur (testée par Vitest)
    world.ts           simulation : unités, combats, captures, apparitions, victoire
    unit.ts            état d'un élève (ordres, chemin, points de vie, KO)
    tile.ts            règles de capture d'une case
    ai.ts              IA d'équipe (évaluation des cases, regroupement, défense)
    pathfinding.ts     A* 8 voisins + lissage
    spatial.ts         hash spatial pour les voisinages
    grid.ts            grille de navigation et obstacles
    maps.ts            les 5 cartes
    save.ts            progression (localStorage)
  render/              rendu canvas 2D
    sprites.ts         élèves dessinés pixel par pixel : 8 directions, marche, coup, KO
    suits.ts           symboles de cartes en vectoriel
    renderer.ts        sol iso, cases, obstacles, unités triées par profondeur, marqueurs
    minimap.ts         mini-carte
    camera.ts          zoom, déplacement, cadrage
  input/touch.ts       gestes tactiles et souris
  audio/sfx.ts         sons synthétisés (Web Audio)
  ui/                  menu, HUD, fenêtres (pause, fin, installation)
public/
  manifest.webmanifest, sw.js, icons/
tests/                 capture, combat, victoire, pathfinding, test d'intégration jsdom
```

Stack : TypeScript, Vite, canvas 2D pur (pas de moteur), Vitest. Aucune dépendance côté serveur, aucune dépendance d'exécution.
