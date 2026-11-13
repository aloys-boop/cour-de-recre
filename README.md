# Cour de Récré

Jeu de stratégie en temps réel isométrique, jouable au doigt sur iPhone (Safari) et installable comme application hors ligne. Remake personnel et non commercial, inspiré dans l'esprit d'un jeu Flash des années 2000 : tous les graphismes, sons et le nom sont originaux et générés par le code.

De deux à huit équipes d'élèves en uniforme (Noir, Vert, Jaune, Violet, Rouge, Bleu, Orange, Rose) se disputent les cases d'une cour de récréation. Tu diriges l'une d'elles, les autres (jusqu'à sept) sont contrôlées par l'ordinateur, toutes sur le même téléphone, sans réseau. En cours de partie, les équipes peuvent s'allier… et se trahir.

## Tutoriel et « Comment jouer »

- **Tutoriel.** Proposé automatiquement au premier lancement (« Faire le tutoriel » ou « Plus tard »), puis rejouable à tout moment : il est en tête de l'onglet « Campagne » du menu. Petite cour de 11 × 11 contre une autre équipe (les Verts, ou les Noirs si tu joues les Verts : la bulle nomme toujours le vrai adversaire, v5.9), IA passive (ses élèves restent chez eux et ne sont pas produits) jusqu'à la dernière étape, où elle se réveille en Facile avec des coups adoucis. Treize étapes guidées par une bulle de texte et une main animée qui montre où toucher ; chacune n'avance que sur l'action réelle du joueur : sélectionner un élève, sélection rectangle, déplacer, capturer une case, attaquer (deux adversaires approchent), poser un point de ralliement, bouger la caméra (glisser, pincer ou mini-carte), gagner des bons points en prenant une case, la confier à une garnison (bouton « Garder »), améliorer l'équipe, lire l'aide d'un pouvoir (appui long sur le Goûter), le lancer par glisser-déposer (ou l'ancien mode), gagner la partie en prenant le camp adverse. La bulle se place d'elle-même là où elle ne cache ni la main, ni ce qu'elle montre, ni le bon bouton d'un panneau ouvert (en haut au centre par défaut, sinon en bas ou sur un côté, v5.9) ; panneau du camp ouvert, elle dit quel bouton toucher. Le directeur complète au besoin les bons points pour essayer l'amélioration et le pouvoir. Le bouton « Passer » reste toujours visible et ramène au menu. Le tutoriel ne fait pas partie de la liste des niveaux : les codes de carte et la progression de la campagne sont inchangés.
- **Comment jouer.** Les règles en rubriques courtes (but, sélection, déplacement et attaque, cases et camps, effectifs, bons points, améliorations, classes, garnisons, pouvoirs, pion, caméra, ralliement, les IA, alliances), depuis le bouton « Comment jouer » du menu et du menu pause.

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
- **Effectifs (v5.9).** En haut, chaque puce d'équipe donne son nombre d'élèves en jeu ; la tienne affiche « élèves / maximum » (par exemple 18/30), en jaune quand le plafond est atteint et que tes camps ne produisent plus. Avec le brouillard de guerre, un œil précède le nombre des équipes ennemies : seuls les élèves que tu vois en ce moment sont comptés (les tiens et ceux de tes alliés le sont toujours en entier). Touche ta propre puce : le détail « Effectifs » donne, pour chaque équipe, ses élèves, ses cases et ses camps (sous le brouillard, tels que tu les as vus). Recompté 4 fois par seconde.
- **Alertes (v5.7).** Quand une de tes cases est menacée (un ennemi à moins de 2,6 cases depuis plus de 2 s, ou une jauge ennemie qui monte), qu'elle tombe, ou que ton camp est en danger, un bandeau apparaît en haut au centre (jaune : case attaquée ; rouge pulsant : camp ; bordeaux : case perdue), avec un « ding-dong » discret et une petite vibration pour le camp et les pertes. Touche le bandeau (« Y aller ») : la caméra glisse jusqu'à la case. Pour ne pas noyer le joueur, une case n'est signalée qu'une fois par attaque (puis après 12 s de calme), deux alertes sont séparées d'au moins 6 s, et ce qui arrive entre-temps est regroupé (« 3 cases attaquées », « Ton camp est attaqué, et 2 autres cases ! »), en pointant la plus urgente. Pas d'alerte pendant le tutoriel.
- **Renforts automatiques (v5.8).** Dans le panneau d'un camp (zone « Ce camp »), l'interrupteur **Auto** de la ligne « Renforts » : chaque nouvel élève de ce camp part de lui-même secourir ta case la plus menacée, en se battant en chemin. Menace d'une case (bonus, camp ou trône) : nombre d'ennemis à moins de 2,6 cases, plus la jauge de capture ennemie ; un camp compte davantage, et une case lointaine moins (au-delà de 16 cases du camp, elle n'est pas secourue). Si rien n'est menacé, les nouveaux élèves vont au drapeau de ralliement comme d'habitude ; si le camp lui-même est le plus menacé, ils restent le défendre. Un pointillé animé à chevrons relie le camp à la case secourue, avec un « + » au-dessus d'elle ; la ligne d'état du panneau dit où partent les renforts. **Partout** active l'option dans tous tes camps. Un camp perdu perd son option (à réactiver s'il est repris). Petit appel de clairon et vibration à l'activation.
- **Garnisons (v5.5).** Le bouton **Garder** (à gauche, à côté de « Camp ») confie une case à la sélection. Si tes élèves se tiennent déjà sur une case bonus, un camp ou le trône, ils la gardent aussitôt ; sinon le bouton s'allume en jaune et le prochain tap sur une case la leur confie (retoucher le bouton annule, un tap à côté des cases aussi). Les gardes courent sur la case en se battant en chemin, puis :
  - restent dans la zone de capture et reviennent s'y placer dès qu'ils sont libres ;
  - engagent d'eux-mêmes tout ennemi qui entre dans le **cercle défendu** (2,6 cases autour de la case, plus loin que la portée d'un élève inoccupé) ;
  - ne se laissent pas attirer loin : un ennemi qui s'enfuit à plus de 3,8 cases de la case est lâché, et le garde revient ;
  - **reprennent la case** si elle tombe, en y retournant ;
  - sont **retranchés** (v5.10) : tant qu'il se tient dans le cercle défendu de sa case, un garde encaisse un quart de coups en moins. Un coup ainsi amorti fait un « tink » plus sec et, une fois sur quatre, un « Paré ! » bleu au-dessus de la mêlée.

  Un écusson à ta couleur, contre le coin droit de la case, compte ses gardes vivants ; le cercle défendu (pointillés blancs) s'affiche quand des gardes sont sélectionnés, et pour toutes tes garnisons pendant que « Garder » est allumé. Tout nouvel ordre (déplacement, attaque, « Camp ») libère les élèves qui le reçoivent. Les pions ne gardent pas ; un infirmier de garde soigne sans aller au contact. Son « garde à vous » (deux talons qui claquent) confirme l'ordre. Les IA ne posent pas de garnison en partie.
- **Conquête (v5.11).** Le bouton **Conquérir** (le drapeau, sous « Camp » depuis la v5.12) donne une consigne à la sélection : elle devient une escouade qui prend toute seule la case la plus intéressante à portée (22 cases au plus), puis la suivante, sans autre ordre. Choix de la case : la plus proche parmi les cases **libres** (sans propriétaire : cases bonus, trône, camps libres comme les camps fantômes), un peu plus chère si tu ne l'as jamais vue (4 cases de distance) ou par défenseur ennemi visible (2,5 cases chacun) ; un camp ou le trône passe avant une case bonus à distance comparable. Les cases et les camps tenus par une autre équipe ne sont jamais visés : prendre le terrain de l'adversaire reste ta décision (voir « Équilibrage », une escouade qui le faisait rendait Normal beaucoup trop facile). L'escouade ne voit que ce que tu vois (sous le brouillard, les défenseurs cachés ne comptent pas) et renonce pour 12 s à une case trop bien défendue (plus de 1,25 défenseur par élève de l'escouade, plus un). Elle court en se battant en chemin, comme un ordre « Charger ». Un drapeau planté à ta couleur, relié à l'escouade par des tirets, marque la case visée ; un groupe « 1 », « 2 » ou « 3 » dont la majorité est en conquête porte un petit drapeau. Retoucher « Conquérir » avec l'escouade sélectionnée lève la consigne ; tout autre ordre (déplacement, attaque, « Camp », « Garder ») fait quitter l'escouade aux élèves qui le reçoivent. Rien à prendre à portée : l'escouade attend et repart dès qu'une case s'ouvre. Roulement de tambour et deux notes de clairon confirment l'ordre. Les pions ne conquièrent pas ; les IA ne s'en servent pas en partie.
- **Défense (v5.12).** Le bouton **Défendre** (le bouclier bleu, à droite de « Conquérir », sur la même rangée) donne l'autre consigne d'escouade : la sélection devient une **garnison mobile**. Son secteur : la case où elle se tient (même si elle n'est pas encore à toi) et tes cases (bonus, camps, trône) à 7 cases au plus, les plus proches d'abord, 4 cases en tout au plus. Elle se poste sur la case la plus centrale du secteur (petit bouclier planté à ta couleur, tirets vers les autres cases). Dès qu'un ennemi visible entre sur une case du secteur, ou qu'une case tombe ou commence à être prise, elle y court (bouclier bleu « ! » et tirets bleus), chasse les intrus, reprend la case, puis revient au poste. Elle ne poursuit personne au-delà de 4,2 cases de son secteur et ne se jette pas sur une case trop défendue pour sa taille (même seuil que la conquête) ; elle tient alors son poste. Dans le cercle défendu de ses cases, elle est **retranchée** comme des gardes (un quart de coups en moins, « Paré ! »). Un groupe « 1 », « 2 » ou « 3 » dont la majorité est en défense porte un petit bouclier bleu (à gauche ; le drapeau de conquête est à droite). Retoucher « Défendre » lève la consigne ; « Défendre » sur une escouade en conquête la fait changer de consigne ; tout autre ordre fait quitter l'escouade. Loin de tes cases, l'ordre est refusé avec une aide. Coup de sifflet et deux pas lourds confirment l'ordre. Les pions ne défendent pas ; les IA ne s'en servent pas en partie.
- **Escorte (v5.13).** Le bouton **Suivre** (le rond vert à double chevron, à droite de « Garder », sur la rangée de « Camp ») donne la troisième consigne d'escouade : la sélection devient une **escorte**. Touche « Suivre » (le bouton s'allume et pulse), puis touche le groupe à escorter : un de tes élèves hors de la sélection (avec ses voisins proches ; s'il fait partie d'un groupe 1-2-3, tout ce groupe ; s'il est dans une escouade en conquête ou en défense, toute l'escouade, y compris ses futurs membres), ou directement un bouton « 1 », « 2 » ou « 3 » (liseré vert pendant l'attente), pratique quand le groupe est hors de l'écran. L'escorte colle au protégé : elle se remet en route dès qu'elle est à plus de 2,2 cases de lui (plus son étalement), en se battant en chemin ; elle se jette sur tout ennemi visible à moins de 3 cases d'un protégé (7 cases au plus de l'élève d'escorte) et lâche ceux qui s'éloignent à plus de 4,5 cases de tout protégé. Quand le protégé s'arrête sur une case, l'escorte la prend avec lui. Un écusson vert flotte au-dessus du protégé, relié à l'escorte par des tirets quand elle est à la traîne ; un groupe « 1 », « 2 » ou « 3 » dont la majorité est en escorte porte un petit écusson vert (en haut à gauche). Retoucher « Suivre » pendant l'attente l'annule ; avec l'escorte sélectionnée, il lève la consigne ; tout autre ordre fait quitter l'escorte. Quand plus aucun protégé n'est debout, l'escorte se disperse et une aide le signale. Deux claquements de mains et une petite tierce confirment l'ordre. Les pions ne font pas partie d'une escorte, mais ton pion peut être escorté ; les IA ne s'en servent pas en partie.
- **Point de ralliement (par camp).** Chaque camp a son propre drapeau ; les nouveaux élèves de ce camp s'y rendent dès leur naissance. Trois façons de le poser :
  - dans le panneau du camp, rubrique « Ralliement » : « Placer » (ou « Déplacer »), puis touche la carte ; « Supprimer » retire le drapeau, et les nouveaux élèves restent alors au camp ;
  - raccourci : glisse le doigt depuis le camp jusqu'à un point de la carte (une flèche à ta couleur suit le doigt) ;
  - comme avant : sans sélection, un appui long sur le sol (sans glisser) pose le drapeau du camp le plus proche ; un appui long sur un de tes camps efface son drapeau.

  Le drapeau est à la couleur de ton équipe et porte le numéro du camp (celui du panneau, « Camp 2/4 »). La ligne pointillée du camp vers son drapeau est visible quand le panneau de ce camp est ouvert, et pour tous tes camps pendant que tu poses un ralliement. Un camp capturé perd son ralliement.
- **Régénération.** Un élève qui se tient sur son propre camp, ou sur un cœur que son équipe possède, récupère ses points de vie (environ 7 par seconde) : de petits cœurs montent au-dessus de lui. Les élèves d'une équipe qui possède au moins un pique marchent sur une aura rougeâtre.
- **Victoire.** Une équipe gagne quand elle est la dernière à avoir encore des élèves ou un camp, ou quand elle possède tous les camps. Si toutes les équipes encore en vie sont alliées entre elles (ou si une alliance tient tous les camps), **l'alliance gagne ensemble** : « Victoire de l'alliance ! », avec les couleurs alliées. Tu perds dès que tu n'as plus ni élèves ni camp, même si ton alliance l'emporte.
- **Cartes.** Six niveaux de taille croissante (du Préau au Campus, de 14 à 22 cases bonus, puis « Le tournoi » : 8 équipes, 26 × 26, 28 cases, débloqué après le 5e). La disposition des cases et des obstacles est tirée au sort à chaque partie, de façon symétrique pour rester équitable. Chaque victoire débloque le niveau suivant ; la progression est sauvegardée sur l'appareil.
- **Escarmouche.** Partie libre : nombre d'équipes (2 à 8), taille de la cour (petite, moyenne, grande, immense), cases bonus (de 4 à 30, quel que soit le nombre d'équipes), difficulté et couleur parmi les huit. Les cases bonus se règlent de deux façons : « Équilibrés » (un total, réparti à parts égales entre ♥ ♠ ♣ ♦, comme dans la campagne) ou « Personnalisés » (le nombre de cases de chaque symbole, de 0 à 30 chacun, pour un total de 4 à 30 : par exemple une cour sans ♠, ou 30 ♦). Sur une cour symétrique (2, 4, 6 ou 8 équipes), deux cases miroir reçoivent le même symbole ; un symbole en nombre impair partage sa dernière paire avec un autre. La cour grandit de deux cellules par équipe au-delà de quatre. Les victoires d'escarmouche ne débloquent rien dans la campagne.
- **Roi de la cour** (mode d'escarmouche). Un trône doré de 2 × 2 cellules, marqué d'une couronne, occupe le centre de la cour (les cases bonus et obstacles qui le touchaient sont retirés, de façon symétrique et reproductible). Il ne donne ni bonus ni élèves : il se capture comme un camp, et son propriétaire accumule du temps de règne tant que des ennemis ne le contestent pas. Le règne est compté par équipe et ne se transmet pas ; la première équipe à **2 minutes cumulées** gagne, avec ses alliés encore en vie (comme une alliance qui tient tous les camps) : « Roi de la cour ! ». Les autres victoires restent possibles. Un cadre sous les bonus affiche ton règne, celui du meneur et du tenant du trône ; annonces « Les Verts prennent le trône ! », « Plus que 20 s pour les Jaunes ! » ; l'écran de fin donne le temps de règne de chaque équipe. Les IA visent le trône en priorité (d'autant plus que son tenant approche des 2 minutes) et y laissent une garnison quand elles le tiennent.
- **Code de carte.** Chaque partie a un code de 6 caractères (sans 0, 1, I ni O) ; 10 caractères pour une escarmouche personnalisée ou de moins de 10 cases (moins de 20 à partir de 5 équipes), affiché dans le menu pause et sur l'écran de fin avec un bouton « Copier ». Saisi dans le menu, il redonne exactement la même disposition (niveau ou réglages d'escarmouche compris, de 2 à 8 équipes). Les codes des versions précédentes restent valides et redonnent la même carte.
- **Médailles.** Chaque niveau de campagne propose trois médailles : victoire, victoire sans perdre son camp, victoire en moins de 3 minutes de jeu. Elles sont sauvegardées et affichées sous forme de pastilles dans la liste des cartes.
- **Difficulté.** Quatre niveaux : Facile, Normal, Difficile, Expert. Plus c'est dur, plus les IA réagissent vite, attaquent avec de petits groupes, gardent peu de défenseurs, frappent fort et dépensent bien leurs bons points :

  | Niveau | Réaction | Groupe d'attaque | Défenseurs gardés | Dégâts IA | Bons points |
  | --- | --- | --- | --- | --- | --- |
  | Facile | 2,6 s | 5 | 50 % | ×0,75 | achats lents, au hasard, pas de pouvoir |
  | Normal | 1,9 s | 5 | 45 % | ×0,9 | achats retardés (toutes les 6 s, avec 40 % de marge), choix au hasard 4 fois sur 10, pouvoirs une occasion sur deux, visés à ±1,8 case |
  | Difficile | 1,5 s | 4 | 35 % | ×1 | achats raisonnés toutes les 4 s |
  | Expert | 0,8 s | 3 | 20 % | ×1,15 | achats raisonnés toutes les 2 s |

  **Attention limitée (v5.4).** Comme un joueur sur téléphone, une IA ne peut pas être partout à la fois. Elle dispose d'un budget d'ordres (un ordre = un groupe envoyé quelque part), qui se recharge au fil des secondes ; elle ne secourt qu'un nombre limité de cases menacées à chaque réflexion (le camp d'abord, puis la case la plus près d'être prise) ; et chaque case attaquée n'est remarquée qu'après un délai qui lui est propre. Le menu affiche ces chiffres sous les boutons de difficulté. Attaquer sur deux fronts à la fois paie donc enfin :

  | Niveau | Ordres par minute | Cases secourues à la fois | Délai pour remarquer une attaque |
  | --- | --- | --- | --- |
  | Facile | 10 | 1 | 2,5 s |
  | Normal | 18 | 1 | 1,6 s |
  | Difficile | 28 | 2 | 1 s |
  | Expert | 40 | 3 | 0,5 s |

  Normal est réglé pour qu'un joueur moyen gagne environ une partie sur deux à 4 équipes (voir « Équilibrage »). Difficile et Expert sont les anciens Normal et Difficile (avant la v5.2) : une ancienne sauvegarde réglée sur « Normal » s'ouvre en Difficile, « Difficile » en Expert.
