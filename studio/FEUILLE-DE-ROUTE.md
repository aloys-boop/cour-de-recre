# Feuille de route

Une session = un point (ou deux petits) mené jusqu'au bout. On coche `[x]` avec la version et la date. On peut réordonner, découper, ajouter : c'est le créateur qui décide, en respectant `VISION.md` et en faisant passer `RETOURS.md` en premier.

## Demandes d'Aloys du 05/11

- [x] **Les cinq demandes « a minima ».** (v5.6, 06/11/2026) Normal un peu plus dur, « Abandonner » avec statistiques, tap hors de la cour ramené au bord, mode Équipes fixes, ruptures annoncées 30 s et trahisons de fin de partie plus rares.
- [ ] **Mode Équipes, suite.** Quand le joueur est éliminé mais que ses coéquipiers tiennent encore : rester en spectateur jusqu'au bout et partager la victoire (aujourd'hui : défaite immédiate).

## Saison 1 : moins de micro, plus de stratégie (priorité absolue, retour du 03/11)

But mesurable : un joueur humain qui donne 15 à 25 ordres par minute doit pouvoir tenir 3 fronts. En Normal, le « joueur témoin » doit gagner environ une partie sur deux sans gestion fine.

- [x] **1.1 IA à attention limitée.** (v5.4, 04/11/2026) Budget d'ordres par minute selon la difficulté (Facile ~10, Normal ~18, Difficile ~28, Expert ~40), un front principal à la fois, délai de réaction par groupe et non global, pas de défense parfaite de toutes les cases à la fois. Mesurer avant et après dans `scripts/dev/` le nombre d'ordres par minute de l'IA, et vérifier le joueur témoin.
- [x] **1.4 Alertes.** (v5.7, 06/11/2026) Case attaquée, case perdue, camp en danger : bandeau court en haut, son discret, tap pour y aller. Regroupement pour ne pas spammer. Suite possible : réglage « alertes discrètes » si Aloys les trouve trop bavardes.
- [ ] **1.3 Renforts automatiques.** Option par camp : la production part d'elle-même vers la case possédée la plus menacée (ou vers le ralliement si rien n'est menacé). Ligne pointillée visible.
- [ ] **1.1 bis Témoin plus humain.** Le joueur témoin des simulations est encore une IA (il ne profite pas des failles de l'attention adverse, et secourt ses cases à la main). Lui apprendre à harceler deux fronts, et lui donner une variante « humaine » qui ne secourt plus ses cases elle-même mais pose des garnisons (`garde=`, `part=` existent déjà dans `equilibre.ts`), pour mesurer le vrai gain d'un joueur stratège et régler les garnisons (rayon, laisse) en conséquence.
- [x] **1.2 Garnisons.** (v5.5, 05/11/2026) Ordre « Garder » sur une case : les élèves assignés restent dans la zone, défendent un rayon, ne se font pas attirer loin, reprennent la case s'ils la perdent. Pastille visible sur la case gardée (nombre de gardes).
- [ ] **1.5 Escouades à consigne.** Les groupes 1-2-3 reçoivent une consigne : Défendre (garnison mobile autour d'une zone), Conquérir (prend d'elle-même la case neutre ou faible la plus proche), Suivre (escorte un autre groupe).
- [ ] **1.6 Rythme réglable.** Vitesse de jeu ×0,75 / ×1 en Facile et Normal, et pause tactique où l'on peut donner des ordres (option).
- [ ] **1.7 Bilan saison 1.** Simulations, réglages fins, mise à jour du tutoriel et de « Comment jouer » pour tous les nouveaux gestes.

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
