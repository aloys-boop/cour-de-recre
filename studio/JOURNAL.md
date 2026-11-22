# Journal du studio

Une entrée par session, la plus récente en haut : date, version, ce qui a été fait, ce qui a été mesuré, ce qui reste ou ce qui inquiète.

## 22/11/2026 : session de développement, v5.23 (saison 2, interface c : accueil vivant)

**Fait**
- Aucun retour d'Aloys (seuls les anciens journaux envoyés à lui-même sur 14 jours, sans réponse ; aucun e-mail envoyé). Travail du jour : troisième et dernière tranche du point « Interface », en entier, ce qui clôt le point. Point de retour : branche `avant-2026-11-22`.
- `src/core/menu-scene.ts` : partie de chat déterministe le long d'une bande (un élève par couleur, 3 à 8 selon la largeur) : le chat compte 0,8 s puis poursuit l'élève libre le plus proche, les autres détalent à son approche, un élève coincé contre un bout passe à côté en changeant de profondeur, contact = « Touché ! » et rôles échangés, ancien chat intouchable 1,6 s ; saut de joie à deux bonds avec « Moi ! » ; trois onomatopées au plus ; pas plafonné à 0,1 s. Durée du retournement et délais des jauges.
- `ui/menu-backdrop.ts` : la bande derrière le titre, avec les vrais sprites des élèves (profil gauche ou droit, course à quatre images, plus petits et plus sombres au fond), ombre au sol, ligne de craie et deux marelles, étoile dorée sur le chat ; 30 images par seconde, seulement menu affiché et page visible ; jamais sous le doigt. « Réduire les animations » : une image fixe.
- `ui/flip.ts` et menu : choisir une équipe retourne sa carte (liseré à la couleur, emblème devant la devise) et fait sauter son élève ; Campagne/Escarmouche retourne le volet (les onglets ne bougent pas) ; les cases des jauges s'allument l'une après l'autre ; un petit son (`select`, au timbre de l'équipe) pour chaque choix du menu (équipe, difficulté, carte, tutoriel, onglet). Le réglage change dès le toucher : un premier essai changeait le contenu à mi-retournement, six tests existants l'ont attrapé (un « Jouer » touché dans les 120 ms partait avec l'ancien réglage) ; corrigé.
- Correctif en cours de route : le contenu du menu passé au premier plan passait devant la fenêtre « Bienvenue » ; le menu a maintenant son propre contexte d'empilement (`isolation: isolate`).
- README (règle, mesures, versions, architecture). Pas de tutoriel ni de « Comment jouer » à changer : aucune règle ni aucun geste nouveau.
- 13 nouveaux tests (`interface-c.test.ts` : une couleur par élève, un seul chat, compte puis contact et échange, « Touché ! », ancien chat intouchable, fuite, personne hors de la bande, pas plafonné, déterminisme, saut et « Moi ! », équipe absente, onomatopées bornées, ordre de dessin, durées ; `interface-c-app.test.ts` : bande en tête du menu et animée, carte et jauges, retournement immédiat, deux choix rapides, volet Escarmouche, bande arrêtée en partie). 534 tests verts.

