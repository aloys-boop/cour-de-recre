# Cour de Récré

Jeu de stratégie en temps réel isométrique, jouable au doigt sur iPhone (Safari) et installable comme application hors ligne. Remake personnel et non commercial, inspiré dans l'esprit d'un jeu Flash des années 2000 : tous les graphismes, sons et le nom sont originaux et générés par le code.

De deux à huit équipes d'élèves en uniforme (Noir, Vert, Jaune, Violet, Rouge, Bleu, Orange, Rose) se disputent les cases d'une cour de récréation. Tu diriges l'une d'elles, les autres (jusqu'à sept) sont contrôlées par l'ordinateur, toutes sur le même téléphone, sans réseau. En cours de partie, les équipes peuvent s'allier… et se trahir.

## Règles du jeu

- **Les camps.** Chaque équipe part d'un camp (grande zone colorée dans un coin de la cour ; à partir de 5 équipes, aussi au milieu des bords). Le camp produit régulièrement un nouvel élève, dans la limite d'un plafond par équipe (20 à 30 selon la carte, abaissé à partir de 6 équipes pour ne jamais dépasser 150 élèves en tout : 18 par équipe à 8).
- **Les cases bonus.** Entre les camps, des cases blanches marquées d'un symbole de carte. Chaque case possédée renforce toute l'équipe :
  - ♥ cœur : plus de points de vie (+30 % par case) ;
  - ♠ pique : plus de dégâts (+30 %) ;
  - ♣ trèfle : production plus rapide (+35 %) ;
  - ♦ carreau : déplacement plus rapide (+15 %).
- **Capturer.** Des élèves d'une seule équipe doivent rester sur une case pendant environ 3 secondes (jauge visible). Plus ils sont nombreux, plus c'est rapide (jusqu'à 2 fois). Si une autre équipe tient déjà une jauge, il faut d'abord la vider. Une case occupée par des équipes ennemies est **contestée** (pointillés rouges) : rien ne bouge tant que le combat n'est pas tranché (des alliés, eux, ne se la contestent pas, voir plus bas). Un camp se prend aussi, mais 2,5 fois plus lentement ; l'équipe qui le perd ne produit plus.
- **Des équipes inégales.** Chaque uniforme a ses forces (le menu affiche le profil de chaque équipe) :

  | Équipe | Vie | Dégâts | Production | Vitesse | En bref |
  | --- | --- | --- | --- | --- | --- |
  | Noir | ×1,05 | ×1,05 | ×1,05 | ×1 | Solides et équilibrés en tout |
  | Vert | ×0,7 | ×0,85 | ×1,7 | ×1,1 | Production très rapide, mais fragiles |
  | Jaune | ×0,95 | ×0,95 | ×1,1 | ×1,35 | Très rapides, un peu légers |
  | Violet | ×1,4 | ×1,25 | ×0,6 | ×0,9 | Très forts, mais lents à produire |
  | Rouge | ×0,75 | ×1,4 | ×1 | ×1,05 | Frappent très fort, mais peu de vie |
  | Bleu | ×1,5 | ×0,95 | ×0,95 | ×0,86 | Beaucoup de vie, mais lents |
  | Orange | ×0,95 | ×0,8 | ×1,3 | ×1,2 | Production et vitesse élevées, petits poings |
  | Rose | ×1,15 | ×1 | ×0,95 | ×1 | Polyvalents, un peu plus résistants |

  La huitième couleur est le rose plutôt que le blanc : une case bonus prise par une équipe blanche resterait blanche sur blanc (symbole invisible), et son camp se confondrait avec le sol gris clair.

- **Combat.** Les élèves se battent à coups de poing au corps à corps. Un élève inoccupé engage de lui-même les ennemis qui s'approchent. À zéro point de vie, il s'assoit, KO, puis disparaît.
- **Repli.** Un ordre de déplacement est un rappel : les élèves cessent le combat et courent sans riposter jusqu'à destination (ils peuvent se faire frapper en fuyant). Arrivés, ils se défendent à nouveau. Pour attaquer, touche un ennemi. Le bouton **Fuir / Charger** (en haut à droite) change ce comportement : en mode Charger, les élèves se battent contre tout ce qu'ils croisent en chemin (marqueur orange).
- **Point de ralliement.** Sans sélection, un appui long sur le sol (sans glisser) plante un drapeau : les nouveaux élèves du camp le plus proche s'y rendent dès leur naissance. Un appui long sur un de tes camps efface son drapeau.
- **Régénération.** Un élève qui se tient sur son propre camp, ou sur un cœur que son équipe possède, récupère ses points de vie (environ 7 par seconde) : de petits cœurs montent au-dessus de lui. Les élèves d'une équipe qui possède au moins un pique marchent sur une aura rougeâtre.
- **Victoire.** Une équipe gagne quand elle est la dernière à avoir encore des élèves ou un camp, ou quand elle possède tous les camps. Si toutes les équipes encore en vie sont alliées entre elles (ou si une alliance tient tous les camps), **l'alliance gagne ensemble** : « Victoire de l'alliance ! », avec les couleurs alliées. Tu perds dès que tu n'as plus ni élèves ni camp, même si ton alliance l'emporte.
- **Cartes.** Six niveaux de taille croissante (du Préau au Campus, de 14 à 22 cases bonus, puis « Le tournoi » : 8 équipes, 26 × 26, 28 cases, débloqué après le 5e). La disposition des cases et des obstacles est tirée au sort à chaque partie, de façon symétrique pour rester équitable. Chaque victoire débloque le niveau suivant ; la progression est sauvegardée sur l'appareil.
- **Escarmouche.** Partie libre : nombre d'équipes (2 à 8), taille de la cour (petite, moyenne, grande, immense), nombre de cases bonus (10 à 30 ; au moins 20 à partir de 5 équipes), difficulté et couleur parmi les huit. La cour grandit de deux cellules par équipe au-delà de quatre. Les victoires d'escarmouche ne débloquent rien dans la campagne.
- **Code de carte.** Chaque partie a un code de 6 caractères (sans 0, 1, I ni O), affiché dans le menu pause et sur l'écran de fin avec un bouton « Copier ». Saisi dans le menu, il redonne exactement la même disposition (niveau ou réglages d'escarmouche compris, de 2 à 8 équipes). Les codes des versions précédentes restent valides et redonnent la même carte.
- **Médailles.** Chaque niveau de campagne propose trois médailles : victoire, victoire sans perdre son camp, victoire en moins de 3 minutes de jeu. Elles sont sauvegardées et affichées sous forme de pastilles dans la liste des cartes.
- **Difficulté.** Facile, Normal ou Difficile : les IA réagissent plus vite, attaquent avec de plus petits groupes, gardent moins de défenseurs et frappent plus fort.

## Alliances

- **Proposer.** Touche la puce d'une équipe, en haut de l'écran : le panneau « Diplomatie » permet de lui proposer une alliance ou de rompre la vôtre. L'IA répond tout de suite (« Les Jaunes acceptent l'alliance. » ou « Les Jaunes refusent. »).
- **Entre alliés.** Pas de combat (ni engagement automatique, ni ordre d'attaque possible, ni dégâts : toucher un allié vaut un déplacement), on se traverse sans se bloquer, et on ne se conteste pas les cases. Si seuls des alliés sont sur une case, la capture avance pour celle qui capturait déjà, sinon pour la plus nombreuse ; un allié ne prend jamais la case d'un allié (il y efface plutôt la jauge d'un ennemi). Les camps et les cœurs ne soignent que leur propriétaire.
- **Repères.** La puce d'un allié porte une poignée de main et un liseré bleu clair (en pointillés clignotants quand une rupture est annoncée) ; ses élèves ont un petit losange bleu à côté de leur barre de vie ; sur la mini-carte, ses camps ont un liseré bleu.
- **Rompre.** Une rupture est annoncée 5 s à l'avance (« Les Verts vont rompre l'alliance dans 5 s ! »), pour l'IA comme pour toi. Une même paire d'équipes ne peut pas changer d'alliance plus d'une fois toutes les 30 s.
- **Ce que pense l'IA.** Chaque IA estime la puissance de chaque équipe (vie et dégâts de ses élèves, camps, cases) et garde une attitude envers chacune (rancune quand on lui met des élèves KO, méfiance pendant 2 minutes envers qui l'a trahie). Elle accepte une alliance face à une menace commune (une équipe au moins 1,5 fois plus forte que les deux), ou si le proposeur n'est pas plus fort qu'elle et qu'elle ne lui en veut pas ; jamais si l'alliance réunirait toutes les équipes restantes (ce serait la fin de la partie). Les IA s'allient aussi entre elles face à une menace, et parfois sans raison. Elles rompent quand leur allié devient trop fort ou quand l'ennemi commun est presque éliminé, plus souvent en Difficile. Une IA ne cible pas les cases de ses alliés et peut venir défendre une case alliée qu'un ennemi est en train de prendre.

