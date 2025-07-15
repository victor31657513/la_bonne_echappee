# La bonne échappée

Simulation de peloton de cyclisme en 3D utilisant **three.js** pour le rendu, **cannon-es** pour la physique et **YUKA** pour l'intelligence artificielle.

## Fonctionnement

Le fichier `index.html` charge `src/main.js` qui instancie une scène Three.js et crée une route circulaire plate. Une trentaine d'agents sont générés et suivent cette trajectoire grâce aux comportements YUKA (suivi de chemin, séparation et cohésion). Les mouvements sont synchronisés avec un moteur physique Cannon pour gérer les collisions et les contraintes.

Les dépendances (Three.js, YUKA, cannon-es) sont désormais chargées directement depuis des CDN. Il suffit donc d'ouvrir `index.html` dans un navigateur, sans passer par Vite ni installer les modules Node.

Une interface minimale affiche la vitesse du leader pendant la simulation.
Un effet d'aspiration simplifié accélère les coureurs placés juste derrière un autre.

## Utilisation

Ouvrez simplement `index.html` dans votre navigateur pour lancer la simulation.
Les scripts npm restent disponibles pour les tests et la construction si
besoin :

- Lancement des tests :

```bash
npm test
```

- Construction pour la production :

```bash
npm run build
```