- **Rythme réglable (v5.14), en Facile et Normal.** Un sablier en haut à droite déclenche la **pause tactique** : la cour se fige (liseré bleu glacé, bandeau « Pause tactique »), personne ne bouge, mais tu peux sélectionner, donner tes ordres, poser tes consignes, acheter des améliorations et lancer tes pouvoirs ; tout part dès que tu touches ▶ (le sablier) ou « Reprendre » sur le bandeau. Dans la pause, la rubrique « Rythme » règle la **vitesse** (Normale, ou Lente ×0,75 : trois secondes de jeu pour quatre secondes réelles) et peut masquer le sablier ; les deux réglages sont mémorisés. En Difficile et Expert, et dans le tutoriel, la cour tourne toujours à pleine vitesse, sans pause tactique.
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
- **Rompre.** Une rupture est annoncée 30 s à l'avance depuis la v5.6 (« Les Verts vont rompre l'alliance dans 30 s ! »), pour l'IA comme pour toi : un badge rouge sous la puce de l'équipe compte les secondes, et un rappel tombe 10 s avant. Une même paire d'équipes ne peut pas changer d'alliance plus d'une fois toutes les 30 s.
- **Ce que pense l'IA.** Chaque IA estime la puissance de chaque équipe (vie et dégâts de ses élèves, camps, cases) et garde une attitude envers chacune (rancune quand on lui met des élèves KO, méfiance pendant 2 minutes envers qui l'a trahie). Elle accepte une alliance face à une menace commune (une équipe au moins 1,5 fois plus forte que les deux), ou si le proposeur n'est pas plus fort qu'elle et qu'elle ne lui en veut pas ; jamais si l'alliance réunirait toutes les équipes restantes (ce serait la fin de la partie). Les IA s'allient aussi entre elles face à une menace, et parfois sans raison. Elles rompent quand leur allié devient trop fort ou quand l'ennemi commun est presque éliminé, d'autant plus souvent que la difficulté est élevée. Cette trahison de fin de partie (ennemis restants pesant moins d'un quart de l'IA) a une chance par réflexion (toutes les 7 s environ) de 4 % en Facile, 8 % en Normal, 25 % en Difficile et 70 % en Expert (avant la v5.6 : 15 et 25 % en Facile et Normal, soit une rupture presque sûre en moins de 30 s).
- **Abandonner.** Dans la pause, « Abandonner » (avec confirmation) termine la partie en défaite et affiche l'écran de fin « Abandon » avec le tableau des statistiques. Un abandon ne débloque rien et ne donne aucune médaille. Une IA ne cible pas les cases de ses alliés et peut venir défendre une case alliée qu'un ennemi est en train de prendre.

