# La bonne échappée

Simulation de peloton de cyclisme en 3D utilisant **three.js** pour le rendu, **cannon-es** pour la physique et **YUKA** pour l'intelligence artificielle.

## Fonctionnement

Le fichier `index.html` charge `src/main.js` qui instancie une scène Three.js et crée une route circulaire plate. Une trentaine d'agents sont générés et suivent cette trajectoire grâce aux comportements YUKA (suivi de chemin, séparation et cohésion). Les mouvements sont synchronisés avec un moteur physique Cannon pour gérer les collisions et les contraintes.

Les dépendances (Three.js, YUKA, cannon-es) sont résolues par **Vite**. Lancez donc l'application avec `npm run dev` pour servir correctement les modules. Un simple serveur statique renverrait des erreurs 404 car le dossier `node_modules` n'est pas exposé.

Une interface minimale affiche la vitesse du leader pendant la simulation.

## Utilisation

- Installation des dépendances :

```bash
npm install
```

- Démarrage en mode développement :

```bash
npm run dev
```

- Lancement des tests :

```bash
npm test
```

- Construction pour la production :

```bash
npm run build
```

