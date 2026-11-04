# Journal du studio

Une entrée par session, la plus récente en haut : date, version, ce qui a été fait, ce qui a été mesuré, ce qui reste ou ce qui inquiète.

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
- Le push git en ligne de commande est refusé (403) dans cet environnement : livraison via l'API GitHub. Les tags `avant-2026-11-04` et `v5.4` n'ont pas pu être poussés (voir plus bas si résolu).
- Prochaine session : 1.2 Garnisons.

## 03/11/2026 : ouverture du studio

- Création de `studio/` (vision, feuille de route, retours, journal) pour que chaque session quotidienne reparte avec le contexte.
- Diagnostic du retour d'Aloys sur la micro : l'IA défend toutes ses cases menacées à chaque réflexion (`think()` dans `src/core/ai.ts`), d'où son omniprésence.
- Prochaine session : point 1.1 de la feuille de route (IA à attention limitée), en commençant par mesurer les ordres par minute de l'IA actuelle.