## Options et modes d’escarmouche

Toutes les options sont désactivées par défaut, jamais actives en campagne, et se cochent dans le menu d’escarmouche (onglet « Escarmouche », rubrique « Options »). Elles se combinent librement.

- **Cadeaux entre alliés.** Dans le panneau « Diplomatie » d’un allié : « Donner des élèves » (tes élèves sélectionnés passent dans son équipe avec leurs points de vie) et « Céder une case » (ta case bonus la plus proche de lui ; jamais un camp). Les IA alliées aident parfois un allié en difficulté, toi compris (annoncé).
- **Appel à l’aide.** Bouton « SOS » contre le bord droit : chaque allié IA envoie 30 à 50 % de ses élèves libres (moins si son propre camp est menacé) défendre ton camp le plus menacé pendant 25 s, puis les rend à sa stratégie. Recharge de 60 s affichée sur le bouton. Les IA s’appellent aussi entre elles ; tu es prévenu quand un allié appelle à l’aide.
- **Tribut.** Dans le panneau d’une équipe non alliée : « Payer un tribut » lui cède ta case bonus la plus proche d’elle contre 30 s de trêve (ni combat ni capture entre vous ; drapeau blanc et compte à rebours sur sa puce). Elle refuse si tu n’as pas de case bonus, ou si elle est sur le point de t’écraser. Une IA en mauvaise posture face à toi peut te proposer un tribut : « Accepter » ou « Refuser », la proposition expire au bout de 8 s. Une trêve n’est pas une alliance : elle ne compte pas pour la victoire.
- **Surveillants.** Deux à quatre adultes costauds, neutres et hostiles à toutes les équipes (alliances comprises), patrouillent comme des mini-boss : 600 points de vie (10 élèves), un coup de poing de 32 à 40 (environ 4 fois un élève, un peu plus lent) qui touche aussi les élèves collés à la cible (60 % des dégâts à moins de 0,6 case) et les fait reculer nettement. Un coup de sifflet annonce qu’ils attaquent un élève entré dans leur rayon (2,5 cases) ou qui les frappe ; ils le poursuivent jusqu’à 5 cases, puis reviennent patrouiller et se régénèrent lentement hors combat. Tes élèves inoccupés ripostent ; touche un surveillant (ou relâche la flèche dessus) pour l’attaquer. Il faut une dizaine d’élèves pour en venir à bout (4 à 6 se font battre). L’équipe qui porte le dernier coup est annoncée et gagne +25 % de dégâts pendant 30 s (affiché dans la ligne des bonus) ; le surveillant revient 45 s plus tard à un bord de la cour. Les IA les évitent avec de petits groupes et les attaquent à 8 élèves ou plus, ou quand l’un d’eux garde leur cible. Les KO de surveillants sont comptés sur l’écran de fin. Réglage par simulation : `npx tsx scripts/dev/supervisor-balance.ts`.
- **Brouillard de guerre.** Tu ne vois que les abords de tes élèves, de tes cases et de ceux de tes alliés : chaque case ou camp possédé éclaire toujours 2,5 cases autour de lui, même sans élève dessus. Les zones déjà vues restent grisées avec le dernier propriétaire connu des cases ; les ennemis cachés ne s’affichent pas, ne se ciblent pas et leurs effectifs sont masqués dans les puces. Les IA jouent avec la même contrainte.
- **Camps fantômes.** Un à trois camps sans propriétaire, placés équitablement : capturés, ils produisent des élèves comme un camp de départ et comptent pour la victoire.
- **Équipes fixes (v5.6).** « Libre » (par défaut) ou « Par 2 », « Par 3 », « Par 4 » : les équipes sont formées dès le début (4 équipes : 2 contre 2 ; 6 : 3 contre 3 ou 2 contre 2 contre 2 ; 8 : 4 contre 4 ou 2 contre 2 contre 2 contre 2). Les tailles qui ne partagent pas le nombre d'équipes en groupes égaux sont grisées. Les coéquipiers ont des camps voisins (camps rangés dans l'ordre du tour de la cour, découpage qui rapproche le plus les coéquipiers) et sont alliés pour toute la partie : aucune proposition ni rupture, pas de diplomatie avec les autres équipes, victoire partagée par toute l'équipe. Les IA coéquipières défendent tes cases comme celles d'un allié. Si tu es éliminé, la partie est perdue pour toi, même si tes coéquipiers continuent. Se combine avec toutes les options (cadeaux et appel à l'aide entre coéquipiers, tribut avec l'adversaire).
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

