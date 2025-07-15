# La bonne échappée

Simulation de peloton de cyclisme en 3D utilisant **three.js** pour le rendu, **cannon-es** pour la physique et **YUKA** pour l'intelligence artificielle.

## Fonctionnement

Le fichier `index.html` charge `src/main.js` qui instancie une scène Three.js et crée une route circulaire plate. Une trentaine d'agents sont générés et suivent cette trajectoire grâce aux comportements YUKA (suivi de chemin, séparation et cohésion). Les mouvements sont synchronisés avec un moteur physique Cannon pour gérer les collisions et les contraintes.

Toutes les dépendances (Three.js, YUKA, cannon-es) sont fournies dans le dossier `libs/`. Le projet ne se lance donc pas avec Node mais directement dans un navigateur web. Ouvrez `index.html` depuis un petit serveur local (`npx http-server` ou `python -m http.server`).

Une interface minimale affiche la vitesse du leader pendant la simulation.
Un effet d'aspiration simplifié accélère les coureurs placés juste derrière un autre.

## Utilisation

Lancez un petit serveur local puis ouvrez `index.html` dans votre navigateur pour démarrer la simulation. Par exemple :
```bash
npx http-server
```
ou
```bash
python -m http.server
```
Ne lancez pas `src/main.js` directement avec Node.

