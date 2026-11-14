# Feuille de route

Une session = un point (ou deux petits) mené jusqu'au bout. On coche `[x]` avec la version et la date. On peut réordonner, découper, ajouter : c'est le créateur qui décide, en respectant `VISION.md` et en faisant passer `RETOURS.md` en premier.

## Demandes d'Aloys du 07/11

- [x] **Compteur d'élèves, tutoriel juste et lisible.** (v5.9, 08/11/2026) Puce du joueur « élèves / maximum », ennemis « en vue » (œil) sous le brouillard, détail « Effectifs » en touchant sa puce ; le tutoriel nomme le vrai adversaire ; la bulle se place là où elle ne cache ni la main ni la cible (et dit quel bouton toucher dans le panneau du camp).

## Demandes d'Aloys du 05/11

- [x] **Les cinq demandes « a minima ».** (v5.6, 06/11/2026) Normal un peu plus dur, « Abandonner » avec statistiques, tap hors de la cour ramené au bord, mode Équipes fixes, ruptures annoncées 30 s et trahisons de fin de partie plus rares.
- [ ] **Mode Équipes, suite.** Quand le joueur est éliminé mais que ses coéquipiers tiennent encore : rester en spectateur jusqu'au bout et partager la victoire (aujourd'hui : défaite immédiate).

## Saison 1 : moins de micro, plus de stratégie (priorité absolue, retour du 03/11)

But mesurable : un joueur humain qui donne 15 à 25 ordres par minute doit pouvoir tenir 3 fronts. En Normal, le « joueur témoin » doit gagner environ une partie sur deux sans gestion fine.

