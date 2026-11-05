# Journal du studio

Une entrée par session, la plus récente en haut : date, version, ce qui a été fait, ce qui a été mesuré, ce qui reste ou ce qui inquiète.

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
