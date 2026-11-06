# Retours d'Aloys

Le plus récent en haut. Chaque session lit ce fichier, recopie ici les nouveaux retours reçus par e-mail (réponses au « journal du jour »), et indique en dessous de chaque retour ce qui en a été fait.

## 05/11/2026 (transmis par la conversation avec Claude, à traiter EN PRIORITÉ la nuit du 05 au 06/11, les cinq points « a minima »)

> « Maj de cette nuit, a minima :
> - Il faudrait un chouïa augmenter la difficulté. C'est un peu trop simple.
> - Ajouter la possibilité d'abandonner la partie et de quand même avoir les stats.
> - Quand on clique hors de la carte rien ne se passe, il faudrait que ça aille dans l'angle ou le bord proche du hors carte.
> - Ajout d'un mode par équipe dès le début de la partie.
> - Les IA rompent souvent en fin de partie quand elles ont l'avantage, une raison en particulier ? Peut-être mettre un délai de 30 s entre quand on demande de rompre la paix et quand c'est effectif. »

Pistes relevées dans le code (à vérifier) :
1. **Difficulté.** Depuis la v5.4 (attention limitée), le témoin gagne 54 % en Normal : c'est devenu trop facile. Aloys joue surtout en Normal. Remonter légèrement Normal (cible témoin 45 % environ), et décaler Difficile et Expert dans la même proportion pour garder l'échelle. Petits pas, mesurés par `equilibre.ts`.
2. **Abandonner.** Le menu pause a « Quitter » (`src/ui/overlay.ts`, `onQuit`), qui ramène au menu sans rien montrer. Ajouter « Abandonner » : la partie se termine en défaite et affiche l'écran de fin avec le tableau de statistiques habituel (`EndStats`, `statsTable`), avec le titre « Abandon ». Demander une confirmation dans la page (pas de `confirm()`). Un abandon ne débloque rien et ne donne pas de médaille.
3. **Tap hors de la carte.** `moveTo()` dans `src/game.ts` sort sans rien faire si le point est hors de la grille (`if (g.x < 0 || … ) return;`). Ramener le point au bord ou au coin le plus proche (`grid.clampPos`, déjà utilisé pour la visée des pouvoirs), puis à la case libre la plus proche. Même traitement pour la flèche d'ordre glissée et le point de ralliement.
4. **Mode par équipes dès le début.** En escarmouche, option « Équipes » : répartition fixe choisie au menu (2 contre 2, 3 contre 3, 4 contre 4, 2 contre 2 contre 2…, avec ses coéquipiers IA), alliances verrouillées toute la partie (pas de rupture, pas de diplomatie entre coéquipiers), victoire partagée par l'équipe, camps des coéquipiers voisins sur la carte. Les IA coéquipières coopèrent (aide aux cases alliées, déjà existante). À combiner proprement avec les options existantes.
5. **Ruptures de fin de partie.** Cause : `DiplomacyManager.think()` (`src/core/diplomacy.ts`) applique `BETRAYAL.endgameChance` (25 % en Normal, à chaque réflexion toutes les 7 s environ) dès que les ennemis restants pèsent moins de 25 % de la puissance de l'IA : comme une victoire en alliance ne compte pas pour elle, elle rompt presque à coup sûr en moins de 30 s. Demande d'Aloys : passer `DIPLOMACY.breakNotice` de 5 à 30 s, avec un compte à rebours bien visible (puce de l'équipe et annonce). Garder la trahison de fin de partie (c'est l'esprit du jeu), mais la rendre moins systématique en Facile et Normal.

Pour chaque point : test(s), mise à jour de « Comment jouer » si une règle change, et une ligne dans l'e-mail du jour.

Complément d'Aloys (05/11, 22 h 20) : « Fais tes suggestions en même temps. C'est des bonnes idées. » La session de cette nuit fait donc AUSSI ce qui était prévu dans la feuille de route, en plusieurs livraisons successives, chacune testée, poussée et déployée avant de passer à la suivante :
- v5.6 : les cinq demandes ci-dessus ;
- v5.7 : 1.4 Alertes (case attaquée, case perdue, camp en danger, tap pour y aller) ;
- v5.8 : 1.3 Renforts automatiques ;
- puis 1.1 bis (témoin plus humain), qui sert aussi à vérifier le nouveau réglage de difficulté.
Si le temps manque, ce qui reste passe en tête de la session suivante. Un seul e-mail du journal en fin de session, qui récapitule toutes les versions livrées.

**Ce qui en a été fait (06/11, v5.6) :** les cinq points sont livrés en v5.6.
1. Normal : dégâts ×0,95 et 42 % de défenseurs ; témoin 54,3 % → 42,6 % (1 600 parties). Difficile et Expert +5 % de dégâts (9,8 % et 2,4 %).
2. « Abandonner » dans la pause, confirmation dans la page, écran « Abandon » avec les statistiques, rien de débloqué.
3. Tap, flèche d'ordre et ralliement hors de la cour : ramenés au bord ou au coin le plus proche (`Grid.orderPoint`).
4. Escarmouche, « Équipes fixes » : Libre, Par 2, Par 3, Par 4 (tailles impossibles grisées), coéquipiers aux camps voisins, alliances verrouillées, victoire partagée.
5. Préavis de rupture 30 s, compte à rebours rouge sous la puce, rappel à 10 s ; trahison de fin de partie 4 % (Facile) et 8 % (Normal) par réflexion au lieu de 15 et 25 %.
Seconde livraison de la nuit : v5.7 (1.4 Alertes). 1.3 Renforts (v5.8) et 1.1 bis passent en tête de la session suivante.

## 03/11/2026

> « Une des grosses difficultés du jeu actuellement c'est la micro et le contrôle des cases. Pour une IA, facile d'être partout à la fois. Pour un humain c'est plus compliqué… »

- Constat dans le code : `src/core/ai.ts`, `think()` défend toutes les cases menacées à chaque réflexion, sans limite d'attention.
- Suite : devient la saison 1 de la feuille de route (« Moins de micro, plus de stratégie »), en priorité absolue.

## 27/10/2026

> L'IA est assez forte : en Normal, une victoire sur 5 environ (joue souvent les Noirs). Inégalités entre équipes, les 4 dernières couleurs assez faibles.

- Traité en v5.1 (budget de 12 points) et v5.2 (nouveau Normal plus doux). À revérifier en jeu réel avec Aloys.