Faute de joueur humain, un « joueur témoin » simule un joueur moyen : une IA réglée comme l'ancien Normal (aujourd'hui Difficile, dégâts ×1 comme le joueur), mais avec la lenteur d'un humain sur téléphone (une décision toutes les 3 s en moyenne au lieu de 1,5 s) et sans gestion fine : ni pouvoirs, ni pion, ni ralliements, ni classes par camp ; il achète seulement des améliorations. Il affronte 3 IA de même difficulté, à 4 équipes, couleurs et positions tirées au hasard (`npx tsx scripts/dev/equilibre.ts temoin=1 diff=normal parties=4000`). Objectif : 45 à 55 % de victoires en Normal (un peu moins de 45 % depuis la v5.6, à la demande d'Aloys : voir plus bas).

| Adversaires (3 IA) | Parties | Victoires du témoin |
| --- | --- | --- |
| Facile | 1 000 | 81,9 % |
| **Normal** (retenu) | 4 000 | **50,2 %** (± 1,5) |
| Difficile (ancien Normal) | 1 000 | 10,7 % |
| Expert (ancien Difficile) | 1 000 | 4,6 % |

Réglages essayés pour Normal (2 000 parties chacun, dégâts ×0,9, 45 % de défenseurs, dépenses moins optimales) : réaction 2,1 s et groupes de 5 → 44,0 % (1 000 parties) ; 2,3 s et 5 → 46,1 % ; 2,6 s et 5 → 48,6 % ; 2,3 s et 6 → 56,2 % ; 2,0 s et 6 → 52,9 % ; retenu : **1,9 s et groupes de 6** → 50,2 % sur 4 000 parties.

