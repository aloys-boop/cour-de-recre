# Journal du studio

Une entrée par session, la plus récente en haut : date, version, ce qui a été fait, ce qui a été mesuré, ce qui reste ou ce qui inquiète.

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
