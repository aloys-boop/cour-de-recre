# Vision du jeu

Ce dossier est la mémoire du studio. Chaque session de développement (une par jour, lancée par une tâche planifiée) repart de zéro : elle lit d'abord ces fichiers, puis le README, avant de toucher au code.

- `VISION.md` : ce que le jeu veut être, les règles intangibles (ce fichier).
- `FEUILLE-DE-ROUTE.md` : les chantiers, dans l'ordre. On coche, on ajoute, on réordonne.
- `RETOURS.md` : les retours d'Aloys, le plus récent en haut. Ils passent avant la feuille de route.
- `JOURNAL.md` : une entrée par session (ce qui a été fait, mesuré, ce qui reste).

## Le jeu en une phrase

Un jeu de stratégie en temps réel de poche, où l'on gagne par les **décisions** (où frapper, quoi tenir, quand s'allier, comment dépenser) et pas par la vitesse des doigts.

## Piliers

1. **Stratégie avant dextérité.** Sur un téléphone, un humain donne quelques ordres par minute. Le jeu doit récompenser les bonnes intentions, avec des outils qui exécutent les détails à sa place (garnisons, renforts automatiques, alertes). L'IA joue sous les mêmes contraintes d'attention qu'un humain : elle ne doit jamais gagner parce qu'elle est partout à la fois.
2. **Lisible d'un coup d'œil.** À tout instant, on doit voir qui gagne où, ce qui est menacé et ce qu'on peut faire. Couleurs, formes et sons portent l'information ; jamais une info seulement dans un chiffre minuscule.
3. **Des parties courtes et rejouables.** Une partie se joue dans un trajet de métro (5 à 12 minutes). Chaque partie raconte une petite histoire : retournement, trahison, dernier carré.
4. **L'esprit de la cour de récré.** Humour, tendresse, nostalgie des jeux Flash : uniformes, cartes à jouer, surveillants, sonnerie, goûter. Rien de violent au-delà de la bagarre de cour.
5. **Finition de grand studio.** Chaque ajout est fini : animé, sonorisé, expliqué (tutoriel ou « Comment jouer »), testé, équilibré par simulation, fluide à 60 images par seconde sur iPhone. Mieux vaut une petite chose parfaite qu'une grande à moitié faite.

## Décisions validées par Aloys (ne jamais revenir dessus sans son accord écrit)

- 30 élèves maximum par équipe, quelle que soit la carte.
- Équipes à budget fixe : 12 points répartis sur 4 caractéristiques (1 à 5 chacune).
- 4 difficultés : Facile, Normal, Difficile, Expert.
- Améliorations PV, dégâts, production et classes : globales à l'équipe. Défense, pion, type d'élève et ralliement : par camp.
- Pouvoirs : aide à l'appui long, lancement par glisser-déposer (l'ancien tap-tap reste possible).
- Pas de bulletin de fin de partie (refusé le 26/10/2026).
- Jeu personnel et non commercial : nom, graphismes et sons 100 % originaux, rien repris de School Wars.
- Aloys joue souvent les Noirs, sur iPhone, en paysage.

## Règles techniques

- TypeScript + Vite + canvas, aucune dépendance au réseau ni au serveur, jouable hors ligne.
- La logique de jeu vit dans `src/core/`, sans navigateur, couverte par des tests.
- Les sauvegardes et les codes de carte existants restent toujours compatibles.
- Chaque session : un tag git de retour avant de modifier, tests et build verts avant de pousser, déploiement vérifié après.
- Le dépôt refuse les tags git : les « tags » de retour et de version (`avant-AAAA-MM-JJ`, `vX.Y`) sont poussés comme des branches du même nom.