### Attention limitée des IA (v5.4)

Depuis la v5.4, le témoin a lui aussi l'attention d'un humain sur téléphone : 20 ordres par minute au plus, une seule case secourue à la fois, 2 s pour remarquer une attaque (`HUMAN_ATTENTION`). Le script affiche les ordres par minute réellement donnés (`avant=1` rend l'attention illimitée à tout le monde, comme avant). Mesures à 4 équipes, témoin contre 3 IA :

| Adversaires | Ordres par minute des IA (avant → après) | Témoin humain contre l'ancienne IA | Témoin humain contre la nouvelle IA |
| --- | --- | --- | --- |
| Facile | 18,5 → 8,4 | | 96,5 % (600 parties) |
| **Normal** | 23,3 → 14,5 | 51,0 % (800 parties) | **54,3 %** (800 parties, ± 3,5) |
| Difficile | 31,9 → 22,1 | | 13,3 % (600 parties) |
| Expert | 50,7 → 31,1 | | 5,0 % (400 parties) |

Le témoin donne environ 18 ordres par minute. L'attention limitée seule faisait passer le témoin de 51 % à 65,5 % en Normal ; pour revenir près d'une partie sur deux, les groupes d'attaque de Normal passent de 6 à 5 élèves (essais à 400 parties : budget de 24 ordres → 58,3 % ; réaction 1,7 s → 62,3 % ; 38 % de défenseurs → 57,8 % ; groupes de 5 → 52,8 %, retenu). L'IA garde donc sa force de frappe, mais elle n'est plus partout : à 4 IA Normal entre elles (1 200 parties), chaque couleur gagne entre 20,0 % (Orange) et 28,0 % (Vert, Rouge).

### Garnisons (v5.5)

Les IA ne posent pas de garnison : l'équilibre de Normal est inchangé (témoin à 53,8 %, 1 600 parties, contre 54,3 % en v5.4). Pour mesurer l'outil, `equilibre.ts` accepte `garde=N` (le témoin laisse N gardes sur chaque case bonus prise) et `part=0,25` (part maximale de son armée en garnison). Témoin en Normal, 4 équipes :

| Garnisons du témoin | Victoires du témoin |
| --- | --- |
| aucune | 53,8 % (1 600 parties) |
| 1 garde par case, 15 % de l'armée au plus | 46,5 % (600) |
| 2 gardes par case, 15 % de l'armée au plus | 47,0 % (600) |
| 2 gardes par case, 25 % au plus | 36,8 % (600) |
| 1 garde par case, sans limite | 26,1 % (1 600) |

Une garnison n'est pas gratuite : chaque garde manque aux groupes d'attaque, et un témoin qui défend déjà ses cases à la main (20 ordres par minute) ne gagne rien à figer ses élèves. L'outil sert le joueur qui ne peut pas surveiller toutes ses cases ; le vrai gain sera mesuré avec un témoin qui, comme un humain, ne secourt plus ses cases lui-même (point 1.1 bis de la feuille de route).

Performances : `perf240` sans changement (partie 0,180 ms par pas contre 0,188, mêlée 0,102 contre 0,095, ordres 0,147 contre 0,169) ; 240 élèves tous en garnison sur 48 cases et en mêlée : 0,275 ms par pas.

### Renforts automatiques (v5.8)

Les IA n'utilisent pas l'option : leur équilibre est inchangé. `equilibre.ts` accepte `renforts=1` (le témoin met chacun de ses camps en renforts automatiques, y compris les camps pris). Témoin en Normal, 4 équipes, 800 parties, même graine :

| Témoin | Victoires | Ordres par minute du témoin | Durée moyenne |
| --- | --- | --- | --- |
| sans renforts | 40,5 % (± 3,4) | 17,5 | 188 s |
| renforts automatiques | **46,9 %** (± 3,5) | 17,4 | 180 s |

Six points de mieux sans un ordre de plus : les nouveaux élèves ne restent plus plantés au camp pendant qu'une case tombe. L'outil aide sans dispenser de jouer. `perf240` sans changement (partie 0,219 ms par pas contre 0,224 sur la même machine avant la modification) ; le choix de la case coûte une requête dans le hash spatial par case et par camp, toutes les 0,5 s et à chaque naissance.

### Témoin humain et gardes retranchés (v5.10)

Point 1.1 bis de la feuille de route. Le témoin habituel secourt lui-même chaque case menacée, ce qu'un joueur sur téléphone ne fait pas. `equilibre.ts` accepte désormais `secours=all|camps|none` (cases que le témoin secourt lui-même), `harcele=N` (petit groupe envoyé prendre une case sans défenseur, à au moins 5 cases de la cible principale) et le raccourci `style=humain` (`secours=camps renforts=1 harcele=3`) ; `rayon=`, `laisse=` et `armure=` changent les réglages des garnisons. Témoin en Normal, 4 équipes, 800 parties par ligne (± 3,5 environ) :

| Témoin | Graine 1 | Graine 2 |
| --- | --- | --- |
| classique (secourt tout, sans renforts) | 40,5 % | |
| classique avec renforts | 46,9 % | |
| **humain** : camps seulement, renforts, second front | **49,9 %** | **52,0 %** |
| humain sans second front | 50,2 % | |
| humain, 2 gardes par case bonus (30 % de l'armée au plus) | 30,9 % | 28,0 % |
| idem, 15 % au plus | 42,8 % | |
| idem avec gardes retranchés (×0,75) | 34,3 % (×0,7) | **33,5 %** |
| 15 % au plus, retranchés | 41,9 % | |
| rayon 3,2 / laisse 4,5 (2 gardes, 30 %) | 28,5 % | |
| rayon 2,2 / laisse 3,2 (2 gardes, 30 %) | 29,6 % | |

Ce qu'on en apprend :
- Un joueur qui ne secourt que ses camps et laisse les renforts automatiques s'occuper du reste fait **mieux** que le témoin qui court partout : 50 à 52 % en Normal, l'objectif « une partie sur deux » de la saison 1 est atteint sans toucher aux IA. Les outils des v5.5 à v5.8 font leur travail.
- Le second front ne change rien en moyenne (49,9 % contre 50,2 %) : il ne coûte rien non plus. Gardé dans le style humain, il rend les simulations plus proches d'un vrai joueur.
- Garder systématiquement toutes ses cases bonus coûte cher : chaque garde manque aux attaques. Le rayon et la laisse ne changent presque rien (dans le bruit) : ils restent à 2,6 et 3,8.
- D'où les **gardes retranchés** : dans leur cercle, ils encaissent un quart de coups en moins. Gain de 4 à 6 points pour une grosse garnison (28,0 → 33,5 %), sans effet mesurable pour une petite. La garnison reste un outil de confort pour tenir une case sans la surveiller, pas un raccourci vers la victoire. Les IA ne posent pas de garnison : leur équilibre entre elles est inchangé.

### Conquête (v5.11)

Point 1.5, première tranche. Les IA ne s'en servent pas en partie (leur équilibre entre elles est inchangé). `equilibre.ts` accepte `conquete=N` (le témoin garde une escouade de N élèves en consigne « Conquérir », reformée quand elle disparaît), `iaconquete=N` (même chose pour les IA adverses), `casesennemies=1` (les escouades visent aussi les cases tenues par un ennemi) et `pause=S` (pause après chaque prise). Témoin humain en Normal, 4 équipes, 800 parties par ligne (± 3,5 environ) :

| Témoin | Graine 1 | Graine 2 |
| --- | --- | --- |
| humain (rappel v5.10) | 49,9 % | 52,0 % |
| **escouade de 4 en conquête des cases libres** (sans second front) | **52,4 %** | **53,4 %** |
| idem, avec le second front | 52,6 % | |
| escouade de 4 qui vise aussi les cases ennemies | 68,9 % | 67,1 % |
| idem, escouade de 2 (400 parties) | 73,3 % | |
| idem, pause de 8 s après chaque prise | 57,6 % | |
| escouade de 6 qui vise aussi les cases ennemies | 59,0 % | |
| IA adverses avec une escouade de 3 (cases ennemies comprises), témoin sans | 44,0 % | |
| les deux (escouade de 4 au témoin, de 3 aux IA) | 65,5 % | |

Ce qu'on en apprend :
- Une petite escouade qui va cueillir les cases ennemies laissées sans garde rend Normal beaucoup trop facile (+17 à +23 points) : les IA, à attention limitée, ne reprennent pas assez vite leurs cases éloignées. Même en donnant le même outil aux IA, le témoin reste à 65 %.
- Limitée aux cases **libres**, la consigne vaut +1,5 à +2,5 points : un outil de confort pour le partage de la cour en début de partie, et pour ramasser les camps fantômes ou le trône, pas un raccourci. C'est la règle retenue : prendre le terrain de l'adversaire reste une décision du joueur (pilier 1).
- Ordres par minute du témoin inchangés (16,5 à 17,1) : la consigne ne coûte qu'un ordre.

`perf240` : partie 0,222 ms par pas (0,221 en v5.9), mêlée 0,093 (0,121) : pas de régression ; le multiplicateur des gardes est un test de distance par coup reçu.

### Normal un peu plus dur (v5.6)

Retour d'Aloys du 05/11 : « un peu trop simple ». Le témoin gagnait 54 % en Normal depuis l'attention limitée ; cible : 45 % environ. Essais à 800 parties (4 équipes, témoin contre 3 IA Normal) : dégâts ×0,95 → 50,4 % ; dégâts ×0,95 et réaction 1,7 s → 47,6 % ; groupes de 4 → 37,1 % (trop) ; dégâts ×0,95 et 40 % de défenseurs → 43,0 % ; budget de 20 ordres et dégâts ×0,95 → 48,6 %. Retenu : **dégâts ×0,95 et 42 % de défenseurs** (au lieu de ×0,9 et 45 %), soit **42,6 %** (± 2,4, 1 600 parties ; 41,9 % avec 40 % de défenseurs). Difficile et Expert frappent 5 % plus fort pour garder l'échelle :

| Adversaires (3 IA) | Témoin v5.5 | Témoin v5.6 |
| --- | --- | --- |
| Facile | 96,5 % | 96,1 % (800 parties) |
| **Normal** | 54,3 % | **42,6 %** (1 600 parties) |
| Difficile | 13,3 % | 9,8 % (800 parties) |
| Expert | 5,0 % | 2,4 % (800 parties) |

Couleurs, 4 IA Normal entre elles (800 parties) : de 20,5 % (Jaune) à 30,3 % (Rose), dans le bruit habituel à ce nombre de parties. `perf240` inchangé (partie 0,191 ms par pas).

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

### Défense (v5.12)

Point 1.5, deuxième tranche. Les IA ne s'en servent pas en partie. `equilibre.ts` accepte `defense=N` (le témoin garde une escouade de N élèves en consigne « Défendre », reformée quand elle disparaît, une fois qu'il a `defenseseuil` × N élèves libres, 3 par défaut), `defenseou=grappe|camp` (secteur autour de la grappe la plus riche de ses cases, ou de son premier camp) et `retranche=0|1`. Témoin humain en Normal, 4 équipes, 800 parties par ligne (± 3,5 environ) :

| Témoin | Graine 1 | Graine 2 |
| --- | --- | --- |
| humain (rappel) | 49,9 % | 52,0 % |
| escouade de 2 au premier camp, formée dès 4 élèves libres, non retranchée | | 34,9 % |
| escouade de 4 sur la grappe, non retranchée | | 44,1 % |
| escouade de 4 au premier camp, non retranchée | | 43,6 % |
| **escouade de 4 sur la grappe, retranchée** | **46,3 %** | **46,0 %** |
| escouade de 6 sur la grappe, non retranchée | | 51,0 % |
| **escouade de 6 sur la grappe, retranchée** | **49,1 %** | **51,1 %** |

Ce qu'on en apprend :
- Comme les garnisons (v5.10), immobiliser des élèves coûte des victoires au témoin, qui sait déjà secourir ses camps tout seul : la consigne n'est pas un raccourci. Elle est faite pour le joueur humain qui ne peut pas surveiller trois fronts.
- Une petite escouade (2 à 4) se fait déborder et coûte cher ; à 6, la défense ne coûte plus rien. D'où l'aide « À moins de 4, elle sera vite débordée » quand on la forme trop petite.
- Le retranchement (le même que celui des gardes) rapporte environ 2 points à une escouade de 4 : retenu, une garnison mobile est une garnison.
- Ordres par minute du témoin inchangés (16,3 à 16,9).

`perf240`, en alternance avec la v5.11 sur la même machine : partie 0,223 et 0,223 ms par pas contre 0,224 et 0,221 avant, mêlée 0,130 et 0,120 contre 0,119 et 0,127 : pas de régression.

### Escorte (v5.13)

Point 1.5, troisième tranche. Les IA ne s'en servent pas en partie. `equilibre.ts` accepte `suivre=N` : le témoin attache une escorte de N élèves à son escouade en conquête (avec `conquete=4`), reformée quand elle disparaît, une fois qu'il a 2 × N élèves libres. Témoin humain en Normal, 4 équipes, 800 parties par ligne (± 3,5 environ) :

| Témoin humain | graine 1 | graine 2 |
| --- | --- | --- |
| escouade de 4 en conquête (référence v5.11) | 52,6 % | 53,4 % |
| escouade de 4 en conquête, escortée par 4 | 47,4 % | 45,3 % |
| escouade de 4 en conquête, escortée par 2 | 45,1 % | |
| escouade de 8 en conquête (même effectif engagé) | 48,5 % | |

Ce qu'on en apprend :
- Escorter coûte au témoin 5 à 8 points, autant ou un peu plus que doubler l'escouade : comme les garnisons et la défense, la consigne immobilise des élèves loin du front principal. Pas de raccourci vers la victoire, Normal reste dans la cible (45 à 55 %). L'escorte sert au joueur humain : protéger un pion, accompagner une escouade sans la suivre du doigt, renforcer un groupe envoyé loin.
- Ordres par minute du témoin inchangés (16,4 à 17,0), IA 14,7 à 14,8.

`perf240`, en alternance avec la v5.12 sur la même machine : partie 0,198 et 0,208 ms par pas contre 0,232 et 0,214 avant : pas de régression (la logique ne tourne que s'il y a une escorte).

### Rythme réglable (v5.14)

Point 1.6. Les IA ne changent pas : elles jouent en temps de jeu. La vitesse lente donne au joueur plus de temps réel par seconde de jeu ; pour la mesurer, `equilibre.ts` accepte `vitesse=0.75` : le témoin garde ses ordres par minute *réelle*, donc 1/0,75 fois plus d'ordres par minute de jeu (`attentionAtSpeed` dans `src/core/tempo.ts`), et ses réactions raccourcissent d'autant (2,25 s au lieu de 3). Témoin humain en Normal, 4 équipes, 800 parties par ligne (± 3,5 environ) :

| Témoin humain | graine 1 | graine 2 |
| --- | --- | --- |
| vitesse normale | 49,9 % | 52,0 % |
| vitesse lente ×0,75 | 54,0 % | 56,3 % |

La vitesse lente vaut environ 4 points au témoin : une aide réelle mais mesurée, qui laisse Normal près de la cible. La pause tactique ne se simule pas (elle ne donne que du temps de réflexion) : c'est un outil de confort, réservé comme la vitesse lente à Facile et Normal. Ordres par minute : témoin 16,7 à 16,9 à vitesse normale, 22,1 à 22,2 en vitesse lente (par minute de jeu), IA 14,7 à 14,8.

`perf240` : la boucle de simulation ne change pas (le rythme n'agit que sur la boucle d'images de l'application) ; partie 0,111 à 0,194 ms par pas, dans le bruit des mesures précédentes.

## Contrôles tactiles

| Geste | Effet |
| --- | --- |
| Tap sur un élève | Sélectionne l'élève le plus proche du doigt (zone tactile généreuse) et ses voisins proches |
| Appui long puis glisser | Rectangle de sélection |
| Tap sur le sol | Rappel : déplacement sans combat (marqueur blanc), ou charge en mode Charger (marqueur orange). Près d'une case ou d'un camp, l'ordre est aimanté : la case visée s'entoure d'un liseré blanc et les élèves se répartissent à l'intérieur. Hors de la cour, l'ordre est ramené au bord ou au coin le plus proche (v5.6), comme la flèche d'ordre et le point de ralliement |
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
| Bouton « Garder » | La sélection garde la case où elle se tient ; ailleurs, le bouton s'allume et le prochain tap sur une case la lui confie (voir « Garnisons ») |
| Bouton « Conquérir » | La sélection prend seule, l'une après l'autre, les cases libres les plus proches ; retoucher le bouton lève la consigne (voir « Conquête ») |
| Bouton « Suivre » | Le bouton s'allume ; touche ensuite un de tes élèves (ou un bouton « 1 », « 2 », « 3 ») : la sélection escorte ce groupe partout et chasse ceux qui l'approchent ; retoucher le bouton annule, ou lève la consigne de l'escorte sélectionnée (voir « Escorte ») |
| Bouton « Défendre » | La sélection tient seule les cases à toi qui l'entourent (4 au plus) : elle court à celle qui est attaquée, la reprend si elle tombe, puis revient au poste ; retoucher le bouton lève la consigne (voir « Défense ») |
| Tap sur un de tes camps (sans sélection) ou sur la pastille « ★ » | Panneau d'amélioration du camp |
| Boutons ronds en bas (cloche, boule de neige, gâteau) | Appui long : aide ; glisser jusqu'à la carte : lancer ; tap : armer, puis viser et toucher la zone |
| Tap sur la puce d'une équipe (en haut) | Panneau « Diplomatie » : proposer ou rompre une alliance |
| Tap sur ta propre puce (en haut) | Détail « Effectifs » : élèves, cases et camps de chaque équipe |
| Sablier (en haut à droite, Facile et Normal) | Pause tactique : la cour se fige, les ordres restent possibles ; ▶ ou le bandeau « Reprendre » relance |
| Boutons | « Tout sélectionner », « Annuler », « Fuir / Charger », pause tactique, pause (avec la rubrique « Rythme » : vitesse, sablier affiché ou masqué), son |

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

Contrôles visuels automatisés (Playwright) : ajouter `?banc` à l'adresse expose la partie en cours dans `window.__partie()` (caméra, monde, sélection), pour cadrer et photographier une nouveauté sans dépendre du hasard de la carte.

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
| `v5.3` | escarmouche : 4 à 30 cases bonus, symboles personnalisables un par un, codes de carte longs |
| `avant-2026-11-04` | état avant la v5.4 (point de retour) |
| `v5.4` | IA à attention limitée : ordres par minute, cases secourues à la fois et délai de réaction selon la difficulté |
| `avant-2026-11-05` | état avant la v5.5 (point de retour) |
| `v5.5` | garnisons : bouton « Garder », cercle défendu, reprise automatique, écusson du nombre de gardes |
| `avant-2026-11-06` | état avant la v5.6 (point de retour) |
| `v5.6` | demandes d'Aloys : Normal un peu plus dur, « Abandonner » avec statistiques, tap hors de la cour ramené au bord, mode Équipes fixes, ruptures annoncées 30 s avec compte à rebours et trahisons de fin de partie plus rares |
| `v5.7` | alertes : case attaquée, case perdue, camp en danger, bandeau à toucher pour y aller, regroupement |
| `avant-2026-11-07` | état avant la v5.8 (point de retour) |
| `v5.8` | renforts automatiques : option « Auto » par camp (ou « Partout »), nouveaux élèves envoyés vers la case menacée, pointillé à chevrons |
| `avant-2026-11-08` | état avant la v5.9 (point de retour) |
| `v5.9` | retours d'Aloys : compteur d'élèves (« 18/30 », ennemis en vue sous le brouillard, détail « Effectifs »), tutoriel qui nomme le vrai adversaire, bulle du tutoriel qui ne cache plus la cible |
| `avant-2026-11-09` | état avant la v5.10 (point de retour) |
| `v5.10` | 1.1 bis : « joueur témoin » humain (ne secourt que ses camps, renforts automatiques, second front) ; gardes retranchés (un quart de coups en moins dans leur cercle, « Paré ! ») ; aide en bas de l'écran qui ne recouvre plus les boutons |
| `avant-2026-11-10` | état avant la v5.11 (point de retour) |
| `v5.11` | 1.5, première tranche : consigne « Conquérir » (escouade qui prend seule les cases libres, drapeau sur la case visée et sur le groupe) |
| `avant-2026-11-11` | état avant la v5.12 (point de retour) |
| `v5.12` | 1.5, deuxième tranche : consigne « Défendre » (garnison mobile d'un secteur de 4 cases au plus, retranchée, bouclier sur le poste, sur la case secourue et sur le groupe) ; rangée dédiée aux deux consignes d'escouade |
| `avant-2026-11-12` | état avant la v5.13 (point de retour) |
| `v5.13` | 1.5, troisième tranche : consigne « Suivre » (escorte d'un groupe désigné par un tap ou un bouton 1-2-3, chasse des ennemis qui l'approchent, écusson vert sur le protégé et sur le groupe) ; fin du point 1.5 Escouades |
| `avant-2026-11-13` | état avant la v5.14 (point de retour) |
| `v5.14` | 1.6 Rythme réglable : pause tactique (sablier, cour figée, ordres possibles) et vitesse lente ×0,75, en Facile et Normal, réglées dans la pause et mémorisées |

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
    ai.ts              IA d’équipe (évaluation des cases, regroupement, défense ; réglages du témoin humain : secours, second front)
    diplomacy.ts       alliances : propositions, ruptures annoncées, attitude des IA
    diplomacy-extras.ts  options cadeaux, appel à l’aide, tribut et trêve
    headcount.ts       compteur d'élèves : effectifs vus par le joueur (brouillard compris)
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
    garrison.ts        garnisons : ordre « Garder », cercle défendu, laisse, reprise de la case, gardes retranchés
    squads.ts          escouades à consigne : « Conquérir » (choix de la case, renoncement, enchaînement des prises), « Défendre » (secteur, poste, secours, laisse, retranchement) et « Suivre » (protégé, menaces, laisse, dispersion)
    tempo.ts           rythme réglable : vitesse lente, pause tactique, attention humaine en temps de jeu
    reinforce.ts       renforts automatiques : menace des cases, case secourue par chaque camp, envoi des nouveaux élèves
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
    defence.ts         escouades en défense : tirets du secteur, bouclier du poste, bouclier « ! » de la case secourue
    escort.ts          escortes : tirets vers le protégé, écusson vert au-dessus de lui
  input/touch.ts       gestes tactiles et souris
  audio/sfx.ts         sons synthétisés (Web Audio)
  ui/                  menu, HUD, fenêtres (pause, fin, installation, accueil, « Comment jouer »)
    camp-panel.ts      pastille des bons points et panneau d'amélioration d'un camp
    class-section.ts   rubrique « Ce camp produit » (classes d'élèves)
    pion-section.ts    rubrique « Pion » du panneau du camp
    powers-hud.ts      boutons des pouvoirs de récré
    tutorial-ui.ts     bulle, main animée et bouton « Passer » du tutoriel
    bubble-place.ts    placement de la bulle du tutoriel (ne cache ni la main ni la cible)
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
