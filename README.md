# Cour de Récré

Jeu de stratégie en temps réel isométrique, jouable au doigt sur iPhone (Safari) et installable comme application hors ligne. Remake personnel et non commercial, inspiré dans l'esprit d'un jeu Flash des années 2000 : tous les graphismes, sons et le nom sont originaux et générés par le code.

De deux à huit équipes d'élèves en uniforme (Noir, Vert, Jaune, Violet, Rouge, Bleu, Orange, Rose) se disputent les cases d'une cour de récréation. Tu diriges l'une d'elles, les autres (jusqu'à sept) sont contrôlées par l'ordinateur, toutes sur le même téléphone, sans réseau. En cours de partie, les équipes peuvent s'allier… et se trahir.

## Tutoriel et « Comment jouer »

- **Tutoriel.** Proposé automatiquement au premier lancement (« Faire le tutoriel » ou « Plus tard »), puis rejouable à tout moment : il est en tête de l'onglet « Campagne » du menu. Petite cour de 11 × 11 contre les Verts, IA passive (ses élèves restent chez eux et ne sont pas produits) jusqu'à la dernière étape, où elle se réveille en Facile avec des coups adoucis. Douze étapes guidées par une bulle de texte et une main animée qui montre où toucher ; chacune n'avance que sur l'action réelle du joueur : sélectionner un élève, sélection rectangle, déplacer, capturer une case, attaquer (deux Verts approchent), poser un point de ralliement, bouger la caméra (glisser, pincer ou mini-carte), gagner des bons points en prenant une case, améliorer l'équipe, lire l'aide d'un pouvoir (appui long sur le Goûter), le lancer par glisser-déposer (ou l'ancien mode), gagner la partie en prenant le camp vert. Le directeur complète au besoin les bons points pour essayer l'amélioration et le pouvoir. Le bouton « Passer » reste toujours visible et ramène au menu. Le tutoriel ne fait pas partie de la liste des niveaux : les codes de carte et la progression de la campagne sont inchangés.
- **Comment jouer.** Les règles en onze rubriques courtes (but, sélection, déplacement et attaque, cases et camps, bons points, améliorations, classes, pouvoirs, pion, caméra, alliances), depuis le bouton « Comment jouer » du menu et du menu pause.

## Règles du jeu

