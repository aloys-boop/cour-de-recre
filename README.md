# Cour de Récré

Jeu de stratégie en temps réel isométrique, jouable au doigt sur iPhone (Safari) et installable comme application hors ligne. Remake personnel et non commercial, inspiré dans l'esprit d'un jeu Flash des années 2000 : tous les graphismes, sons et le nom sont originaux et générés par le code.

Quatre équipes d'élèves en uniforme (Noir, Vert, Jaune, Violet) se disputent les cases d'une cour de récréation. Tu diriges l'une d'elles, les trois autres sont contrôlées par l'ordinateur.

## Règles du jeu

- **Les camps.** Chaque équipe part d'un camp (grande zone colorée dans un coin de la cour). Le camp produit régulièrement un nouvel élève, dans la limite d'un plafond par équipe (20 à 30 selon la carte).
- **Les cases bonus.** Entre les camps, des cases blanches marquées d'un symbole de carte. Chaque case possédée renforce toute l'équipe :
  - ♥ cœur : plus de points de vie (+30 % par case) ;
  - ♠ pique : plus de dégâts (+30 %) ;
  - ♣ trèfle : production plus rapide (+35 %) ;
  - ♦ carreau : déplacement plus rapide (+15 %).
- **Capturer.** Des élèves d'une seule équipe doivent rester sur une case pendant environ 3 secondes (jauge visible). Plus ils sont nombreux, plus c'est rapide (jusqu'à 2 fois). Si une autre équipe tient déjà une jauge, il faut d'abord la vider. Une case occupée par plusieurs équipes est **contestée** (pointillés rouges) : rien ne bouge tant que le combat n'est pas tranché. Un camp se prend aussi, mais 2,5 fois plus lentement ; l'équipe qui le perd ne produit plus.
- **Des équipes inégales.** Chaque uniforme a ses forces : Noir, solide et équilibré ; Vert, production très rapide mais élèves fragiles ; Jaune, très rapide ; Violet, très fort mais lent à produire. Le menu affiche le profil de chaque équipe.
- **Combat.** Les élèves se battent à coups de poing au corps à corps. Un élève inoccupé engage de lui-même les ennemis qui s'approchent. À zéro point de vie, il s'assoit, KO, puis disparaît.
- **Repli.** Un ordre de déplacement est un rappel : les élèves cessent le combat et courent sans riposter jusqu'à destination (ils peuvent se faire frapper en fuyant). Arrivés, ils se défendent à nouveau. Pour attaquer, touche un ennemi. Le bouton **Fuir / Charger** (en haut à droite) change ce comportement : en mode Charger, les élèves se battent contre tout ce qu'ils croisent en chemin (marqueur orange).
- **Point de ralliement.** Sans sélection, un appui long sur le sol (sans glisser) plante un drapeau : les nouveaux élèves du camp le plus proche s'y rendent dès leur naissance. Un appui long sur un de tes camps efface son drapeau.
- **Régénération.** Un élève qui se tient sur son propre camp, ou sur un cœur que son équipe possède, récupère ses points de vie (environ 7 par seconde) : de petits cœurs montent au-dessus de lui. Les élèves d'une équipe qui possède au moins un pique marchent sur une aura rougeâtre.
- **Victoire.** Une équipe gagne quand elle est la dernière à avoir encore des élèves ou un camp, ou quand elle possède tous les camps. Tu perds dès que tu n'as plus ni élèves ni camp.
- **Cartes.** Cinq niveaux de taille croissante (du Préau au Campus, de 14 à 22 cases bonus). La disposition des cases et des obstacles est tirée au sort à chaque partie, de façon symétrique pour rester équitable. Chaque victoire débloque le niveau suivant ; la progression est sauvegardée sur l'appareil.
- **Escarmouche.** Partie libre : nombre d'équipes (2 à 4), taille de la cour (petite, moyenne, grande, immense), nombre de cases bonus (10 à 30), difficulté et équipe. Les victoires d'escarmouche ne débloquent rien dans la campagne.
- **Code de carte.** Chaque partie a un code de 6 caractères (sans 0, 1, I ni O), affiché dans le menu pause et sur l'écran de fin avec un bouton « Copier ». Saisi dans le menu, il redonne exactement la même disposition (niveau ou réglages d'escarmouche compris).
- **Médailles.** Chaque niveau de campagne propose trois médailles : victoire, victoire sans perdre son camp, victoire en moins de 3 minutes de jeu. Elles sont sauvegardées et affichées sous forme de pastilles dans la liste des cartes.
- **Difficulté.** Facile, Normal ou Difficile : les IA réagissent plus vite, attaquent avec de plus petits groupes, gardent moins de défenseurs et frappent plus fort.

## Contrôles tactiles

| Geste | Effet |
| --- | --- |
| Tap sur un élève | Sélectionne l'élève et ses voisins proches |
| Appui long puis glisser | Rectangle de sélection |
| Tap sur le sol | Rappel : déplacement sans combat (marqueur blanc), ou charge en mode Charger (marqueur orange) |
| Appui long sans bouger, sans sélection | Point de ralliement du camp le plus proche (drapeau) |
| Tap sur un ennemi | Ordre d'attaque (marqueur rouge) |
| Glisser à un doigt | Déplacer la caméra |
| Pincer / glisser à deux doigts | Zoom et caméra |
| Tap sur la mini-carte | Centrer la vue à cet endroit |
| Double-tap sur un élève | Sélectionne tous tes élèves visibles à l'écran |
| Glisser depuis un élève sélectionné | Flèche d'ordre : déplacement au relâchement, attaque si on relâche sur un ennemi |
| Boutons « 1 », « 2 », « 3 » | Appui long : mémoriser la sélection ; tap : la rappeler ; second tap rapide : centrer la vue dessus |
| Bouton « Camp » | Repli de la sélection (sans combat) sur ton camp le plus proche, pour se soigner |
| Boutons | « Tout sélectionner », « Annuler », « Fuir / Charger », pause, son |

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
    tile.ts            camps et cases bonus, règles de capture
    ai.ts              IA d'équipe (évaluation des cases, regroupement, défense)
    pathfinding.ts     A* 8 voisins + lissage
    spatial.ts         hash spatial pour les voisinages
    grid.ts            grille de navigation et obstacles
    mapgen.ts          générateur de cartes aléatoires (camps, cases bonus, obstacles)
    maps.ts            les 5 niveaux
    skirmish.ts        réglages d'escarmouche → niveau construit à la volée
    mapcode.ts         code de carte partageable (type de partie + graine, base 32)
    challenges.ts      médailles de campagne
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
