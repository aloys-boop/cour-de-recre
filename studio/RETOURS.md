# Retours d'Aloys

Le plus récent en haut. Chaque session lit ce fichier, recopie ici les nouveaux retours reçus par e-mail (réponses au « journal du jour »), et indique en dessous de chaque retour ce qui en a été fait.

## 03/11/2026

> « Une des grosses difficultés du jeu actuellement c'est la micro et le contrôle des cases. Pour une IA, facile d'être partout à la fois. Pour un humain c'est plus compliqué… »

- Constat dans le code : `src/core/ai.ts`, `think()` défend toutes les cases menacées à chaque réflexion, sans limite d'attention.
- Suite : devient la saison 1 de la feuille de route (« Moins de micro, plus de stratégie »), en priorité absolue.

## 27/10/2026

> L'IA est assez forte : en Normal, une victoire sur 5 environ (joue souvent les Noirs). Inégalités entre équipes, les 4 dernières couleurs assez faibles.

- Traité en v5.1 (budget de 12 points) et v5.2 (nouveau Normal plus doux). À revérifier en jeu réel avec Aloys.
