# La Bonne Échappée

Cette simulation affiche un peloton de cyclistes en 3D dans votre navigateur. Les sources sont séparées en modules JavaScript situés dans `src/`.

## Utilisation
Ouvrez `index.html` dans un navigateur moderne. Le fichier charge automatiquement les modules nécessaires via des imports ES modules et utilise des bibliothèques depuis un CDN.
Les versions du projet sont désormais créées automatiquement lors d'un merge dans `main` grâce au workflow `release-please`. Consultez les releases GitHub pour connaître la dernière version disponible.

Chaque coureur dispose maintenant d'un bouton **Attack** qui le pousse à 120 % d'intensité tant que sa jauge d'attaque n'est pas vide. Celle-ci se vide rapidement lors d'une attaque et se recharge lentement ensuite.

## Gestion des relais

Les coureurs d'une même équipe peuvent activer le mode *relay*. Ils se placent
alors en file indienne derrière le relayeur de tête. La durée d'un relais varie
automatiquement selon le nombre de coureurs présents dans cette file : plus la
file est longue, plus chaque relais est court. Lorsqu'un relayeur termine son
effort, il laisse les autres le dépasser et se replace derrière le dernier tout
en accélérant pour recoller si besoin.

## Développement
Les dépendances de développement (ESLint) sont gérées via `npm`. Pour vérifier le linting et exécuter le jeu de tests factice :

```bash
npm run lint
npm test
```