- [x] **1.1 IA à attention limitée.** (v5.4, 04/11/2026) Budget d'ordres par minute selon la difficulté (Facile ~10, Normal ~18, Difficile ~28, Expert ~40), un front principal à la fois, délai de réaction par groupe et non global, pas de défense parfaite de toutes les cases à la fois. Mesurer avant et après dans `scripts/dev/` le nombre d'ordres par minute de l'IA, et vérifier le joueur témoin.
- [x] **1.4 Alertes.** (v5.7, 06/11/2026) Case attaquée, case perdue, camp en danger : bandeau court en haut, son discret, tap pour y aller. Regroupement pour ne pas spammer. Suite possible : réglage « alertes discrètes » si Aloys les trouve trop bavardes.
- [x] **1.3 Renforts automatiques.** (v5.8, 07/11/2026) Option par camp : la production part d'elle-même vers la case possédée la plus menacée (ou vers le ralliement si rien n'est menacé). Ligne pointillée visible. Suite possible : laisser les IA s'en servir (Difficile, Expert), et un seuil réglable (« seulement les camps »).
- [x] **1.1 bis Témoin plus humain.** (v5.10, 09/11/2026) `style=humain` dans `equilibre.ts` : ne secourt que ses camps, renforts automatiques, second front de 3 élèves. Il gagne 50 à 52 % en Normal : l'objectif de la saison est atteint. Garnisons systématiques coûteuses (28 à 31 %) : rayon et laisse sans effet mesurable, d'où les **gardes retranchés** (coups reçus ×0,75 dans leur cercle, « Paré ! »), +4 à 6 points. Suite possible : apprendre au témoin à ne garder que les cases clés (camps pris, trône, cases dorées).
- [x] **1.2 Garnisons.** (v5.5, 05/11/2026) Ordre « Garder » sur une case : les élèves assignés restent dans la zone, défendent un rayon, ne se font pas attirer loin, reprennent la case s'ils la perdent. Pastille visible sur la case gardée (nombre de gardes).
- [x] **1.5 Escouades à consigne.** (v5.11 à v5.13, 10 au 12/11/2026) Découpé en trois tranches :
  - [x] **1.5 a Conquérir.** (v5.11, 10/11/2026) Bouton « Conquérir » : la sélection devient une escouade qui prend seule, l'une après l'autre, la case libre la plus proche (sans tricher sous le brouillard, renonce à une case trop défendue). Drapeau sur la case visée et sur le groupe 1-2-3 en conquête. Les cases ennemies sont exclues : mesuré, les viser rendait Normal beaucoup trop facile (témoin 67 à 73 %).
  - [x] **1.5 b Défendre.** (v5.12, 11/11/2026) Bouton « Défendre » : garnison mobile d'un secteur de 4 cases au plus autour de l'escouade ; poste au centre, secours de la case attaquée ou tombée, laisse de 4,2 cases, retranchée comme des gardes. Bouclier sur le poste, bouclier « ! » sur la case secourue, bouclier bleu sur le groupe. Mesuré : coûte au témoin à 4 élèves (−4 à −6 points), neutre à 6.
  - [x] **1.5 c Suivre.** (v5.13, 12/11/2026) Bouton « Suivre » armé, puis tap sur un de ses élèves (ou sur un bouton 1-2-3) : la sélection escorte ce groupe (toute son escouade s'il en a une), se jette sur les ennemis qui l'approchent, laisse de 4,5 cases, se disperse quand il n'y a plus personne. Écusson vert sur le protégé et sur le groupe. Mesuré : coûte 5 à 8 points au témoin qui escorte sa conquête, comme les autres consignes.
  - Idée (11/11) : laisser régler le secteur au doigt (toucher les cases à ajouter ou retirer, comme « Garder » armé), si Aloys trouve le secteur automatique trop rigide.
  - Idée (à valider) : apprendre aux IA à reprendre plus vite leurs cases éloignées ; ce n'est qu'ensuite qu'une conquête des cases ennemies (réservée à Facile ?) pourrait revenir.
- [x] **1.6 Rythme réglable.** (v5.14, 13/11/2026) Sablier en haut à droite (Facile et Normal) : pause tactique, cour figée sous un liseré bleu, ordres, consignes, achats et pouvoirs possibles, ▶ ou bandeau « Reprendre » pour relancer. Rubrique « Rythme » dans la pause : vitesse Normale ou Lente ×0,75, sablier affiché ou masqué, mémorisés. Mesuré : la vitesse lente vaut environ 4 points au témoin (49,9 → 54,0 % et 52,0 → 56,3 %).
  - Idée : une rubrique « Rythme » aussi dans le menu principal, pour régler la vitesse avant la partie.
  - [x] Statistiques de fin de partie : pauses tactiques comptées (v5.15).
- [x] **1.7 Bilan saison 1.** (v5.15, 14/11/2026) Simulations d'ensemble (témoin humain : Facile 98,0 %, Normal 49,9 %, Difficile 13,5 %, Expert 3,4 % ; couleurs à 4 IA Normal) : aucun réglage à changer, objectif de la saison atteint. Tutoriel en 14 étapes (« Conquérir » avec trois recrues), « Comment jouer » en quatre chapitres à onglets avec la synthèse « Quel outil pour quoi ? », pauses tactiques sur l'écran de fin, espaces insécables dans les textes.
  - Suite : la Rose sort un peu au-dessus de la cible (29,1 % à 4 IA Normal, graine 1) ; à confirmer sur d'autres graines puis, si besoin, retoucher la valeur d'un point dans sa caractéristique forte (le budget de 12 points ne bouge pas).
  - Idée : une rubrique « Rythme » dans le menu principal, pour régler la vitesse avant la partie.

## Saison 2 : sensations et lisibilité

- [ ] Coups qui « claquent » : impact, petit recul, étoiles de KO, tremblement léger de caméra sur les grosses bagarres (désactivable).
- [ ] Musique synthétisée par Web Audio qui s'intensifie avec les bagarres, thèmes de menu et de victoire.
- [ ] Lisibilité : motifs en plus des couleurs (daltonisme), contours d'équipe, contraste des cases.
- [ ] Interface : transitions, retours tactiles visuels, menus plus vivants, écran de fin avec statistiques et ralenti du dernier coup.
- [ ] Performances : 60 images par seconde garanties à 240 élèves sur iPhone, mesurées.

## Saison 3 : une vraie campagne

- [ ] Une histoire légère : une rentrée dans une nouvelle école, des personnages (délégués de chaque classe, le directeur, les surveillants), courtes scènes entre les niveaux.
- [ ] Objectifs variés par niveau : tenir une case X minutes, escorter, survivre, prendre le trône, reprendre un camp perdu.
- [ ] Un boss final et des niveaux bonus.
- [ ] Trois étoiles par niveau, récompenses cosmétiques.

## Saison 4 : profondeur

- [ ] Terrain : préau couvert, bac à sable qui ralentit, bancs qui bloquent, portes.
- [ ] Chefs de classe : un héros par équipe avec une capacité propre.
- [ ] Événements de récré : pluie (tout le monde au préau), cloche anticipée, ballon perdu.
- [ ] Arbres d'améliorations plus riches, choix exclusifs.

## Saison 5 : rejouabilité

- [ ] Défi du jour (carte et règles du jour, mêmes pour tous).
- [ ] Succès et statistiques de carrière.
- [ ] Modes : survie par vagues, roi de la cour classé, partie express de 5 minutes.
- [ ] Éditeur de cour partageable par code.

## Idées en vrac (à trier)

- Replay de fin de partie accéléré.
- Mode « spectateur » IA contre IA pour admirer.
- Commentateur façon radio de l'école (textes courts).