**Mesuré**
- Bande de l'accueil dans Chromium (844 × 390, ×3) : 0,30 ms par image (mise à jour et dessin).
- Déploiement : run n° 59 « Déploiement GitHub Pages » réussi (tests, build, `deploy-pages`).
- `perf240` : partie 0,23 à 0,27 ms par pas, mêlée 0,12 à 0,18, ordres 0,18 à 0,23 ; rendu ×1 1,9 à 3,5 ms selon le passage, ×2 1,2 ms : même plage avec et sans la tranche (le jeu n'est pas touché, bruit de la machine). Témoin non relancé : purement visuel, menu seulement.
- Captures 844 × 390 (×3) : élèves nets derrière le titre, qui reste lisible grâce à son ombre ; première version, la ligne de sol mordait le haut des panneaux, bande raccourcie de 6 px ; « Moi ! » était coupé en haut de la bande, il s'écrit maintenant à côté de la tête. Carte d'équipe à mi-retournement, jauges qui s'allument, volet Escarmouche qui pivote, partie inchangée. Aucune erreur de console.

**Reste à faire, inquiétudes**
- Sur iPhone, vérifier la batterie : la bande ne tourne que menu affiché, à 30 images par seconde, mais un menu laissé ouvert longtemps chauffe un peu.
- La partie de chat se concentre souvent au milieu de la bande ; si elle paraît monotone, ajouter un ballon ou une corde à sauter.
- Saison 2 : il reste « Performances : 60 images par seconde garanties à 240 élèves sur iPhone, mesurées ». Prochaine session : ce point, à découper (mesure en conditions iPhone simulées, puis les pistes).

## 21/11/2026 : session de développement, v5.22 (saison 2, interface b : retours sous le doigt et fondus)

**Fait**
- Aucun retour d'Aloys (seuls les anciens journaux envoyés à lui-même sur 14 jours, sans réponse ; aucun e-mail envoyé). Travail du jour : deuxième tranche du point « Interface », en entier. Point de retour : branche `avant-2026-11-21`.
- `src/core/feedback.ts` : allure de l'onde par ordre (déplacement blanc, charge orange, attaque rouge à quatre crans qui se referment, case et pouvoir à la couleur de l'équipe éclaircie de 45 %, sélection en petit anneau, tap sans effet en anneau pâle), anneaux en sortie cubique, second anneau décalé, six ondes au plus, ordre compris d'après le repère posé pendant le geste, enfoncement minimal des boutons (110 ms), durées et courbe des fondus ; variantes « réduire les animations ».
- `Game` : tap, flèche d'ordre, appui long et rectangle passent par `withRipple` ; l'onde naît exactement sous le doigt, vieillit en temps réel (aussi pendant la pause tactique), rien pendant la pause, la fin au ralenti ou après la partie. Dessin `render/ripples.ts`, en pixels d'écran avec un halo sombre, hors tremblement de la caméra.
- `ui/press.ts` : un écouteur pour toute la page, classe `is-pressed` (propriétés CSS `scale` et `translate`, qui s'ajoutent aux transformations propres des boutons) ; le bouton remonte si le doigt glisse dehors. Les anciens `:active` qui rapetissaient certains boutons sont retirés (plus de double enfoncement).
- `ui/veil.ts` : voile bleu nuit qui se lève entre menu et partie (0,42 s) et vers le menu (0,34 s), sans retarder ni bloquer le doigt ; fond des fenêtres (pause, fin) en fondu de 0,26 s.
- « Comment jouer » (« Déplacer et attaquer ») et README (règle, geste, mesures, versions, architecture). Pas d'étape de tutoriel : rien à apprendre.
- 11 nouveaux tests (`interface-b.test.ts` : couleurs, ouverture, extinction, mode réduit, crans, plafond, ordre compris, lisibilité sur le sol, enfoncement, fondus, « Comment jouer » ; `interface-b-app.test.ts` : bouton enfoncé puis relâché, doigt qui glisse dehors, fondu menu → partie puis retour, ondes de sélection, de déplacement et d'attaque sous le doigt, extinction, rien en pause). 521 tests verts.

**Mesuré**
- `perf240` : partie 0,218 ms par pas, mêlée 0,103, ordres 0,157 ; rendu ×1 1,85 à 1,98 ms, avec motifs 2,76 à 3,41 selon le passage (bruit de la machine, la tranche ne touche pas ce chemin), ×2 1,10 et 1,55 ms. `scripts/dev/perf-ondes.ts` (nouveau) : 0,057 ms par image pour six ondes sur un canvas ×3. Témoin non relancé : purement visuel.
- Captures 844 × 390 (×3) : ondes nettes sur le vide bleu comme sur le sol gris (halo sombre indispensable pour la blanche), crans rouges lisibles, voile qui se lève sur l'arrivée en partie, aucune erreur de console.
- Déploiement : run n° 57 « Déploiement GitHub Pages » réussi (tests, build, `deploy-pages`).

**Reste à faire, inquiétudes**
- Les ondes passent sous le bandeau d'aide en bas : normal (le bandeau est au-dessus du canvas), mais un ordre donné juste au-dessus des boutons se verra moins.
- Sur iPhone, vérifier que l'enfoncement des grands boutons du menu ne fait pas « gigoter » la mise en page (les propriétés `scale` ne déplacent rien, en principe).
- Prochaine session : interface c (accueil animé, cartes qui se retournent, jauges d'équipe animées).

## 20/11/2026 : session de développement, v5.21 (saison 2, interface a : fin de partie mise en scène)

**Fait**
- Aucun retour d'Aloys (aucune réponse par e-mail sur 14 jours ; aucun e-mail envoyé). Travail du jour : le point « Interface » de la saison 2, découpé en trois tranches (fin de partie, retours tactiles et transitions, menus vivants) ; ce soir la première, en entier. Point de retour : branche `avant-2026-11-20`.
- `src/core/finale.ts` : `FinaleTracker` (dernier camp pris et dernier KO, un camp récent passe avant un KO, un coup vu avant un coup caché, rien de plus vieux que 5 s), courbe du ralenti (×0,2 puis relâche à ×0,5), glissement et zoom adoucis, tampon qui tombe et s'écrase, bandes de cinéma, ligne « Dernier coup », meilleur score unique, compteurs qui montent.
- `Game` : à la fin, plus de minuterie sèche de 0,9 s mais un ralenti de 1,8 s (1 s sans caméra avec « réduire les animations ») : la caméra glisse vers le coup décisif et zoome ×1,3, le monde continue au ralenti sans IA, statistiques ni diplomatie, l'interface s'efface, `render/finale.ts` dessine vignette, bandes et tampon « Victoire ! » doré ou « Défaite… » ; vibration ; un tap ouvre tout de suite l'écran de fin, sinon une horloge réelle l'ouvre. Abandon et « Terminer » : sans ralenti.
- Écran de fin : carte et titre qui arrivent, lignes qui entrent une à une, nombres qui montent de 0 (valeur finale posée d'emblée, l'animation ne fait que la rejouer), étoile dorée sur les meilleurs KO infligés et cases prises, ligne « Dernier coup ». Durée et médaille « Éclair » arrêtées au coup de sifflet (`Game.endTime`), le ralenti ne compte pas.
- « Comment jouer » (rubrique « Le but ») et README (règle, geste, mesures, versions, architecture). Pas d'étape de tutoriel : rien à apprendre.
- 12 nouveaux tests (`fin-ralenti.test.ts` : coup décisif, ralenti, tampon, titres, ligne « Dernier coup », étoiles, compteurs, tableau ; `fin-ralenti-app.test.ts` : vraie partie, caméra centrée et zoomée sur le dernier KO, 0,6 s réelles = 0,1 s de jeu, tap qui ouvre l'écran une seule fois, ouverture sans images, abandon immédiat). Trois tests d'application attendent maintenant 2 s au lieu de 1 avant l'écran de fin. 510 tests verts.

**Mesuré**
- `perf240` : partie 0,195 ms par pas, mêlée 0,103, ordres 0,142 ; rendu ×1 1,65 ms (2,25 avec motifs), ×2 0,93 ms (1,64). Aucune régression. Témoin non relancé : purement visuel, après la fin de la partie.
- Déploiement : run n° 55 « Déploiement GitHub Pages » réussi (tests, build, `deploy-pages`).
- Captures 844 × 390 (×3) : première version, le tampon et les bandes passaient sous le HUD (puces, boutons, mini-carte) et le tampon couvrait la mêlée ; corrigé (interface effacée pendant le ralenti, tampon remonté à 27 % de la hauteur). Résultat : scène nette, « Victoire ! » doré au-dessus des élèves, écran de fin avec étoile sur le « 1 » des KO et la ligne « Dernier coup : tu mets KO un élève des Verts. » Aucune erreur de console.

**Reste à faire, inquiétudes**
- Le ralenti montre la suite du coup décisif, pas le geste qui le précède : un vrai replay demanderait des instantanés du monde (idée notée).
- Sur iPhone, vérifier que 1,8 s n'agace pas après plusieurs parties (le tap pour passer est là, mais rien ne le dit à l'écran).
- Safari anime mal les transformations des lignes de tableau : au pire elles n'apparaîtront qu'en fondu.
- Prochaine session : interface b (onde sous le doigt, boutons qui s'enfoncent, fondus entre écrans).

## 19/11/2026 : session de développement, v5.20 (saison 2, lisibilité b : cases teintées, liserés, mini-carte)

**Fait**
- Aucun retour d'Aloys (aucune réponse par e-mail sur 14 jours ; consigne du 18/11 respectée : aucun e-mail envoyé). Travail du jour : seconde tranche de « Lisibilité », en entier, ce qui clôt le point. Point de retour : branche `avant-2026-11-19`.
- `src/core/emblems.ts` : `mixHex`, `bonusTileFill` (blanc + 18 % de la couleur de l'équipe, en cache), `suitContrast`, `deepen` (assombrit un contour par crans de 10 % jusqu'au contraste voulu), `TEAM_RING` et `ringInk` (liseré cerné, contour à 2,5:1 au moins sur le sol), `minimapEmblemRadius`. `inkOn` passe par `deepen` : seul le contour Jaune change, et seulement sur sa case teintée.
- Pour tout le monde : cases bonus prises légèrement teintées de leur propriétaire (vue du brouillard respectée).
- Avec « Motifs d'équipe » : liseré d'équipe aux pieds de chaque élève vivant (images en cache par couleur et zoom, `TeamRings`), emblème de chaque camp possédé sur la mini-carte, dessiné par-dessus les élèves qui s'y massent.
- Accueil : bouton « Motifs d'équipe : affichés / masqués » (même réglage que la pause, `aria-pressed`, son et vibration). Au passage, correction d'un défaut ancien : après avoir touché Son ou Musique, un redessin du menu (choix d'une équipe) remettait l'ancien libellé ; le menu reçoit maintenant la progression à jour.
- « Comment jouer » (rubrique « Lisibilité ») et README (règle, contrôles, mesures, versions). Pas d'étape de tutoriel : aucun geste nouveau.
- 7 nouveaux tests (`lisibilite-b.test.ts` : mélange, teintes distinctes, contraste 3:1 du symbole sur case teintée pour les 8 équipes, liseré sur le sol, anneau creux de la bonne couleur en vrai canvas, rayon mini-carte ; `lisibilite-b-app.test.ts` : bouton d'accueil, mémorisé, qui survit au redessin du menu, appliqué à la cour et à la mini-carte, mêlée rendue sans erreur) ; 498 tests verts.

**Mesuré**
- Les tests ont attrapé deux vrais défauts avant livraison : symbole Jaune à 2,95:1 sur sa case teintée et liseré Jaune à 2,16:1 sur le sol ; corrigés par `deepen`.
- `perf240` (napi, 240 élèves) : rendu ×1 2,51 ms sans motifs, 2,12 avec (liserés compris) ; ×2 0,89 et 1,24 ms (v5.19 : 2,82 / 2,82 et 1,31 / 1,70). Simulation 0,178, 0,097 et 0,148 ms par pas. Aucune régression. Témoin non relancé : purement visuel.
- Captures 844 × 390 (×3) : bouton d'accueil propre sur la deuxième rangée (44 px et plus) ; en partie, anneaux jaunes, verts et violets nets sous une mêlée à trois, cœur violet sur case teintée lilas ; mini-carte avec rond blanc, triangle, carré et étoile lisibles sur les camps. Aucune erreur de console.
- Déploiement : run n° 53 « Déploiement GitHub Pages » réussi (tests, build, `deploy-pages`).

**Reste à faire, inquiétudes**
- Les motifs restent masqués par défaut : un joueur qui ne regarde ni l'accueil ni la pause ne les découvrira pas (idée ajoutée : les proposer au premier lancement).
- Sur iPhone, vérifier que le liseré et l'ellipse blanche de sélection ne font pas double emploi.
- Prochaine session : saison 2, « Interface » (transitions, retours tactiles visuels, menus plus vivants, écran de fin), à découper.

## 18/11/2026 : session de développement, v5.19 (saison 2, lisibilité : motifs et contraste)

**Fait**
- Aucun retour d'Aloys par e-mail (aucune réponse aux journaux des 14 derniers jours). Travail du jour : le point « Lisibilité » de la saison 2, découpé en deux tranches ; ce soir la première (motifs d'équipe et contraste des symboles). Point de retour : branche `avant-2026-11-18`.
- `src/core/emblems.ts` : huit emblèmes, un par couleur (rond, triangle, carré, étoile, croix, hexagone, lune, éclair ; aucun symbole de carte, déjà portés par les cases), contours en polygones, icône SVG en ligne ; rapport de contraste WCAG, `inkOn` (symbole cerné de sa teinte sombre si la couleur seule n'atteint pas 3:1 sur le blanc), `emblemInkOnCamp` (teinte la plus contrastée sur le camp).
- Toujours actif : puces du haut, détail « Effectifs » et statistiques de fin en emblèmes au lieu de disques ; symboles des cases prises par les Jaunes (1,75:1 seul), Oranges (2,76) et Roses (2,82) cernés.
- Réglage « Motifs d'équipe » (rubrique « Lisibilité » de la pause, masqués par défaut, champ facultatif `patterns` : anciennes sauvegardes intactes) : grand emblème peint sur chaque camp, petit au coin droit des cases prises, au début des jauges de capture et au bout de la barre de vie de chaque élève (petites images en cache par couleur et par zoom).
- « Comment jouer » : rubrique « Lisibilité » dans les bases, qui nomme la forme de chaque équipe. README (règle, contrôles, mesures, versions, architecture). Pas d'étape de tutoriel : aucun geste nouveau.
- 11 nouveaux tests (`lisibilite.test.ts` : formes distinctes, bornes, aires, SVG sans ressource externe, contrastes, sauvegarde, « Comment jouer » ; `lisibilite-app.test.ts` : puces en emblèmes, réglage dans la pause, rendu avec motifs, mémorisé) ; 491 tests verts.

**Mesuré**
- `perf240` (napi, 240 élèves, `perf240.ts` mesure maintenant aussi les motifs) : rendu ×1 2,82 ms par image sans et avec motifs, ×2 1,31 et 1,70 ms. Première version sans cache : +1,5 ms à ×1, d'où le cache. Simulation inchangée (0,249, 0,143 et 0,207 ms par pas). Témoin non relancé : rien ne touche à la partie.
- Captures 844 × 390 (×3) : puces lisibles (rond blanc des Noirs, triangle vert, carré jaune, étoile violette…), rubrique « Lisibilité » propre sous « Sensations » avec boutons de 44 px, rond blanc peint sur le camp noir, hexagones bleus au bout des barres de vie, cœur jaune cerné sur une case prise. Aucune erreur de console.
- Déploiement : run n° 50 « Déploiement GitHub Pages » réussi (tests, build, `deploy-pages`). Le site n'est pas joignable depuis le bac à sable de la session (proxy) : pas de vérification directe de la page.

**Reste à faire, inquiétudes**
- L'emblème des Noirs (rond gris clair) est le moins frappant au bout des barres de vie ; à revoir avec la tranche b (contour des élèves).
- Les motifs sont masqués par défaut : un joueur daltonien doit les trouver dans la pause. Prochaine tranche : les proposer aussi dans le menu principal.
- Prochaine session : lisibilité b (contours d'équipe sous les élèves, teinte légère des cases prises, emblèmes sur la mini-carte, réglage au menu).

## 17/11/2026 : session de développement, v5.18 (saison 2, musique qui suit la bagarre)

**Fait**
- Aucun retour d'Aloys par e-mail (aucune réponse aux journaux des 14 derniers jours). Travail du jour : deuxième point de la saison 2, la musique, en entier. Point de retour : branche `avant-2026-11-17`.
- `src/core/music-score.ts` : quatre thèmes originaux en partitions (doubles croches) : « Récré » (menu, do majeur, 108 battements par minute, clochettes, basse qui rebondit, écho), « Bagarre » (partie, la mineur, 132, quatre mesures la m, fa, do, sol), fanfare de victoire (roulement, arpège, envolée sur l'accord de do, cymbale, 3,9 s) et défaite (trois notes qui descendent, 4,6 s). « Bagarre » en six couches dosées par l'intensité : basse et accords syncopés toujours là, mélodie feutrée (45 %) qui chante à partir de 0,15, charleston à 0,2, batterie à 0,45, arpèges de mêlée, relance de basse et charleston en doubles croches à 0,72 ; filtre de 1 300 à 4 000 Hz, volume +30 %.
- `MusicMood` : cible = chaleur des bagarres visibles ×1,6, plancher 0,5 pendant 8 s après une alerte, plancher 0,3 en fin de partie serrée (`isFinale` : deux survivants sur une carte à plusieurs, ou une équipe en vie sans camp) ; montée de 1,4 par seconde, retombée de 0,12 (environ 8 s) ; pause, pause tactique et fin de partie ramènent au calme.
- `src/audio/music.ts` réécrit : thème courant, fondu de 0,18 s entre thèmes (un bus par thème), voix « ton », grosse caisse (sinus qui tombe de 140 à 42 Hz), caisse claire, charleston et cymbale (bruit blanc calculé une fois), jingles joués une fois puis silence.
- Branchements : menu → « Récré », partie et tutoriel → « Bagarre » (intensité transmise à chaque image), fin → fanfare ou défaite (abandon compris), retour au menu → « Récré ». Pause : « Musique : Active / Coupée » dans « Sensations », même réglage que le bouton du menu (champ `musicMuted` existant, sauvegardes intactes).
- « Comment jouer » (rubrique « Bagarres »), README (règle, contrôles, mesures, versions, architecture). Pas d'étape de tutoriel : aucun geste nouveau.
- 14 nouveaux tests (`musique.test.ts` : partitions, tessiture, jingles finis, accords sur les temps forts, ordre d'entrée des couches, montée sans à-coup, humeur, finale ; `musique-app.test.ts` : menu, vraie mêlée qui fait monter l'intensité, musique coupée puis rallumée dans la pause et mémorisée, fanfare, retour au menu) ; 480 tests verts.

**Mesuré**
- Chromium (analyseur branché sur la sortie, musique seule, intensité forcée par la chaleur) : partie au calme, crête 0,035 et moyenne quadratique 0,003 ; pleine intensité, crête 0,108 et 0,006 ; menu, crête 0,045 ; fanfare, crête 0,15. Bruitages d'une vraie mêlée : crête 0,61. La musique reste nettement sous les bruitages, aucune saturation, aucune erreur de console.
- Vraie mêlée de 18 élèves à l'écran : intensité 1 en moins de 2 s.
- `perf240` (inchangé par construction, la simulation n'est pas touchée) : partie 0,243 ms par pas, mêlée 0,144, ordres 0,218, rendu 2,18 ms ; mêmes valeurs à 10 % près que le code d'hier relancé à la suite (0,237, 0,134, 0,199, 2,52). Témoin non relancé : `World` et les IA ne bougent pas, l'humeur se calcule hors simulation et sans hasard.
- Déploiement : run n° 48 « Déploiement GitHub Pages » réussi (tests, build, `deploy-pages`). Le site lui-même n'est pas joignable depuis le bac à sable de la session (proxy) : pas de vérification directe de la page.
- Captures 844 × 390 (×3) : rubrique « Sensations » propre avec « Tremblement » et « Musique » alignés, boutons de 44 px ; partie en mêlée sans changement visuel.

**Reste à faire, inquiétudes**
- Je n'ai pas pu écouter : les niveaux sont mesurés, pas le goût. Le thème de partie tourne en boucle de 7,3 s ; sur une partie de 8 minutes, il peut lasser. Prochaine étape possible : une seconde phrase (variation B) qui alterne avec la première.
- Le haut-parleur d'iPhone rend mal les basses : la grosse caisse (42 à 140 Hz) sera surtout entendue au casque. La caisse claire et le charleston portent le rythme sur le haut-parleur.
- Prochaine session : saison 2, lisibilité (motifs en plus des couleurs pour le daltonisme, contours d'équipe, contraste des cases).

## 16/11/2026 : session de développement, v5.17 (saison 2, coups qui « claquent »)

**Fait**
- Aucun retour d'Aloys par e-mail (les douze journaux des 14 derniers jours sont sans réponse). Travail du jour : premier point de la saison 2, « Coups qui claquent », en entier. Point de retour : branche `avant-2026-11-16`.
- `src/core/impact.ts` : `impactPose` (éclair blanc de 0,11 s, recul de 0,16 s dans le sens du coup projeté en isométrie, 3,5 px ou 9 px sur un KO, écrasement de 14 %), `koStars` (trois étoiles en ronde, fondu d'entrée et de sortie, déphasées par élève), `BrawlHeat` (chaleur des bagarres visibles : +0,035 par coup, +0,22 par KO, retombe de 0,55 par seconde ; tremblement d'un KO de 1,2 à 5 px, plus long au-delà de 0,6), `noteImpact`.
- Le monde note `hitAt`, `hitDx`, `hitDy` sur l'élève touché (coups de poing, surveillants, boules de neige), sans tirage au hasard : la simulation est strictement la même.
- Rendu : éclair par une silhouette blanche calculée une fois par planche, recul et écrasement au tracé du sprite (le pion encaisse : recul réduit, pas d'écrasement), étoiles jaunes cernées au-dessus de la tête. Effets : tremblement dosé par la chaleur, « Mêlée ! » rose quand une grosse bagarre éclate (une fois toutes les 4 s au plus), son « melee » (trois voix « Ouuuh ! » et un tambour).
- Pause : rubrique « Sensations », « Tremblement : Activé / Coupé » (boutons de 44 px), mémorisé dans la sauvegarde (champ facultatif `shake`, anciennes sauvegardes intactes), disponible partout, y compris en Difficile, Expert et dans le tutoriel.
- « Comment jouer » : rubrique « Bagarres » dans le chapitre des bases. README (règle, contrôles, mesures, versions, architecture). Pas d'étape de tutoriel : aucun geste nouveau.
- 16 nouveaux tests (`impact.test.ts`, `impact-app.test.ts` qui fait se battre deux élèves dans l'application puis coupe et rallume le tremblement dans la pause) ; 466 tests verts.

**Mesuré**
- Témoin humain, Normal, 4 équipes, 800 parties, graine 1 : 49,9 % (± 3,5), identique à la v5.15 ; ordres par minute IA 14,8, témoin 16,9. Confirme que rien ne touche à la partie.
- `perf240` : partie 0,228 ms par pas, mêlée 0,125, ordres 0,176 ; rendu à 240 élèves 2,14 et 2,27 ms par image contre 2,02 et 2,42 avant (même machine, en alternance) : pas de régression.
- Captures 844 × 390 (×3) : éclair blanc net, « Mêlée ! » lisible, rubrique « Sensations » propre sous « Rythme ». Repéré et corrigé : les premières étoiles des KO étaient de petites croix de 6 px confondues avec les étincelles de coup et l'étoile des bons points ; ce sont maintenant des étoiles à cinq branches plus grandes, citron, au-dessus de la tête.

**Reste à faire, inquiétudes**
- Le ressenti se juge sur un vrai iPhone : l'amplitude du tremblement en grosse mêlée (5 px) peut sembler forte en zoom serré. Le réglage permet de le couper ; à réduire si Aloys le trouve trop.
- Les onomatopées existantes deviennent floues en fin de fondu dans les captures (déjà le cas en v5.16) ; idée notée dans la feuille de route.
- Prochaine session : saison 2, musique synthétisée qui s'intensifie avec les bagarres (la chaleur des bagarres de ce soir pourra la piloter).

## 15/11/2026 : session de développement, v5.16 (Mode Équipes, suite)

**Fait**
- Aucun retour d'Aloys par e-mail (les onze journaux des 14 derniers jours sont sans réponse). Travail du jour : « Mode Équipes, suite », premier point non coché de la feuille de route (il venait de sa demande du 05/11 et attendait derrière la saison 1) ; les coups qui « claquent » passent à la prochaine session. Point de retour : branche `avant-2026-11-15`.
- `src/core/spectate.ts` : `endCheck` (en cours, spectateur, ou fin avec victoire partagée ou non), `teammatesOf`, `spectateFocus` (centre du plus gros paquet d'élèves d'un coéquipier, à défaut son camp, tour à tour), `SPECTATE.fastSpeed` (×2). En partie libre, rien ne change.
- `Game` : `spectating`, `spectateFast`, `sharedWin`, `leftSpectating`, `watchTeammate`, `toggleSpectateFast`, `leaveSpectating`. En spectateur : sélection vidée, consignes et pouvoirs désarmés, pause tactique levée, plus d'alertes, caméra sur le coéquipier ; son « spectate » (deux notes qui tombent puis un appel qui remonte et deux claquements), vibration.
- Interface : bandeau « Spectateur » en bas au centre (liseré doré, « Tu es KO : les Violets jouent pour l'équipe »), boutons de 44 px « Regarder » (à la couleur du coéquipier), « ×2 » (bleu glacé allumé), « Terminer » ; commandes de jeu masquées, halo doré discret. Écran de fin « Victoire de l'équipe ! » ou « Tes coéquipiers sont tombés à leur tour. Revanche ? », ou « Tu as quitté la partie avant la fin ».
- « Comment jouer » (rubrique « Mode Équipes »), description du menu d'escarmouche (« victoire partagée, même si tu es KO »), README. Pas d'étape de tutoriel (le tutoriel n'a pas d'équipes).
- `equilibre.ts` : `equipesfixes=N` (alliances verrouillées, mesure du spectateur et de l'ancienne règle).
- 13 nouveaux tests (`equipes-spectateur.test.ts`, `equipes-spectateur-app.test.ts` qui met le joueur KO dans l'application, accélère, regarde, fait gagner le coéquipier, rejoue et quitte, puis vérifie la partie libre) ; 450 tests verts.

**Mesuré**
- Témoin humain et IA en Normal, 2 contre 2 (800 parties) : le témoin gagne 63,0 % (62,4 % avec l'ancienne règle) ; il est spectateur dans 18,8 % des parties, et son équipe n'en gagne que 3,3 %. 3 contre 3 (400 parties) : 48,5 % (47,8 %), spectateur 32,8 %, dont 2,3 % gagnées.
- `perf240` : partie 0,233 ms par pas, mêlée 0,113, ordres 0,178, rendu 1,2 à 1,9 ms : inchangé (la simulation n'est pas touchée).
- Captures 844 × 390 : bandeau lisible sur une ligne, boutons nets, aide sur une ligne au-dessus ; repéré et corrigé : une alerte « Camp perdu ! » restait affichée au passage en spectateur, et la description du menu laissait un mot seul en dernière ligne.

**Reste à faire, inquiétudes**
- Le spectateur rend la fin moins brutale, mais l'équipe d'un joueur KO perd presque toujours : regarder trois minutes une défaite annoncée peut lasser. « ×2 » et « Terminer » sont là pour ça ; piste (à valider par Aloys) : un « repêchage » où un coéquipier IA cède un camp au joueur KO.
- En 2 contre 2, le témoin gagne 63 % en Normal : l'IA coéquipière porte beaucoup. Le mode Équipes est plus facile que la partie libre ; à surveiller si Aloys trouve ça trop simple.
- Prochaine session : la saison 2, par les coups qui « claquent » (impact, recul, étoiles de KO, petit tremblement désactivable).

## 14/11/2026 : session de développement, v5.15 (1.7, bilan de la saison 1)

**Fait**
- Aucun retour d'Aloys par e-mail (les dix journaux des 14 derniers jours sont sans réponse). Travail du jour : 1.7 Bilan saison 1, en entier. Point de retour : branche `avant-2026-11-14`.
- Simulations d'ensemble sur le code de la v5.14 : témoin humain contre les quatre difficultés, témoin « outillé » (conquête et défense), couleurs à 4 IA Normal sur deux graines. Aucun réglage changé : Normal est dans la cible.
- Tutoriel : 14 étapes. Nouvelle étape « conquer » après « Garder » : trois recrues sortent du camp (`TutorialState.recruits`), la main les montre tant qu'aucune n'est sélectionnée, puis montre le drapeau ; les gardes restent à leur poste. L'écran « Tutoriel réussi ! » renvoie vers « Comment jouer », chapitre « Tes outils ».
- « Comment jouer » : quatre chapitres (`HOW_TO_CHAPTERS`) avec une barre d'onglets collée en haut (44 px, violet allumé, suit le défilement) : Bases, Progresser, Tes outils, Adversaires. Nouvelle rubrique de synthèse « Quel outil pour quoi ? » dans un encadré jaune.
- Écran de fin : « Durée de la partie : 4 min 05 s, 3 pauses tactiques » (`durationLine`), seulement s'il y en a eu.
- Typographie : `insecables()` pose des espaces insécables dans les guillemets et devant « : ; ! ? » (bulles du tutoriel, « Comment jouer ») ; repéré en capture, un « « » restait seul en bout de ligne.
- 8 nouveaux tests (`bilan-saison1.test.ts`), tests du tutoriel mis à jour (14 étapes, étape « Conquérir » au doigt dans l'application) ; 437 tests verts.

**Mesuré**
- Témoin humain, 800 parties par ligne : Facile 98,0 %, Normal 49,9 %, Difficile 13,5 %, Expert 3,4 %. Ordres par minute des IA : 8,4, 14,8, 22,2, 31,5 ; témoin 13,6 à 20,0.
- Témoin outillé (conquête de 4, défense de 6) en Normal : 52,8 %.
- Couleurs à 4 IA Normal, 2 000 parties : Rose 29,1 et 29,2 %, Orange 21,4 et 20,9 % sur les deux graines ; les six autres entre 21,3 et 26,9 %.
- `perf240` : partie 0,225 ms par pas, mêlée 0,123, ordres 0,194, rendu 1,8 à 2,1 ms : inchangé.
- Captures 844 × 390 : onglets lisibles, synthèse des outils sur toute la largeur, bulle de l'étape « Conquérir » qui ne cache ni les recrues ni le bouton.

**Reste à faire, inquiétudes**
- Rose un peu trop forte et Orange un peu faible en Normal (les valeurs d'un point ont été réglées en Difficile). Écart régulier mais modeste ; à reprendre avec plusieurs graines, sans toucher au budget de 12 points.
- Dernier chapitre de « Comment jouer » : il ne peut pas remonter tout en haut (fin de la carte), son titre arrive juste sous les onglets. Lisible, mais à soigner si on ajoute un chapitre.
- Premier déploiement de la v5.15 en échec : `escouades-suivre-app.test.ts` (v5.13) dépendait du hasard (sans graine, une rencontre au centre mettait parfois tout un groupe KO, d'où un centre de groupe NaN). Corrigé dans le test (ennemis dispersés, groupes solides, seul le suivi est mesuré), puis redéployé.
- Les parties simulées durent 3 minutes en moyenne ; une vraie partie humaine dure plus, mais le pilier « 5 à 12 minutes » mériterait une mesure en vrai.
- Prochaine session : la saison 1 est close. J'ouvre la saison 2 (sensations et lisibilité) par les coups qui « claquent » ; « Mode Équipes, suite » (spectateur quand on est éliminé) reste en attente juste derrière.

## 13/11/2026 : session de développement, v5.14 (1.6, rythme réglable)

**Fait**
- Aucun retour d'Aloys par e-mail (les neuf journaux des 14 derniers jours sont sans réponse). Travail du jour : 1.6 Rythme réglable, en entier. Point de retour : branche `avant-2026-11-13`.
- `src/core/tempo.ts` : `tempoAllowed` (Facile et Normal, jamais dans le tutoriel), `speedFactor` (0,75 en vitesse lente, toujours 1 en Difficile et Expert), `attentionAtSpeed` (attention d'un humain exprimée en temps de jeu), `TacticalPause` (bascule, nombre de pauses, temps réel figé).
- `Game` : `tactical`, `speed`, `setTactical`, `toggleTactical`, `setSpeed`. Cour figée : plus aucun pas de simulation, mais sélection, ordres, consignes, achats et pouvoirs passent ; repères d'ordre et HUD continuent de vivre. Vitesse lente : la boucle à pas fixe reçoit 0,75 s de jeu par seconde réelle (caméra et défilement restent à vitesse réelle).
- Interface : sablier entre « Fuir / Charger » et le son ; figé, il devient ▶ bleu glacé qui pulse, liseré bleu autour de la cour et bandeau « Pause tactique · donne tes ordres » avec « Reprendre ». Sons « Un, deux, trois, soleil ! » (trois notes qui se figent) et reprise (glissando, claquement), vibrations, aide au premier usage. Rubrique « Rythme » dans la pause : vitesse Normale / Lente ×0,75, sablier affiché / masqué (boutons de 44 px), mémorisés dans la sauvegarde (champs facultatifs, anciennes sauvegardes intactes). En Difficile et Expert, la rubrique dit que c'est réservé à Facile et Normal.
- « Comment jouer » : rubrique « Rythme ». README (règle, contrôles, équilibrage, versions, architecture). Pas d'étape de tutoriel : c'est une option, et le tutoriel tourne toujours à pleine vitesse.
- `equilibre.ts` : `vitesse=0.75` (le témoin garde ses ordres par minute réelle).
- 8 nouveaux tests (`tempo.test.ts`, `tempo-app.test.ts` qui fige la cour, donne un ordre, vérifie que rien ne bouge puis que tout repart, règle la vitesse dans la pause) ; 429 tests verts. Attention : j'avais d'abord écrasé `tests/rythme.test.ts` (rythme de partie, v4) par erreur ; rattrapé avant le commit, mes tests s'appellent `tempo*`.

**Mesuré**
- Témoin humain, Normal, 800 parties par ligne : vitesse normale 49,9 % (graine 1) et 52,0 % (graine 2) ; vitesse lente 54,0 et 56,3 %. La vitesse lente vaut environ 4 points : aide réelle, Normal reste près de la cible.
- Ordres par minute (de jeu) : témoin 16,7 à 16,9 à vitesse normale, 22,1 à 22,2 en vitesse lente ; IA 14,7 à 14,8.
- `perf240` : la simulation ne change pas ; trois passages entre 0,111 et 0,194 ms par pas, rendu 0,9 à 2,5 ms par image, dans le bruit (le code du rythme n'est que dans la boucle d'images de l'application).
- Captures 844 × 390 : sablier lisible, ▶ bleu net en pause tactique, bandeau centré qui ne touche ni les puces ni les boutons même à 8 équipes, rubrique « Rythme » propre dans la pause.

**Reste à faire, inquiétudes**
- La pause tactique est illimitée : en Normal, un joueur patient peut tout microgérer à l'arrêt. C'est voulu (piliers 1 et 3), mais si Aloys trouve que ça enlève la tension, piste : la limiter (trois par partie, ou une recharge).
- Le réglage de vitesse ne se fait que dans la pause ; une rubrique « Rythme » au menu principal serait plus découvrable.
- Prochaine session : 1.7 Bilan saison 1 (simulations d'ensemble, réglages fins, tutoriel et « Comment jouer » relus pour tous les nouveaux gestes), puis la saison 2.

## 12/11/2026 : session de développement, v5.13 (1.5 c, consigne « Suivre »)

**Fait**
- Aucun retour d'Aloys par e-mail (les huit journaux des 14 derniers jours sont sans réponse). Travail du jour : 1.5 c Suivre, dernière tranche des escouades (« Mode Équipes, suite » reste une idée du studio, derrière la saison 1). Point de retour : branche `avant-2026-11-12`.
- `src/core/squads.ts` : mode « follow », `assignEscort` (protégé par identifiants et, s'il en a une, par escouade : ses futurs membres sont protégés aussi), `escortWard`, `thinkEscort` (rejoint le protégé au-delà de 2,2 cases plus son étalement, attaque l'ennemi visible à moins de 3 cases d'un protégé, laisse de 4,5 cases, dispersion quand plus personne n'est debout). `World.escortsEnded` prévient l'interface.
- Interface : bouton « Suivre » (rond vert à double chevron) sur la rangée de « Camp » et « Garder ». Il s'arme comme « Garder » ; le tap suivant sur un de ses élèves désigne le protégé (son escouade, sinon son groupe 1-2-3, sinon ses voisins), ou un tap sur un bouton 1-2-3 (liseré vert pendant l'attente). Écusson vert au-dessus du protégé, tirets quand l'escorte traîne, petit écusson vert en haut à gauche des groupes en escorte. Son « Avec toi ! » (deux claquements de mains, petite tierce), vibration, aides.
- « Comment jouer » : rubrique « Escorte ». README (règle, contrôle, équilibrage, versions, architecture). Pas d'étape de tutoriel, comme les deux autres consignes.
- `equilibre.ts` : `suivre=N` (escorte attachée à l'escouade en conquête du témoin).
- 10 nouveaux tests (`escouades-suivre.test.ts`, `escouades-suivre-app.test.ts` qui arme le bouton, touche un groupe puis un élève dans l'application) ; 421 tests verts.

**Mesuré**
- Témoin humain, Normal, 800 parties par ligne : conquête de 4 seule 52,6 % ; escortée par 4 : 47,4 % (graine 1) et 45,3 % (graine 2) ; escortée par 2 : 45,1 % ; conquête de 8 : 48,5 %. Comme les autres consignes, immobiliser des élèves coûte au témoin : outil de confort, pas de déséquilibre, Normal reste dans la cible.
- Ordres par minute : témoin 16,4 à 17,0, IA 14,7 à 14,8 (inchangés).
- `perf240` en alternance avec la v5.12 : partie 0,198 / 0,208 ms par pas contre 0,232 / 0,214 : pas de régression.
- Captures 844 × 390 : rangée « Camp, Garder, Suivre » de 148 px qui ne touche ni la carte ni l'aide, bouton armé lisible, écusson vert net au-dessus du groupe escorté.

**Reste à faire, inquiétudes**
- Le point 1.5 est fini : trois consignes, trois couleurs (corail, bleu, vert). La colonne de gauche commence à être chargée ; si Aloys s'y perd, piste : regrouper les trois consignes derrière un seul bouton « Consigne ».
- Désigner le protégé par un tap demande un groupe visible ; les boutons 1-2-3 couvrent le cas d'un groupe hors de l'écran.
- L'escorte qui suit un groupe en retraite le suit aussi en retraite, mais en chargeant (elle se bat en chemin) : à juger en vrai.
- Prochaine session : 1.6 Rythme réglable (vitesse ×0,75 en Facile et Normal, pause tactique avec ordres).

## 11/11/2026 : session de développement, v5.12 (1.5 b, consigne « Défendre »)

**Fait**
- Aucun retour d'Aloys par e-mail (les sept journaux des 14 derniers jours sont sans réponse). Travail du jour : 1.5 b Défendre, deuxième tranche des escouades. Point de retour : branche `avant-2026-11-11` (le dépôt refuse toujours les tags).
- `src/core/squads.ts` : `Squad.mode` (« conquer » ou « defend »), `zone`, `post`. `defenceZone` (case où se tient l'escouade, puis ses cases à 7 cases au plus, 4 au total), `zonePost` (case la plus centrale), `defenceTarget` (case avec ennemis visibles, perdue ou en train d'être prise ; ignore une case trop défendue ; hystérésis), `thinkDefence` (secours, engagement des intrus, laisse de 4,2 cases, retour au poste), `defenderArmor` (retranchés comme les gardes dans leur secteur, « Paré ! »). Les escouades en conquête ne changent pas.
- Interface : les deux consignes d'escouade ont leur rangée (« Conquérir », « Défendre ») sous « Camp » et « Garder » ; boutons ramenés à 46 px sous 420 px de haut pour que la colonne tienne. « Défendre » allumé en bleu, petit bouclier bleu à gauche des groupes 1-2-3 en défense ; au sol, tirets du poste vers les cases du secteur, bouclier planté sur le poste, bouclier bleu « ! » et tirets bleus vers la case secourue ; zones défendues dessinées quand l'escouade est sélectionnée. Son « Serrez les rangs ! » (sifflet, deux pas), vibration. « Défendre » sur une escouade en conquête change sa consigne. Aide refusant l'ordre loin de ses cases, avertissement sous 4 élèves.
- L'aide en bas de l'écran laisse libre la colonne des contrôles (largeur maximale réduite de 268 px).
- « Comment jouer » : rubrique « Défense ». README (règle, contrôle, équilibrage, versions, architecture). Pas d'étape de tutoriel, comme « Conquérir ».
- `equilibre.ts` : `defense=`, `defenseou=`, `defenseseuil=`, `retranche=` ; la reformation de l'escouade en conquête ne confond plus les deux consignes.
- 13 nouveaux tests (`escouades-defense.test.ts`, `escouades-defense-app.test.ts` qui touche les boutons dans l'application) ; 411 tests verts.

**Mesuré**
- Témoin humain, Normal, 800 parties par ligne : sans escouade 49,9 % (graine 1) et 52,0 % (graine 2). Défense de 4 retranchée : 46,3 et 46,0 % (44,1 sans retranchement) ; défense de 6 retranchée : 49,1 et 51,1 %. Une escouade de 2 formée très tôt : 34,9 %. Pas de déséquilibre : la consigne est un outil de confort, pas un gain.
- Ordres par minute : témoin 16,3 à 16,9, IA 14,7 à 14,9 (inchangés).
- `perf240` en alternance avec la v5.11 : partie 0,223 / 0,223 ms par pas contre 0,224 / 0,221 : pas de régression.
- Captures 844 × 390 : colonne de 5 rangées entre les puces et « Tout sélectionner » sans chevauchement, aide centrée qui ne touche plus les boutons, bouclier « ! » lisible sur une case disputée.

**Reste à faire, inquiétudes**
- Le secteur est choisi automatiquement autour de l'escouade : il faut l'amener près des bonnes cases avant de toucher « Défendre ». Si c'est trop rigide pour Aloys, piste notée : régler le secteur au doigt.
- La colonne de gauche compte maintenant 5 rangées ; sur un iPhone plus petit (SE en paysage, 375 px de haut), à vérifier en vrai.
- Le bouclier « ! » est bleu : pour un joueur Bleu, il reste lisible grâce au « ! » et au liseré blanc, mais moins distinct.
- Prochaine session : 1.5 c Suivre (escorte d'un autre groupe), qui clôt les escouades.

## 10/11/2026 : session de développement, v5.11 (1.5 a, consigne « Conquérir »)

**Fait**
- Aucun retour d'Aloys par e-mail (les six journaux des 14 derniers jours sont sans réponse). Travail du jour : 1.5 Escouades à consigne, découpé en trois tranches dans la feuille de route ; ce soir la première, « Conquérir ». Point de retour : branche `avant-2026-11-10`.
- `src/core/squads.ts` : escouades (`World.squads`, `Unit.squad`), choix de la case (`conquestTarget` : cases libres seulement, distance, défenseurs visibles ×2,5, jamais vue +4, camp ou trône −3, portée 22 cases), renoncement 12 s à une case trop défendue (plus de 1,25 défenseur par élève, plus un), enchaînement des prises, membres libérés par tout autre ordre (`orderMove`, `orderAttack`, garde), escouade vide supprimée. Respecte le brouillard (ne voit pas les défenseurs cachés).
- Interface : bouton « Conquérir » (drapeau) à droite de « Garder », allumé en corail quand la sélection est en conquête, retoucher lève la consigne ; petit drapeau sur les boutons « 1 », « 2 », « 3 » dont la majorité est en conquête ; drapeau planté à ta couleur sur la case visée, tirets depuis l'escouade. Son « À l'assaut ! » (roulement de tambour et clairon), vibration. Aides en bas de l'écran.
- « Comment jouer » : rubrique « Conquête ». README (règle, contrôle, équilibrage, versions, architecture). Pas d'étape de tutoriel : c'est une consigne, pas un geste de base (comme les renforts).
- `TeamAi.conquestSize` et options `conquete=`, `iaconquete=`, `casesennemies=`, `pause=` dans `equilibre.ts` (les IA n'utilisent pas l'outil en partie).
- 14 nouveaux tests (`escouades.test.ts`, `escouades-app.test.ts` qui touche le bouton dans l'application) ; 398 tests verts.

**Mesuré**
- Première version (cases ennemies comprises) : témoin humain 49,9 % → 68,9 % (graine 1) et 52,0 → 67,1 % (graine 2) avec une seule escouade de 4. Beaucoup trop fort : les IA ne reprennent pas leurs cases éloignées. Exclure les camps ennemis ne change rien, une pause de 8 s après chaque prise ramène à 57,6 %, donner l'outil aux IA à 65,5 %. Retenu : **cases libres seulement**, 52,4 % et 53,4 % (+1,5 à +2,5 points), dans la cible de 45 à 55 %.
- Ordres par minute du témoin inchangés (16,5 à 17,1), IA 14,6 à 15,0.
- `perf240` sur la même machine, en alternance avec la version d'avant : partie 0,247 et 0,249 ms par pas contre 0,265 et 0,250 avant : pas de régression (les escouades ne coûtent rien quand il n'y en a pas, une réflexion par escouade toutes les 0,5 s sinon).
- Captures 844 × 390 : bouton lisible (libellé 10 px sur 60 px de large), drapeau du groupe, drapeau de la case visée visible ; « Comment jouer » : guillemets insécables dans la nouvelle rubrique.

**Reste à faire, inquiétudes**
- En milieu de partie, il reste peu de cases libres : l'escouade attend alors sans rien faire (le bouton reste allumé, plus de drapeau sur la carte). À juger par Aloys ; piste : la renvoyer d'elle-même au ralliement, ou afficher « rien à prendre » sur le groupe.
- Le vrai enseignement de la nuit : les IA laissent leurs cases éloignées sans défense et tardent à les reprendre. Un humain attentif peut l'exploiter à la main. Idée notée dans la feuille de route.
- Prochaine session : 1.5 b Défendre (garnison mobile sur plusieurs cases voisines).

## 09/11/2026 : session de développement, v5.10 (1.1 bis, gardes retranchés)

**Fait**
- Aucun retour d'Aloys par e-mail (les cinq journaux des 14 derniers jours sont sans réponse). Travail du jour : 1.1 bis, reporté deux fois, premier point non coché de la saison 1 (« Mode Équipes, suite » reste une idée du studio). Point de retour : branche `avant-2026-11-09`.
- `src/core/ai.ts` : `selfRescue` ('all' par défaut, 'camps', 'none') et `harassSize` (petit groupe sur un second front, case sans ennemi visible à 3,5 cases, à 5 cases au moins de la cible principale, seulement si l'armée libre dépasse deux groupes). Par défaut, les IA ne changent pas.
- `scripts/dev/equilibre.ts` : `secours=`, `harcele=`, `style=humain`, `rayon=`, `laisse=`, `armure=`, résumé du style du témoin dans la sortie.
- Résultat des mesures : rayon et laisse ne changent rien, mais une garnison coûte cher. Nouveauté de jeu : **gardes retranchés** (`GARRISON.armor` = 0,75, `guardArmor()`), événement `hit` marqué `parried`, onomatopée « Paré ! » bleue (une fois sur 4), son « parry » plus sec. « Comment jouer » (Garnisons) et README à jour.
- Contrôle visuel : l'aide en bas de l'écran (« Touche un élève puis le sol… ») recouvrait « Tout sélectionner » et les pouvoirs en 844 × 390 ; elle passe au-dessus de la rangée du bas, sur deux lignes au besoin.
- 10 nouveaux tests (`temoin-humain.test.ts`, `garnisons-armure.test.ts`) ; 384 tests verts.

**Mesuré**
- Témoin en Normal, 800 parties par ligne : classique 40,5 %, classique avec renforts 46,9 %, humain 49,9 % (graine 1) et 52,0 % (graine 2), humain sans second front 50,2 %.
- Garnisons (2 gardes par case bonus, 30 % de l'armée) : 30,9 % et 28,0 % ; retranchés : 34,3 % (×0,7) et 33,5 % (×0,75). À 15 % de l'armée : 42,8 % sans, 41,9 % avec (pas d'effet).
- `perf240` : partie 0,222 ms par pas (0,221), mêlée 0,093 : pas de régression.

**Reste à faire, inquiétudes**
- La garnison reste un outil de confort, pas un gain de victoires en simulation : le témoin garde toutes ses cases bonus, ce qu'un bon joueur ne fait pas. Prochaine étape possible : un témoin qui ne garde que les cases clés.
- « Paré ! » s'ajoute aux onomatopées ; à juger par Aloys dans une grosse mêlée (une fois sur 4 seulement, mais les gardes encaissent beaucoup).
- Prochaine session : 1.5 Escouades à consigne, première tranche (consigne « Conquérir » pour les groupes 1-2-3).

## 08/11/2026 : session de développement, v5.9 (retours d'Aloys du 07/11)

**Fait**
- Pas de réponse par e-mail aux journaux ; les trois retours du 07/11 (transmis par la conversation, à traiter en priorité) font la v5.9. Point de retour : branche `avant-2026-11-08`.
- Compteur d'élèves : `src/core/headcount.ts` (effectifs vus par le joueur : tout sans brouillard, ennemis visibles seulement avec, alliés toujours en entier, cases et camps selon la dernière observation, pions exclus). Puces du HUD : la sienne « 18/30 » (jaune au plafond), œil devant les effectifs « en vue » au lieu de « ? ». Toucher sa propre puce ouvre « Effectifs » (tableau élèves, cases, camps, bouton × de 44 px), refermé par la pause, la fin de partie et l'ouverture de la diplomatie. Son « select » à l'ouverture.
- Tutoriel : `stepText()` et `TutorialState.text` remplacent « {ennemis} » par le vrai pluriel de l'adversaire ; commentaires et README sans « Verts » figés.
- Bulle du tutoriel : `src/ui/bubble-place.ts` (logique pure : places candidates, gêne pondérée, hystérésis) branché dans `tutorial-ui.ts` ; repère invisible `.tuto-probe` pour les encoches. Étape « upgrade » panneau ouvert : consigne « Touche le bouton jaune de « Production » ».
- « Comment jouer » : rubrique « Effectifs ». README (règle, geste, versions, architecture).
- 12 nouveaux tests (`v59.test.ts`, `v59-app.test.ts` qui touche les puces dans l'application, assertion ajoutée au parcours du tutoriel) ; deux tests du HUD mis à jour (« ? » remplacé par le nombre en vue). 374 tests verts.

**Mesuré**
- Recompte des effectifs : 0,035 ms à 252 élèves sous brouillard, 4 fois par seconde : négligeable.
- `perf240` : partie 0,221 ms par pas (0,219 hier), mêlée 0,121 (identique) : pas de régression. Pas de simulation d'équilibre : aucune règle de jeu ne change.
- Captures 844 × 390 des 13 étapes du tutoriel (joueur Rouge et Noir) : plus aucune cible ni bouton utile sous la bulle ; panneau « Effectifs » à 8 équipes entièrement visible sans défilement.

**Reste à faire, inquiétudes**
- Sous le brouillard, le détail ne dit rien des effectifs complets ennemis : c'est voulu (pas de triche), mais Aloys voulait peut-être le total. S'il le demande : afficher « ≈ » d'après le dernier aperçu.
- La puce du joueur s'élargit un peu (« 18/30 ») ; à 8 équipes les puces tiennent encore sur une ligne en 844 px, à surveiller sur iPhone SE (667 px).
- Prochaine session : 1.1 bis (témoin plus humain), reportée d'un jour.

## 07/11/2026 : session de développement, v5.8 (renforts automatiques)

**Fait**
- Aucun nouveau retour d'Aloys par e-mail (les trois fils du journal n'ont pas de réponse). Travail du jour : 1.3 Renforts automatiques, comme prévu et validé par Aloys le 05/11 (v5.8). « Mode Équipes, suite », en tête de la feuille de route, est une idée du studio, pas une demande : elle attend derrière la saison 1.
- `src/core/reinforce.ts` : menace d'une case (ennemis à moins de 2,6 cases, pions compris, plus 6 × la jauge de capture ennemie), case secourue par un camp (la plus menacée, camp +3, intérêt divisé par deux à 7 cases, rien au-delà de 16 cases), envoi du nouvel élève en mode Charger vers une place libre de la case. Rien de menacé : ralliement habituel ; camp lui-même le plus menacé : l'élève reste. `World` : `setReinforce`, `reinforceOn` (l'option tombe avec le camp), `reinforceTargetOf`, cibles rafraîchies toutes les 0,5 s pour l'affichage.
- Interface : ligne « Renforts » dans la zone « Ce camp » du panneau, interrupteur « Auto » (vert quand actif, `role="switch"`), bouton « Partout » (tous les camps), ligne d'état (« En route vers la case ♠. », « Prêts : rien de menacé. »). Pointillé animé à chevrons du camp vers la case secourue et « + » cerclé au-dessus d'elle. Son « clairon » et vibration à l'activation.
- « Comment jouer » : rubrique « Renforts », rubrique « Améliorations » complétée. README (règle, équilibrage, versions, architecture). Pas d'étape de tutoriel : c'est une option, pas un geste.
- `equilibre.ts` : option `renforts=1` pour le témoin.
- 10 nouveaux tests (`renforts.test.ts`, `renforts-app.test.ts` qui joue l'interrupteur au doigt dans l'application) ; 362 tests verts.

**Mesuré**
- Témoin en Normal (800 parties, même graine) : 40,5 % sans renforts, 46,9 % avec (± 3,5), ordres par minute inchangés (17,5 et 17,4), parties un peu plus courtes (188 → 180 s). Les IA ne s'en servent pas : équilibre entre IA inchangé.
- `perf240` : partie 0,219 ms par pas contre 0,224 avant sur la même machine, mêlée 0,121 contre 0,136 : pas de régression.
- Contrôle visuel (844 × 390, ×3) : pointillé lisible, ligne « Renforts » en bas du panneau, accessible en faisant défiler (comme avant pour les dernières lignes).

**Reste à faire, inquiétudes**
- Le panneau du camp devient long en paysage : la ligne « Renforts » est la dernière et demande un petit défilement. À regrouper un jour (Ralliement et Renforts sur une même ligne, ou onglets).
- Un renfort part seul : contre un gros groupe, il peut tomber en chemin. C'est le prix de l'automatisme ; à juger en vrai par Aloys. Piste : n'envoyer que par paquets de 2 ou 3.
- Prochaine session : 1.1 bis (témoin plus humain, qui ne secourt plus ses cases lui-même mais utilise garnisons et renforts) pour chiffrer le vrai gain de ces outils.

## 06/11/2026 : même session, seconde livraison, v5.7 (alertes)

**Fait**
- Point 1.4 de la feuille de route, comme Aloys l'a validé pour cette nuit, après la v5.6 poussée et déployée.
- `src/core/alerts.ts` : `AlertWatcher` examine les cases du joueur toutes les 0,25 s. Menace = ennemi (pas un allié) à moins de 2,6 cases ou jauge ennemie qui monte, pendant plus de 2 s ; camp menacé = alerte « camp » ; case passée à l'ennemi = « perdue ». Une case n'est signalée qu'une fois par attaque (12 s de calme pour réarmer), 6 s au moins entre deux alertes, regroupement (« 3 cases attaquées », « Ton camp est attaqué, et 2 autres cases ! ») en pointant la plus urgente ; l'autre famille (pertes ou menaces) attend l'alerte suivante.
- Interface : bandeau en haut au centre sous les mini-barres de bagarre (jaune, rouge pulsant pour le camp, bordeaux pour une perte), icône, bouton « Y aller » ; toucher le bandeau fait glisser la caméra sur la case avec un marqueur. Son « ding-dong » discret, vibration pour le camp et les pertes. Pas d'alerte dans le tutoriel. Le bandeau disparaît à la pause, à la fin et au menu.
- « Comment jouer » : rubrique « Alertes ». README à jour. Nouvel outil `scripts/dev/alertes.ts` (fréquence des alertes en parties IA contre IA).
- 7 nouveaux tests (`alertes.test.ts`, `alertes-app.test.ts` : bandeau puis tap dans l'application) ; 352 tests verts.

**Mesuré**
- Fréquence (20 parties Normal à 4 équipes, l'équipe 0 jouée par une IA) : premier réglage (1,2 s, 4 s, 8 s) 4,6 alertes par minute, écart médian 6,3 s, trop bavard ; retenu (2 s, 6 s, 12 s) 3,6 par minute (camp 0,3, pertes 1,3, attaques 2,0), écart médian 8,3 s.
- Coût : 0,025 ms par examen à 240 élèves et 38 cases, un examen toutes les 0,25 s : négligeable.

**Reste à faire, inquiétudes**
- 3,6 alertes par minute reste vivant ; une IA perd plus de cases qu'un joueur attentif. À juger en vrai par Aloys ; piste : ne plus signaler les cases ♦ et ♣ secondaires, ou une option « alertes discrètes ».
- Prochaine session : 1.3 Renforts automatiques (v5.8), puis 1.1 bis.

## 06/11/2026 : session de développement, v5.6 (demandes d'Aloys)

**Fait**
- Pas de nouveau message d'Aloys par e-mail ; ses cinq demandes du 05/11 (transmises par la conversation, à traiter en priorité) font la v5.6, livrée seule d'abord.
- Difficulté : Normal dégâts ×0,95 et 42 % de défenseurs ; Difficile ×1,05 et Expert ×1,2 pour garder l'échelle (`AI_PROFILES`).
- Abandon : bouton « Abandonner » dans la pause, confirmation dans la page, `Game.surrender()` (résultat `abandon`), écran de fin « Abandon » avec le tableau de statistiques ; rien de débloqué, pas de médaille, absent du tutoriel.
- Tap hors de la cour : `Grid.orderPoint` ramène le point au bord ou au coin le plus proche puis à une cellule libre ; utilisé par le tap, la flèche d'ordre (même chemin) et le ralliement (`setCampRally` ne refuse plus un point hors de la cour).
- Mode Équipes : `src/core/teams.ts` (tailles possibles, libellés, `teamGroups` qui range les camps dans l'ordre du tour de la cour et découpe en tranches de voisins), option « Équipes fixes » dans le menu d'escarmouche (Libre, Par 2, Par 3, Par 4, tailles impossibles grisées, ligne d'aide), `Diplomacy` reçoit les groupes : alliances posées au départ, verrouillées (`'equipes'` pour toute proposition ou rupture), aucune réflexion diplomatique des IA. Panneau « Coéquipiers » sans bouton d'action, conseil de début de partie adapté.
- Ruptures : `breakNotice` 5 → 30 s, badge rouge de compte à rebours sous la puce, rappel annoncé à 10 s (`soon`) ; trahison de fin de partie 15/25/35 % → 4/8/25 % par réflexion (Facile/Normal/Difficile, Expert inchangé à 70 %).
- « Comment jouer » : Alliances (30 s), Mode Équipes, Abandonner, tap hors de la cour. README à jour. Pause : le panneau de diplomatie se ferme pour ne pas recouvrir la carte de pause.
- 11 nouveaux tests (`v56.test.ts`, `v56-app.test.ts` qui joue tout au doigt dans l'application, ralliement hors de la cour) ; 345 tests verts.

**Mesuré**
- Témoin en Normal : 54,3 % (v5.5) → 42,6 % (± 2,4, 1 600 parties). Essais : dégâts seuls 50,4 %, + réaction 1,7 s 47,6 %, groupes de 4 37,1 %, 40 % de défenseurs 41,9 % (1 600).
- Facile 96,1 %, Difficile 9,8 %, Expert 2,4 % (800 parties chacun). Couleurs (4 IA Normal, 800 parties) : 20,5 % à 30,3 %.
- `perf240` : partie 0,191 ms par pas (0,180 hier, même code de simulation : bruit), rendu 1,72 ms par image.

**Reste à faire, inquiétudes**
- Normal à 42,6 % est un peu sous la cible de 45 % : Aloys dira si c'est le bon « chouïa ». Revenir à 40 % de défenseurs ou à des dégâts ×0,93 si c'est trop.
- Mode Équipes : un joueur éliminé perd tout de suite, même si ses coéquipiers peuvent gagner (ajouté à la feuille de route). Les options ne sont pas dans le code de carte, le mode Équipes non plus (comme les autres options).
- Les simulations `equilibre.ts` ne jouent pas la diplomatie : l'effet des ruptures plus rares n'est pas chiffré.
- Suite : 1.4 Alertes livrée dans la foulée (v5.7, entrée ci-dessus) ; 1.3 Renforts et 1.1 bis à la prochaine session.

## 05/11/2026 : session de développement, v5.5 (garnisons)

**Fait**
- Point 1.2 de la feuille de route (pris avant 1.1 bis, comme prévu hier : c'est l'outil qu'il faut au joueur, et 1.1 bis sert justement à mesurer son effet). Aucun retour d'Aloys depuis le 04/11.
- Nouveau module `src/core/garrison.ts` : ordre « Garder » (`assignGuards`), champ `guard` sur l'élève. Les gardes restent dans la zone de capture, engagent tout ennemi entré dans le cercle défendu (2,6 cases), lâchent un ennemi au-delà de la laisse (3,8 cases), reviennent et reprennent la case perdue. Tout nouvel ordre libère le garde ; les pions ne gardent pas ; l'IA ne commande pas un élève de garde.
- Interface : bouton « Garder » (bouclier) à côté de « Camp », en ligne pour ne pas allonger la colonne. Garde immédiate si la sélection est sur une case, sinon bouton allumé en jaune et tap sur la case. Écusson numéroté au coin droit de chaque case gardée, cercle défendu en pointillés quand les gardes sont sélectionnés, son « garde à vous », vibration.
- Tutoriel : 13e étape « Garder » juste après la prise de la seconde case. « Comment jouer » : rubrique « Garnisons ». README à jour.
- `equilibre.ts` : options `garde=` et `part=` (garnisons du témoin, via `TeamAi.garrisonSize` et `garrisonShare`, nuls par défaut).
- `?banc` dans l'adresse expose la partie (`window.__partie()`) pour les captures Playwright.
- 11 nouveaux tests (garnisons, textes) ; tutoriels mis à jour. 334 tests verts.

**Mesuré**
- Normal, 4 équipes, témoin sans garnison : 53,8 % (1 600 parties) : équilibre inchangé, les IA ne posent pas de garnison.
- Témoin qui garnit naïvement : 1 garde par case sans limite 26,1 % ; 2 gardes et 25 % de l'armée 36,8 % ; 15 % de l'armée 46,5 à 47 %. Les garnisons coûtent de la masse d'attaque, et ce témoin secourt déjà ses cases à la main.
- `perf240` sans régression (partie 0,180 ms par pas contre 0,188 avant) ; 240 élèves en garnison et en mêlée : 0,275 ms par pas.

**Reste à faire, inquiétudes**
- Le gain réel des garnisons pour un humain n'est pas encore chiffré : il faut le témoin « humain » de 1.1 bis (qui ne secourt plus ses cases lui-même). Prochaine session : 1.1 bis, puis réglage du rayon et de la laisse.
- Le cercle défendu (2,6 cases) peut chevaucher une case voisine : deux garnisons proches se prêtent main-forte, ce qui me va, mais à surveiller.
- Les IA pourraient un jour garder le trône ou leur camp de cette façon (elles ont déjà leur propre garnison du trône) : pas avant d'avoir mesuré.
- Points de retour : branches `avant-2026-11-05` et `v5.5` (le dépôt refuse les tags).

## 04/11/2026 : session de développement, v5.4 (IA à attention limitée)

**Fait**
- Point 1.1 de la feuille de route. Chaque IA a désormais une attention (`AI_ATTENTION` dans `src/config.ts`) : budget d'ordres par minute qui se recharge (Facile 10, Normal 18, Difficile 28, Expert 40), nombre de cases menacées secourues par réflexion (1, 1, 2, 3 ; le camp d'abord, puis la case la plus près d'être prise), délai propre à chaque case avant de remarquer une attaque (2,5 s, 1,6 s, 1 s, 0,5 s).
- Un élève déjà en route vers le regroupement ne reçoit plus d'ordre en double.
- Menu : une ligne sous les boutons de difficulté donne ces chiffres. « Comment jouer » : nouvelle rubrique « Les IA ».
- Outils : `equilibre.ts` mesure les ordres par minute (IA et témoin), accepte `attention=` et `avant=1`. Le témoin a l'attention d'un humain (`HUMAN_ATTENTION` : 20 ordres par minute, un front, 2 s).
- Normal : groupes d'attaque de 6 à 5 élèves pour revenir près d'une victoire sur deux du témoin.
- 11 nouveaux tests (budget respecté sur une minute, un seul front, priorité au camp, délai par case, menu, « Comment jouer »).

**Mesuré**
- Ordres par minute des IA, avant → après : Facile 18,5 → 8,4 ; Normal 23,3 → 14,5 ; Difficile 31,9 → 22,1 ; Expert 50,7 → 31,1.
- Témoin humain en Normal : 51,0 % contre l'ancienne IA, 65,5 % avec l'attention seule, 54,3 % (± 3,5, 800 parties) après réglage des groupes. Difficile 13,3 %, Expert 5,0 %, Facile 96,5 %.
- Couleurs, 4 IA Normal, 1 200 parties : de 20,0 % (Orange) à 28,0 % (Vert, Rouge).
- Performances (`perf240`, 60 s) : partie 0,277 ms par pas contre 0,273 avant, mêlée 0,136 contre 0,137, ordres 0,217 contre 0,221 : pas de régression.

**Reste à faire, inquiétudes**
- Le témoin est une IA : il ne profite pas des failles de l'attention adverse (attaquer deux fronts à la fois). Le vrai gain pour Aloys se verra en jeu ; j'ajoute le point 1.1 bis (témoin qui harcèle deux fronts) pour le mesurer, après les garnisons si les retours le demandent.
- Jaune et Orange (rapides) un peu faibles en Normal (20 à 21 %) : à surveiller, pas touché ce soir.
- Le dépôt refuse les tags (403 sur `git push` d'un tag) ; comme pour les versions précédentes, les points de retour sont des branches : `avant-2026-11-04` (état avant la session) et `v5.4`. Les sessions suivantes doivent faire pareil.
- Prochaine session : 1.2 Garnisons.

## 03/11/2026 : ouverture du studio

- Création de `studio/` (vision, feuille de route, retours, journal) pour que chaque session quotidienne reparte avec le contexte.
- Diagnostic du retour d'Aloys sur la micro : l'IA défend toutes ses cases menacées à chaque réflexion (`think()` dans `src/core/ai.ts`), d'où son omniprésence.
- Prochaine session : point 1.1 de la feuille de route (IA à attention limitée), en commençant par mesurer les ordres par minute de l'IA actuelle.