- **Les camps.** Chaque équipe part d'un camp (grande zone colorée dans un coin de la cour ; à partir de 5 équipes, aussi au milieu des bords). Le camp produit régulièrement un nouvel élève, dans la limite de **30 élèves par équipe**, sur toutes les cartes et quel que soit le nombre d'équipes (jusqu'à 240 élèves à 8 équipes).
- **Les cases bonus.** Entre les camps, des cases blanches marquées d'un symbole de carte. Chaque case possédée renforce toute l'équipe :
  - ♥ cœur : plus de points de vie (+30 % par case) ;
  - ♠ pique : plus de dégâts (+30 %) ;
  - ♣ trèfle : production plus rapide (+35 %) ;
  - ♦ carreau : déplacement plus rapide (+15 %).
- **Capturer.** Des élèves d'une seule équipe doivent rester sur une case pendant environ 3 secondes (jauge visible). Plus ils sont nombreux, plus c'est rapide (jusqu'à 2 fois). Si une autre équipe tient déjà une jauge, il faut d'abord la vider. Une case occupée par des équipes ennemies est **contestée** (pointillés rouges) : rien ne bouge tant que le combat n'est pas tranché (des alliés, eux, ne se la contestent pas, voir plus bas). Un camp se prend aussi, mais 2,5 fois plus lentement ; l'équipe qui le perd ne produit plus.
- **Des équipes différentes, à budget égal.** Chaque uniforme répartit exactement **12 points** entre 4 caractéristiques (de 1 à 5 points chacune). Les jauges du menu montrent exactement ces points, et ce sont eux qu'on joue :

  | Équipe | Vie | Dégâts | Production | Vitesse | En bref |
  | --- | --- | --- | --- | --- | --- |
  | Noir | 3 | 3 | 3 | 3 | Équilibrés en tout |
  | Vert | 2 | 2 | 5 | 3 | Production très rapide, mais fragiles |
  | Jaune | 2 | 3 | 3 | 4 | Rapides, un peu fragiles |
  | Violet | 4 | 4 | 1 | 3 | Très forts, mais lents à produire |
  | Rouge | 2 | 5 | 2 | 3 | Frappent très fort, mais peu de vie |
  | Bleu | 5 | 3 | 2 | 2 | Beaucoup de vie, mais lents |
  | Orange | 2 | 2 | 4 | 4 | Production et vitesse élevées, petits poings |
  | Rose | 4 | 3 | 3 | 2 | Résistants, un peu lents |

  Valeur réelle d'un nombre de points (multiplicateur ; 3 points = référence). Les caractéristiques n'ont pas le même poids : la vitesse sert à capturer et à arriver la première aux bagarres, la production compte moins depuis le plafond de 30 élèves. La valeur d'un point a donc été réglée par stat (voir « Équilibrage ») :

  | Points | 1 | 2 | 3 | 4 | 5 |
  | --- | --- | --- | --- | --- | --- |
  | Vie | ×0,8 | ×0,9 | ×1 | ×1,08 | ×1,17 |
  | Dégâts | ×0,8 | ×0,9 | ×1 | ×1,1 | ×1,2 |
  | Production | ×0,83 | ×0,91 | ×1 | ×1,12 | ×1,22 |
  | Vitesse | ×0,72 | ×0,84 | ×1 | ×1,23 | ×1,36 |

  La huitième couleur est le rose plutôt que le blanc : une case bonus prise par une équipe blanche resterait blanche sur blanc (symbole invisible), et son camp se confondrait avec le sol gris clair.

- **Barre de bagarre.** Le jeu repère les bagarres (élèves d'équipes ennemies au contact, regroupés de proche en proche, recalculé 4 fois par seconde). Au-dessus de chacune, une petite barre partagée en segments aux couleurs des équipes impliquées, proportionnels à leur force dans la bagarre : somme des PV restants × dégâts (profil, cases ♠, améliorations, classe, bonus de surveillant compris). Un petit chevron blanc, au-dessus du segment de l'équipe qui gagne du terrain (sa part a monté d'au moins 3 points sur les 3 dernières secondes), montre la tendance. La barre se place au-dessus des têtes et disparaît en fondu à la fin de la bagarre ; elle n'est pas affichée pour une bagarre cachée par le brouillard. Une bagarre de ton équipe hors de l'écran apparaît en haut de l'écran sous forme de mini-barre avec une flèche dans sa direction (3 au plus) : touche-la pour que la caméra glisse jusqu'à elle.
- **Combat.** Les élèves se battent à coups de poing au corps à corps. Un élève inoccupé engage de lui-même les ennemis qui s'approchent. À zéro point de vie, il s'assoit, KO, puis disparaît.
- **Repli.** Un ordre de déplacement est un rappel : les élèves cessent le combat et courent sans riposter jusqu'à destination (ils peuvent se faire frapper en fuyant). Arrivés, ils se défendent à nouveau. Pour attaquer, touche un ennemi. Le bouton **Fuir / Charger** (en haut à droite) change ce comportement : en mode Charger, les élèves se battent contre tout ce qu'ils croisent en chemin (marqueur orange).
- **Point de ralliement (par camp).** Chaque camp a son propre drapeau ; les nouveaux élèves de ce camp s'y rendent dès leur naissance. Trois façons de le poser :
  - dans le panneau du camp, rubrique « Ralliement » : « Placer » (ou « Déplacer »), puis touche la carte ; « Supprimer » retire le drapeau, et les nouveaux élèves restent alors au camp ;
  - raccourci : glisse le doigt depuis le camp jusqu'à un point de la carte (une flèche à ta couleur suit le doigt) ;
  - comme avant : sans sélection, un appui long sur le sol (sans glisser) pose le drapeau du camp le plus proche ; un appui long sur un de tes camps efface son drapeau.

  Le drapeau est à la couleur de ton équipe et porte le numéro du camp (celui du panneau, « Camp 2/4 »). La ligne pointillée du camp vers son drapeau est visible quand le panneau de ce camp est ouvert, et pour tous tes camps pendant que tu poses un ralliement. Un camp capturé perd son ralliement.
- **Régénération.** Un élève qui se tient sur son propre camp, ou sur un cœur que son équipe possède, récupère ses points de vie (environ 7 par seconde) : de petits cœurs montent au-dessus de lui. Les élèves d'une équipe qui possède au moins un pique marchent sur une aura rougeâtre.
- **Victoire.** Une équipe gagne quand elle est la dernière à avoir encore des élèves ou un camp, ou quand elle possède tous les camps. Si toutes les équipes encore en vie sont alliées entre elles (ou si une alliance tient tous les camps), **l'alliance gagne ensemble** : « Victoire de l'alliance ! », avec les couleurs alliées. Tu perds dès que tu n'as plus ni élèves ni camp, même si ton alliance l'emporte.
- **Cartes.** Six niveaux de taille croissante (du Préau au Campus, de 14 à 22 cases bonus, puis « Le tournoi » : 8 équipes, 26 × 26, 28 cases, débloqué après le 5e). La disposition des cases et des obstacles est tirée au sort à chaque partie, de façon symétrique pour rester équitable. Chaque victoire débloque le niveau suivant ; la progression est sauvegardée sur l'appareil.
- **Escarmouche.** Partie libre : nombre d'équipes (2 à 8), taille de la cour (petite, moyenne, grande, immense), nombre de cases bonus (10 à 30 ; au moins 20 à partir de 5 équipes), difficulté et couleur parmi les huit. La cour grandit de deux cellules par équipe au-delà de quatre. Les victoires d'escarmouche ne débloquent rien dans la campagne.
- **Roi de la cour** (mode d'escarmouche). Un trône doré de 2 × 2 cellules, marqué d'une couronne, occupe le centre de la cour (les cases bonus et obstacles qui le touchaient sont retirés, de façon symétrique et reproductible). Il ne donne ni bonus ni élèves : il se capture comme un camp, et son propriétaire accumule du temps de règne tant que des ennemis ne le contestent pas. Le règne est compté par équipe et ne se transmet pas ; la première équipe à **2 minutes cumulées** gagne, avec ses alliés encore en vie (comme une alliance qui tient tous les camps) : « Roi de la cour ! ». Les autres victoires restent possibles. Un cadre sous les bonus affiche ton règne, celui du meneur et du tenant du trône ; annonces « Les Verts prennent le trône ! », « Plus que 20 s pour les Jaunes ! » ; l'écran de fin donne le temps de règne de chaque équipe. Les IA visent le trône en priorité (d'autant plus que son tenant approche des 2 minutes) et y laissent une garnison quand elles le tiennent.
- **Code de carte.** Chaque partie a un code de 6 caractères (sans 0, 1, I ni O), affiché dans le menu pause et sur l'écran de fin avec un bouton « Copier ». Saisi dans le menu, il redonne exactement la même disposition (niveau ou réglages d'escarmouche compris, de 2 à 8 équipes). Les codes des versions précédentes restent valides et redonnent la même carte.
- **Médailles.** Chaque niveau de campagne propose trois médailles : victoire, victoire sans perdre son camp, victoire en moins de 3 minutes de jeu. Elles sont sauvegardées et affichées sous forme de pastilles dans la liste des cartes.
- **Difficulté.** Quatre niveaux : Facile, Normal, Difficile, Expert. Plus c'est dur, plus les IA réagissent vite, attaquent avec de petits groupes, gardent peu de défenseurs, frappent fort et dépensent bien leurs bons points :

  | Niveau | Réaction | Groupe d'attaque | Défenseurs gardés | Dégâts IA | Bons points |
  | --- | --- | --- | --- | --- | --- |
  | Facile | 2,6 s | 5 | 50 % | ×0,75 | achats lents, au hasard, pas de pouvoir |
  | Normal | 1,9 s | 6 | 45 % | ×0,9 | achats retardés (toutes les 6 s, avec 40 % de marge), choix au hasard 4 fois sur 10, pouvoirs une occasion sur deux, visés à ±1,8 case |
  | Difficile | 1,5 s | 4 | 35 % | ×1 | achats raisonnés toutes les 4 s |
  | Expert | 0,8 s | 3 | 20 % | ×1,15 | achats raisonnés toutes les 2 s |

  Normal est réglé pour qu'un joueur moyen gagne environ une partie sur deux à 4 équipes (voir « Équilibrage »). Difficile et Expert sont les anciens Normal et Difficile (avant la v5.2) : une ancienne sauvegarde réglée sur « Normal » s'ouvre en Difficile, « Difficile » en Expert.
- **Option « Camps fantômes » (escarmouche).** La cour compte en plus 1 à 3 camps sans propriétaire (selon sa taille), gris pâle à liseré pointillé avec un petit fantôme, placés vers le centre à égale distance des équipes (symétriques quand la carte l’est). Ils se capturent comme un camp (lentement) ; pris, ils produisent des élèves comme un camp normal et peuvent être repris. Ils comptent comme des camps pour la victoire : une équipe qui ne tient plus qu’un camp fantôme reste en vie, et « tenir tous les camps » les inclut. Même code de carte et même option : même disposition.

## Bons points et améliorations de camp

- **Bons points.** Chaque équipe accumule des bons points (étoile dorée ; ton solde est affiché dans la pastille « ★ » en haut à droite, et chaque gain s'envole au-dessus de l'endroit où il a été gagné). Gains :

  | Action | Bons points |
  | --- | --- |
  | Élève ennemi mis KO (dernier coup) | +2 |
  | Case bonus capturée | +10 |
  | Camp capturé (camp fantôme et trône compris) | +25 |
  | Case tenue (cases bonus, camps et trône) | +1 toutes les 10 s, par case |
  | Surveillant mis KO (dernier coup, option « Surveillants ») | +40 |

- **Améliorations : globales ou par camp.** Sans sélection, touche un de tes camps (à côté des élèves qui y stationnent) ou la pastille « ★ » : le panneau s'ouvre en deux zones bien séparées, côte à côte. Il tient dans l'écran d'un iPhone en paysage (encoche comprise) ; sur un écran plus petit, il défile verticalement, et son en-tête (bons points et croix de fermeture) reste toujours visible.
  - **Toute l'équipe** (achetées une fois, valables pour tous tes élèves, y compris ceux déjà sur le terrain, et pour tous tes camps, y compris ceux capturés plus tard) :

    | Amélioration | Effet par niveau | Coût des niveaux 1 / 2 / 3 |
    | --- | --- | --- |
    | Production | tous tes camps produisent 15 % plus vite | 50 / 100 / 170 |
    | Uniformes | +10 % de PV pour tous tes élèves | 50 / 100 / 170 |
    | Entraînement | +10 % de dégâts pour tous tes élèves | 50 / 100 / 170 |
    | Classes d'élèves | débloque Costaud, Sprinteur, Infirmier dans tous tes camps | 40 (une fois) |

  - **Ce camp** : Défense (le camp se prend 30 % plus lentement et soigne 30 % plus vite par niveau ; 20 / 40 / 70), le pion gardien, le type d'élève produit et le point de ralliement. En tête de zone, « Camp 2/4 · Camp vert » : chaque camp porte le nom de l'équipe qui en est partie (« Camp de départ » pour le tien, « Camp fantôme 1 » pour un camp sans propriétaire au départ). Les flèches ‹ › passent d'un de tes camps à l'autre sans fermer le panneau, et la caméra glisse vers le camp affiché.

  Chaque camp a son propre pion gardien (acheté pour ce camp, il revient 60 s après un KO) et choisit le type d'élève qu'il produit dès que les classes sont débloquées pour l'équipe, y compris un camp capturé. Contre le coin gauche de chaque camp de la carte (le tien comme ceux des autres, s'ils sont visibles), deux pastilles cerclées à la couleur de l'équipe : le type d'élève produit (petit élève de cette classe : carrure du costaud, bandeau du sprinteur, calot de l'infirmier) et, si le camp a un pion, un sifflet (grisé, avec un arc doré qui se remplit jusqu'à son retour, quand il est KO).

  La Défense se voit sur le camp : un fanion gris planté sur son bord avant, avec une étoile dorée par niveau. **Un camp capturé perd son pion, sa Défense et son ralliement**, mais profite aussitôt des améliorations globales de son nouveau propriétaire (production, PV et dégâts de ses élèves).
- **Les IA aussi**, avec le même système. Elles gagnent des bons points comme toi et les dépensent selon la difficulté :
  - Facile : toutes les 9 s, une amélioration globale au hasard (niveau 2 au plus), parfois le déblocage des classes ; ni ralliement, ni pouvoir ;
  - Normal (toutes les 6 s) : comme Difficile, mais en attendant d'avoir 40 % de plus que le prix, avec un achat au hasard 4 fois sur 10, des pouvoirs plus rares (une occasion sur deux, seuils plus hauts) et visés à côté ;
  - Difficile (toutes les 4 s) et Expert (toutes les 2 s) : achat raisonné. Les améliorations globales d'abord (Production tant que l'équipe est loin du plafond, puis Entraînement et Uniformes), le déblocage des classes dès que l'armée compte 10 élèves ; la Défense et le pion vont aux camps menacés (ennemis à moins de 4 cases ou jauge de capture adverse), et l'IA met de côté pour le pion de son camp principal quand elle a 5 niveaux globaux (6 en Normal, 4 en Expert) ;
  - chaque camp produit un type d'élève différent quand c'est possible (le camp le plus menacé choisit d'abord, souvent des costauds ; les autres prennent la classe suivante la plus en retard) ;
  - chaque camp envoie ses nouveaux élèves vers son front : la case de l'IA attaquée la plus proche, sinon un point en direction de sa cible d'attaque, à 6 cases au plus du camp.

## Classes d'élèves

Dans le panneau d'un camp, la rubrique « Ce camp produit » choisit la classe de ses prochains élèves. Les classes spéciales se débloquent pour **toute l'équipe** (amélioration globale « Classes d'élèves », 40 ★) : chacun de tes camps, y compris ceux capturés ensuite, choisit alors sa propre classe. Elles se paient à chaque élève produit ; faute de bons points (ou au-delà de la limite), le camp produit un élève normal. Un camp capturé repasse aux élèves normaux.

| Classe | Coût | Caractéristiques | Silhouette |
| --- | --- | --- | --- |
| Élève | gratuit | — | uniforme habituel |
| Costaud | 5 ★ | PV ×2, vitesse ×0,75 | carrure large, plus grand (×1,16) |
| Sprinteur | 4 ★ | vitesse ×1,4, capture ×2, PV ×0,7 | bandeau rouge, baskets blanches, plus fin |
| Infirmier | 6 ★ | soigne 4 PV/s les élèves amis à moins de 2,2 cases, dégâts ×0,25, ne se bat que sur ordre d'attaque ; 3 au plus par équipe | calot blanc et trousse de soin à croix rouge |

Le sprinteur compte pour 4 élèves dans la jauge de capture : seul sur une case, il la prend deux fois plus vite (la vitesse de capture suit la racine du nombre d'élèves, plafonnée à 2). Les infirmiers soignent aussi les alliés.

Les IA mélangent les classes dès que leur camp est débloqué et qu'il leur reste une réserve de bons points (25 en Normal, 15 en Difficile, 10 en Expert) : elles visent environ 60 % de costauds (plus quand le camp est menacé), des sprinteurs tant qu'il reste des cases libres, et un infirmier par tranche de 8 élèves (3 au plus) ; à chaque réflexion, chaque camp produit la classe la plus en retard sur sa part visée, en évitant celle qu'un autre camp produit déjà. En Facile, l'IA ne produit qu'un costaud de temps en temps, quand elle est riche.

## Pouvoirs de récré et pion

- **Pouvoirs.** Trois boutons ronds en bas au centre, payés en bons points, chacun avec sa recharge. Bouton grisé avec un compte à rebours pendant la recharge, ou avec les bons points qui manquent (« −12 »). Trois gestes, bien distincts :
  - **appui long sans bouger** (0,38 s) : bulle d'aide au-dessus du bouton, sans lancer le pouvoir (nom, effet chiffré avec les valeurs réelles, rayon, durée, coût, recharge restante ou bons points manquants) ; elle reste tant que le doigt est posé, disparaît au relâchement et ne sort jamais de l'écran ;
  - **glisser-déposer** (dès que le doigt bouge de plus de 12 px) : la zone d'effet suit le doigt sur la carte (rouge si la cible n'est pas valide : hors de la cour ou sur le HUD) ; relâcher sur la carte lance le pouvoir à cet endroit, relâcher sur le bouton ou sur le HUD annule. Près du bord de l'écran (48 px), la caméra défile doucement (jusqu'à 420 px/s). Si le pouvoir se recharge ou si les bons points manquent, le glisser affiche la raison au lieu de lancer ;
  - **tap** (l'ancien mode) : la zone s'affiche au centre de l'écran ; touche la carte pour déplacer la visée, puis touche **dans** la zone pour lancer. Retoucher le bouton annule.

  Au lancement : éclat sur le bouton, onde au point d'impact, son propre à chaque pouvoir.

  | Pouvoir | Coût | Recharge | Rayon | Effet |
  | --- | --- | --- | --- | --- |
  | Sonnerie | 30 ★ | 60 s | 2,2 cases | fige les ennemis 3 s : ils ne bougent ni ne frappent (petite cloche au-dessus d'eux) |
  | Boules de neige | 35 ★ | 50 s | 1,8 case | 30 dégâts à chaque ennemi de la zone (les KO rapportent leurs bons points) |
  | Goûter | 25 ★ | 45 s | 2,4 cases | rend 45 PV à chacun de tes élèves (et ceux de tes alliés) dans la zone |

  Les IA les utilisent aussi, sauf en Facile : à chaque réflexion, elles cherchent le point qui touche le plus d'élèves et lancent un pouvoir à partir de 6 ennemis touchés pour la sonnerie (seulement si au moins 3 de leurs élèves sont là pour en profiter), 5 pour la neige, 4 élèves blessés pour le goûter en Difficile (7, 6 et 5 en Normal, une occasion sur deux et visée approximative ; 5, 4 et 3 en Expert). Une annonce prévient quand une équipe adverse lance un pouvoir à portée de vue.
- **Pion.** Dans le panneau d'un camp, rubrique « Pion » : un surveillant aux couleurs de ton équipe, **120 ★, une fois par camp**. Il a 400 PV, recule à peine sous les coups, frappe environ trois fois plus fort qu'un élève, reste près du camp et attaque tout ennemi qui entre à moins de 3,2 cases du camp, sans le poursuivre à plus de 4,5 cases. Mis KO, il revient **60 s** plus tard ; mettre un pion adverse KO rapporte 20 ★. Il ne compte pas dans l'effectif ni dans le plafond de 30 élèves, ne se sélectionne pas et ne capture rien. Un camp capturé perd son pion. Les IA Normal, Difficile et Expert mettent de côté pour un pion dès qu'un de leurs camps est bien amélioré (6 niveaux en Normal, 5 en Difficile, 4 en Expert) ou l'achètent pour un camp menacé.

## Alliances

- **Proposer.** Touche la puce d'une équipe, en haut de l'écran : le panneau « Diplomatie » permet de lui proposer une alliance ou de rompre la vôtre. L'IA répond tout de suite (« Les Jaunes acceptent l'alliance. » ou « Les Jaunes refusent. »).
- **Entre alliés.** Pas de combat (ni engagement automatique, ni ordre d'attaque possible, ni dégâts : toucher un allié vaut un déplacement), on se traverse sans se bloquer, et on ne se conteste pas les cases. Si seuls des alliés sont sur une case, la capture avance pour celle qui capturait déjà, sinon pour la plus nombreuse ; un allié ne prend jamais la case d'un allié (il y efface plutôt la jauge d'un ennemi). Les camps et les cœurs ne soignent que leur propriétaire.
- **Repères.** La puce d'un allié porte une poignée de main et un liseré bleu clair (en pointillés clignotants quand une rupture est annoncée) ; ses élèves ont un petit losange bleu à côté de leur barre de vie ; sur la mini-carte, ses camps ont un liseré bleu.
- **Rompre.** Une rupture est annoncée 5 s à l'avance (« Les Verts vont rompre l'alliance dans 5 s ! »), pour l'IA comme pour toi. Une même paire d'équipes ne peut pas changer d'alliance plus d'une fois toutes les 30 s.
- **Ce que pense l'IA.** Chaque IA estime la puissance de chaque équipe (vie et dégâts de ses élèves, camps, cases) et garde une attitude envers chacune (rancune quand on lui met des élèves KO, méfiance pendant 2 minutes envers qui l'a trahie). Elle accepte une alliance face à une menace commune (une équipe au moins 1,5 fois plus forte que les deux), ou si le proposeur n'est pas plus fort qu'elle et qu'elle ne lui en veut pas ; jamais si l'alliance réunirait toutes les équipes restantes (ce serait la fin de la partie). Les IA s'allient aussi entre elles face à une menace, et parfois sans raison. Elles rompent quand leur allié devient trop fort ou quand l'ennemi commun est presque éliminé, d'autant plus souvent que la difficulté est élevée. Une IA ne cible pas les cases de ses alliés et peut venir défendre une case alliée qu'un ennemi est en train de prendre.

## Options et modes d’escarmouche

Toutes les options sont désactivées par défaut, jamais actives en campagne, et se cochent dans le menu d’escarmouche (onglet « Escarmouche », rubrique « Options »). Elles se combinent librement.

- **Cadeaux entre alliés.** Dans le panneau « Diplomatie » d’un allié : « Donner des élèves » (tes élèves sélectionnés passent dans son équipe avec leurs points de vie) et « Céder une case » (ta case bonus la plus proche de lui ; jamais un camp). Les IA alliées aident parfois un allié en difficulté, toi compris (annoncé).
- **Appel à l’aide.** Bouton « SOS » contre le bord droit : chaque allié IA envoie 30 à 50 % de ses élèves libres (moins si son propre camp est menacé) défendre ton camp le plus menacé pendant 25 s, puis les rend à sa stratégie. Recharge de 60 s affichée sur le bouton. Les IA s’appellent aussi entre elles ; tu es prévenu quand un allié appelle à l’aide.
- **Tribut.** Dans le panneau d’une équipe non alliée : « Payer un tribut » lui cède ta case bonus la plus proche d’elle contre 30 s de trêve (ni combat ni capture entre vous ; drapeau blanc et compte à rebours sur sa puce). Elle refuse si tu n’as pas de case bonus, ou si elle est sur le point de t’écraser. Une IA en mauvaise posture face à toi peut te proposer un tribut : « Accepter » ou « Refuser », la proposition expire au bout de 8 s. Une trêve n’est pas une alliance : elle ne compte pas pour la victoire.
- **Surveillants.** Deux à quatre adultes costauds, neutres et hostiles à toutes les équipes (alliances comprises), patrouillent comme des mini-boss : 600 points de vie (10 élèves), un coup de poing de 32 à 40 (environ 4 fois un élève, un peu plus lent) qui touche aussi les élèves collés à la cible (60 % des dégâts à moins de 0,6 case) et les fait reculer nettement. Un coup de sifflet annonce qu’ils attaquent un élève entré dans leur rayon (2,5 cases) ou qui les frappe ; ils le poursuivent jusqu’à 5 cases, puis reviennent patrouiller et se régénèrent lentement hors combat. Tes élèves inoccupés ripostent ; touche un surveillant (ou relâche la flèche dessus) pour l’attaquer. Il faut une dizaine d’élèves pour en venir à bout (4 à 6 se font battre). L’équipe qui porte le dernier coup est annoncée et gagne +25 % de dégâts pendant 30 s (affiché dans la ligne des bonus) ; le surveillant revient 45 s plus tard à un bord de la cour. Les IA les évitent avec de petits groupes et les attaquent à 8 élèves ou plus, ou quand l’un d’eux garde leur cible. Les KO de surveillants sont comptés sur l’écran de fin. Réglage par simulation : `npx tsx scripts/dev/supervisor-balance.ts`.
- **Brouillard de guerre.** Tu ne vois que les abords de tes élèves, de tes cases et de ceux de tes alliés. Les zones déjà vues restent grisées avec le dernier propriétaire connu des cases ; les ennemis cachés ne s’affichent pas, ne se ciblent pas et leurs effectifs sont masqués dans les puces. Les IA jouent avec la même contrainte.
- **Camps fantômes.** Un à trois camps sans propriétaire, placés équitablement : capturés, ils produisent des élèves comme un camp de départ et comptent pour la victoire.
- **Mode « Roi de la cour ».** Un trône doré 2 × 2 au centre : l’équipe qui le tient cumule du temps de règne (figé s’il est contesté) et gagne, avec ses alliés, à 2 minutes. Les victoires classiques restent valables.

Le code de carte reproduit la disposition, pas les options : choisis-les à nouveau dans le menu.

## Équilibrage et performances

### Couleurs (budget de 12 points)

La répartition des points est fixe ; seule la valeur d'un point dans chaque caractéristique a été réglée, par simulation IA contre IA en difficulté égale (`npx tsx scripts/dev/equilibre.ts equipes=4 parties=4000`, difficulté Difficile par défaut) : à chaque partie, carte (niveaux de campagne et escarmouches de toutes tailles), couleurs (4 parmi les 8) et positions de départ sont tirées au hasard. Objectif : chaque couleur entre 22 % et 28 % de victoires à 4 équipes. Une partie sans vainqueur au bout de 8 minutes (1 sur 4 000) revient à l'équipe en tête. Taux de victoire avec les valeurs retenues (toutes les IA en difficulté Normal, devenue Difficile en v5.2) :

| Mode | Noir | Vert | Jaune | Violet | Rouge | Bleu | Orange | Rose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **4 équipes** (4 000 parties, ~2 000 par couleur ; moyenne 25 %) | 25,9 % | 23,8 % | 22,9 % | 26,0 % | 25,8 % | 25,5 % | 24,0 % | 26,0 % |
| 2 équipes (2 000 parties ; moyenne 50 %) | 50,5 % | 53,9 % | 58,2 % | 51,8 % | 46,9 % | 37,1 % | 61,4 % | 38,9 % |
| 8 équipes (800 parties ; moyenne 12,5 %) | 10,9 % | 12,8 % | 15,0 % | 14,9 % | 13,0 % | 9,4 % | 13,5 % | 10,6 % |

Avec ~2 000 parties par couleur, l'écart dû au hasard est d'environ ±2 points. En duel, la vitesse pèse plus lourd (c'est une course aux cases) : les équipes rapides (Orange, Jaune) y sont avantagées et les lentes (Bleu, Rose) désavantagées. Les régler pour le duel déséquilibrerait les parties à 4 ; on a gardé la cible à 4 équipes. À 8 équipes, chaque couleur joue toutes les parties et les écarts restent modérés.

Valeurs essayées en chemin (4 équipes, 2 000 parties) : avec 0,15 de plus par point partout (vitesse 0,08), le Bleu et le Rose (beaucoup de vie, lents) gagnaient 34–35 % et le Jaune 17 % ; il a fallu réduire la valeur d'un point de vie et presque doubler celle d'un point de vitesse.

### Difficulté Normal : le « joueur témoin »

Faute de joueur humain, un « joueur témoin » simule un joueur moyen : une IA réglée comme l'ancien Normal (aujourd'hui Difficile, dégâts ×1 comme le joueur), mais avec la lenteur d'un humain sur téléphone (une décision toutes les 3 s en moyenne au lieu de 1,5 s) et sans gestion fine : ni pouvoirs, ni pion, ni ralliements, ni classes par camp ; il achète seulement des améliorations. Il affronte 3 IA de même difficulté, à 4 équipes, couleurs et positions tirées au hasard (`npx tsx scripts/dev/equilibre.ts temoin=1 diff=normal parties=4000`). Objectif : 45 à 55 % de victoires en Normal.

| Adversaires (3 IA) | Parties | Victoires du témoin |
| --- | --- | --- |
| Facile | 1 000 | 81,9 % |
| **Normal** (retenu) | 4 000 | **50,2 %** (± 1,5) |
| Difficile (ancien Normal) | 1 000 | 10,7 % |
| Expert (ancien Difficile) | 1 000 | 4,6 % |

Réglages essayés pour Normal (2 000 parties chacun, dégâts ×0,9, 45 % de défenseurs, dépenses moins optimales) : réaction 2,1 s et groupes de 5 → 44,0 % (1 000 parties) ; 2,3 s et 5 → 46,1 % ; 2,6 s et 5 → 48,6 % ; 2,3 s et 6 → 56,2 % ; 2,0 s et 6 → 52,9 % ; retenu : **1,9 s et groupes de 6** → 50,2 % sur 4 000 parties.

### Ancien réglage (multiplicateurs libres, avant la version 5)

Les profils ont été réglés par simulation IA contre IA (`npx tsx scripts/dev/balance.ts normal 4mix` et `… normal 8`), en faisant tourner les couleurs sur toutes les positions. Taux de victoire rapporté à la moyenne, difficulté Normal (aujourd'hui Difficile) :

| Mode | Noir | Vert | Jaune | Violet | Rouge | Bleu | Orange | Rose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 équipes, 4 couleurs parmi 8 (420 parties) | 1,22 | 0,90 | 1,24 | 0,59 | 0,99 | 1,35 | 0,72 | 0,99 |
| « Le tournoi », 8 équipes (64 parties) | 0,91 | 0,91 | 1,36 | 0,15 | 1,51 | 1,21 | 0,91 | 1,06 |

### Bons points

Réglés par simulation IA contre IA (`npx tsx scripts/dev/bons-points.ts normal revenus` et `… normal eco`, cartes à 4 équipes, difficulté Normal de l'époque, aujourd'hui Difficile) :

- une équipe gagne environ 120 bons points par minute de jeu (42 % par les captures, 30 % par les KO, 28 % par les cases tenues) : un premier niveau s'achète au bout de 15 à 30 s, un camp entièrement amélioré (440 bons points) demande plusieurs minutes ;
- classes (`PROD2=1 npx tsx scripts/dev/bons-points.ts normal classes`, camps débloqués d'emblée, 160 parties) : les équipes qui mélangent les classes gagnent 55 % des parties contre celles qui ne produisent que des élèves ; ne produire que des costauds : 60 %, que des sprinteurs : 50 %, jusqu'à 3 infirmiers : 54 % (avec un rayon de soin de 2,2 cases ; 50 % à 1,6). Les classes rapportent un avantage net mais modeste : leurs bons points ne vont pas dans les améliorations ;
- pouvoirs (`… normal pouvoirs`, 120 parties) : les IA qui les utilisent gagnent 55 % des parties ; une partie de 2 min 30 voit en moyenne 3 sonneries (8,6 élèves figés), 4,6 lancers de boules de neige (9,1 élèves touchés) et 2,3 goûters (7 élèves soignés) ;
- pion (`… normal pion0` : la moitié des équipes en reçoit un gratuit dès le départ) : aucun effet mesurable entre IA (48 à 50 % quels que soient ses dégâts), car leurs parties ne se jouent presque jamais sur les camps de départ ; il sert surtout au joueur, contre les raids pendant que son armée est loin. Ses dégâts (×3) sont donc réglés à vue : un intrus isolé tombe en 2 à 3 coups ;
- au total, avec toutes les dépenses, les IA qui dépensent leurs bons points gagnent 62 % des parties contre celles qui les gardent (75 % avec les seules améliorations, 79 % avec des coûts de 20 / 40 / 70 partout, 71 % à 30 / 60 / 100) : les bons points comptent nettement, sans tout décider.

**Version 4 (améliorations globales ou par camp, ralliements des IA)**, 240 parties par mesure (`npx tsx scripts/dev/bons-points.ts normal <mode>`, 4 équipes, positions alternées) :

| Mesure | Résultat |
| --- | --- |
| Revenu | 114 ★ par minute et par équipe (captures 43 %, KO 29 %, cases tenues 29 %) ; 7 niveaux d'amélioration en place en fin de partie |
| Améliorations globales à 40 / 80 / 140, contre celles qui n'en achètent pas (`ameliorations`) | 53 % |
| … à 50 / 100 / 170 (retenu) | 56 % |
| … à 30 / 60 / 110 et 60 / 120 / 200 (120 parties) | 60 % et 60 % (bruit de ± 5 points) |
| Ralliements des IA vers leurs fronts (`ralliement`), à 3 / 5 / 6 / 8 cases du camp au plus | 54 % / 63 % / 67 % (retenu) / 65 % |
| Classes mélangées par camp, déblocage d'emblée (`PROD2=1 … classes`) | 57 % (costauds seuls : 63 %) ; avec un déblocage à 60 ★, les IA ne produisaient que 2 % d'élèves spéciaux, 10 % à 40 ★ (retenu) |
| Toutes dépenses comprises (`eco`) | 68 % en Normal, 75 % en Difficile (aujourd’hui Difficile et Expert) |

Une amélioration globale (50 ★ le premier niveau) coûte 2,5 fois une Défense de camp (20 ★) : elle profite à toute l'équipe et à tous ses camps, présents et futurs. Les simulations ne départagent pas nettement les coûts globaux (les bons points économisés partent en pouvoirs, classes et pions, qui rapportent aussi) ; 50 / 100 / 170 laisse le premier niveau à environ 30 s de jeu et un niveau 3 à plusieurs minutes.

### Performances à 240 élèves

`npx tsx scripts/dev/perf240.ts` mesure le pas de simulation (1/60 s) à 8 équipes × 30 élèves, dans trois situations : une partie IA Expert (ancien Difficile) + diplomatie maintenue près du plafond, une mêlée générale de 240 élèves au centre, et des rafales d'ordres (les 240 élèves changent de destination toutes les 0,5 s). Le budget d'une image à 60 i/s est de 16,7 ms ; on vise un pas sous 4 ms sur iPhone, soit environ 2 ms sur un ordinateur de bureau (Safari mobile est 2 à 3 fois plus lent que Node).

| Sur ordinateur de bureau | Moyenne | 99e centile | Pire pas |
| --- | --- | --- | --- |
| Avant (partie / rafales d'ordres) | 0,24 / 0,30 ms | 1,3 / 2,5 ms | 7,3 / 11,2 ms |
| Après (partie / rafales d'ordres) | 0,19 / 0,21 ms | 0,9 / 0,8 ms | ≈ 2,5 ms (hors à-coups de la machine) |

Les pointes dépassaient le budget d'une image sur iPhone ; elles venaient des rafales de recherches de chemin et du ramasse-miettes. Optimisations retenues, sans toucher au plafond :

- **Recherche de chemin étalée** : au plus 40 calculs d'A* par pas ; au-delà, l'élève part tout droit vers sa destination et son vrai chemin est calculé dans les pas suivants (240 ordres sont résolus en 6 pas, 0,1 s). L'A* utilise un tas binaire et des tableaux de travail réutilisés.
- **Partitionnement spatial** : le hash spatial réutilise ses cellules d'un pas à l'autre (plus d'allocation), et l'IA compte les ennemis autour des cases par requêtes dans ce hash au lieu de parcourir tous les élèves.
- **Rendu** : les planches de sprites sont pré-dessinées une fois par couleur, et l'ombre des élèves est une image en cache (une copie d'image au lieu d'une ellipse par élève). Une image à 240 élèves se dessine en 2 à 4 ms dans le canvas logiciel de test.

## Contrôles tactiles

| Geste | Effet |
| --- | --- |
| Tap sur un élève | Sélectionne l'élève le plus proche du doigt (zone tactile généreuse) et ses voisins proches |
| Appui long puis glisser | Rectangle de sélection |
| Tap sur le sol | Rappel : déplacement sans combat (marqueur blanc), ou charge en mode Charger (marqueur orange). Près d'une case ou d'un camp, l'ordre est aimanté : la case visée s'entoure d'un liseré blanc et les élèves se répartissent à l'intérieur |
| Appui long sans bouger, sans sélection | Point de ralliement du camp le plus proche (drapeau) |
| Glisser depuis un de tes camps jusqu'à un point | Point de ralliement de ce camp |
| Tap sur un ennemi | Ordre d'attaque (marqueur rouge) |
| Glisser à un doigt | Déplacer la caméra |
| Pincer / glisser à deux doigts | Zoom et caméra |
| Tap sur la mini-carte | Centrer la vue à cet endroit |
| Tap sur une mini-barre de bagarre (en haut) | La caméra glisse jusqu'à cette bagarre |
| Double-tap sur un élève | Sélectionne tous tes élèves visibles à l'écran |
| Glisser depuis un élève sélectionné | Flèche d'ordre : déplacement au relâchement, attaque si on relâche sur un ennemi |
| Boutons « 1 », « 2 », « 3 » | Appui long : mémoriser la sélection ; tap : la rappeler ; second tap rapide : centrer la vue dessus |
| Bouton « Camp » | Repli de la sélection (sans combat) sur ton camp le plus proche, pour se soigner |
| Tap sur un de tes camps (sans sélection) ou sur la pastille « ★ » | Panneau d'amélioration du camp |
| Boutons ronds en bas (cloche, boule de neige, gâteau) | Appui long : aide ; glisser jusqu'à la carte : lancer ; tap : armer, puis viser et toucher la zone |
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

## Versions

| Version | Contenu |
| --- | --- |
| `v2-avant-bons-points` | état du jeu avant cette refonte (point de retour) |
| `v3.1` | plafond de 30 élèves par équipe, optimisations pour 240 élèves |
| `v3.2` | bons points et améliorations de camp |
| `v3.3` | classes d'élèves |
| `v3.4` | pouvoirs de récré et pion |
| `v3.5` | tutoriel et « Comment jouer » |
| `v3-avant-camps` | état avant la version 4 (point de retour) |
| `v4.1` | barre de bagarre |
| `v4.2` | améliorations globales / par camp, panneau à deux zones avec navigation |
| `v4.3` | pion et type d'élève par camp, pastilles sur la carte |
| `v4.4` | point de ralliement par camp |
| `v4.5` | aide et glisser-déposer des pouvoirs |
| `v4.6` | IA (améliorations globales, Défense et pion des camps menacés, types par camp, ralliements vers les fronts) et équilibrage |
| `v4-avant-equilibrage` | état avant le rééquilibrage (point de retour) |
| `v5.1` | équipes à budget fixe de 12 points, valeur d'un point réglée par simulation |
| `v5.2` | 4 niveaux de difficulté (nouveau Normal plus doux, Difficile et Expert = anciens Normal et Difficile), sauvegardes converties |

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
    diplomacy-extras.ts  options cadeaux, appel à l’aide, tribut et trêve
    king.ts            mode Roi de la cour : trône, temps de règne, victoire, aide à l'IA
    pathfinding.ts     A* 8 voisins + lissage
    spatial.ts         hash spatial pour les voisinages
    grid.ts            grille de navigation et obstacles
    mapgen.ts          générateur de cartes aléatoires (camps, cases bonus, obstacles)
    maps.ts            les 6 niveaux
    skirmish.ts        réglages d'escarmouche → niveau construit à la volée
    mapcode.ts         code de carte partageable (type de partie + graine, base 32)
    challenges.ts      médailles de campagne
    ghosts.ts          option « Camps fantômes » : placement, carte d’une partie, intérêt des IA
    save.ts            progression (localStorage)
    merits.ts          bons points : gains, solde, dépenses
    upgrades.ts        améliorations globales (Production, Uniformes, Entraînement, classes) et Défense par camp
    camps.ts           camps d'une équipe : ordre, numéro, nom
    ai-economy.ts      dépenses de bons points des IA selon la difficulté (améliorations, classes, pouvoirs)
    classes.ts         classes d'élèves : Costaud, Sprinteur, Infirmier
    powers.ts          pouvoirs de récré : Sonnerie, Boules de neige, Goûter
    brawls.ts          bagarres : détection, force de chaque équipe, tendance
    pion.ts            pion : surveillant d'équipe qui garde un camp
    tutorial.ts        tutoriel : carte, étapes, validation par les actions du joueur
  render/              rendu canvas 2D
    sprites.ts         élèves dessinés pixel par pixel : 8 directions, marche, coup, KO, silhouettes des classes
    suits.ts           symboles de cartes en vectoriel
    renderer.ts        sol iso, cases, obstacles, unités triées par profondeur, marqueurs
    minimap.ts         mini-carte
    king.ts            trône doré, couronne pixel, repère sur la mini-carte
    camera.ts          zoom, déplacement, cadrage
    merits.ts          étoile, gains flottants, fanions d'amélioration des camps
    powers.ts          aperçu de la zone visée, effets des pouvoirs, élèves figés
    brawls.ts          barres de bagarre (segments, tendance, fondu)
  input/touch.ts       gestes tactiles et souris
  audio/sfx.ts         sons synthétisés (Web Audio)
  ui/                  menu, HUD, fenêtres (pause, fin, installation, accueil, « Comment jouer »)
    camp-panel.ts      pastille des bons points et panneau d'amélioration d'un camp
    class-section.ts   rubrique « Ce camp produit » (classes d'élèves)
    pion-section.ts    rubrique « Pion » du panneau du camp
    powers-hud.ts      boutons des pouvoirs de récré
    tutorial-ui.ts     bulle, main animée et bouton « Passer » du tutoriel
    rally-section.ts   rubrique « Ralliement » du panneau du camp
    brawl-hud.ts       mini-barres des bagarres hors écran
public/
  manifest.webmanifest, sw.js, icons/
tests/                 capture, combat, victoire, alliances, pathfinding, bons points, classes, pouvoirs, pion, tutoriel, tests d'intégration jsdom
scripts/dev/           outils de développement (lancés avec `npx tsx`)
  balance.ts           équilibrage IA contre IA (modes 4, 4mix, 8, 8d)
  equilibre.ts         équilibrage des couleurs : couleurs et positions au hasard, sur plusieurs processus
  perf8.ts             temps de simulation à 8 équipes
  perf240.ts           pas de simulation et rendu au plafond (8 × 30 élèves)
  bons-points.ts       équilibrage des bons points (revenus, effet des dépenses)
  render-v3.ts         aperçus des nouveautés v3 (fanions, gains, classes, pouvoirs)
  roi.ts               parties IA contre IA en mode Roi de la cour (durée, type de victoire)
  render-check.ts      rendu hors navigateur (planches de sprites, scène de jeu)
  white-check.ts       comparaison Blanc / Rose pour la 8e couleur
```

Stack : TypeScript, Vite, canvas 2D pur (pas de moteur), Vitest. Aucune dépendance côté serveur, aucune dépendance d'exécution.