## Équilibrage et performances

Les profils ont été réglés par simulation IA contre IA (`npx tsx scripts/dev/balance.ts normal 4mix` et `… normal 8`), en faisant tourner les couleurs sur toutes les positions. Taux de victoire rapporté à la moyenne, difficulté Normal :

| Mode | Noir | Vert | Jaune | Violet | Rouge | Bleu | Orange | Rose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 équipes, 4 couleurs parmi 8 (420 parties) | 1,22 | 0,90 | 1,24 | 0,59 | 0,99 | 1,35 | 0,72 | 0,99 |
| « Le tournoi », 8 équipes (64 parties) | 0,91 | 0,91 | 1,36 | 0,15 | 1,51 | 1,21 | 0,91 | 1,06 |

À 8 équipes, chaque couleur ne gagne que 8 parties en moyenne sur 64 : les écarts y sont surtout du bruit. Avec la diplomatie des IA (mode `8d`), les parties sont encore plus imprévisibles.

À 8 équipes (`npx tsx scripts/dev/perf8.ts`), un pas de simulation (IA, monde et diplomatie) prend environ 0,1 ms en moyenne sur un ordinateur de bureau, cour pleine comprise (148 élèves), avec de rares pointes vers 6 ms quand plusieurs IA recalculent leurs chemins en même temps.

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
| Tap sur la puce d'une équipe (en haut) | Panneau « Diplomatie » : proposer ou rompre une alliance |
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
    diplomacy.ts       alliances : propositions, ruptures annoncées, attitude des IA
    pathfinding.ts     A* 8 voisins + lissage
    spatial.ts         hash spatial pour les voisinages
    grid.ts            grille de navigation et obstacles
    mapgen.ts          générateur de cartes aléatoires (camps, cases bonus, obstacles)
    maps.ts            les 6 niveaux
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
tests/                 capture, combat, victoire, alliances, pathfinding, test d'intégration jsdom
scripts/dev/           outils de développement (lancés avec `npx tsx`)
  balance.ts           équilibrage IA contre IA (modes 4, 4mix, 8, 8d)
  perf8.ts             temps de simulation à 8 équipes
  render-check.ts      rendu hors navigateur (planches de sprites, scène de jeu)
  white-check.ts       comparaison Blanc / Rose pour la 8e couleur
```

Stack : TypeScript, Vite, canvas 2D pur (pas de moteur), Vitest. Aucune dépendance côté serveur, aucune dépendance d'exécution.
