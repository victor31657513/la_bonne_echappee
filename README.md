# La Bonne Échappée

Cette simulation affiche un peloton de cyclistes en 3D dans votre navigateur. Les sources sont séparées en modules JavaScript situés dans `src/`.

## Utilisation
Ouvrez `index.html` dans un navigateur moderne. Le fichier charge automatiquement les modules nécessaires via des imports ES modules et utilise des bibliothèques depuis un CDN.
Pour que l'affichage de la version fonctionne, servez ce dossier via un serveur HTTP local (par ex. `npx http-server` ou `python -m http.server`) puis ouvrez la page depuis `http://localhost:8080`. L'ouverture directe du fichier risque d'empêcher la lecture de `version.json`.
Le numéro de version courant est stocké dans le fichier `version.json` à la racine du projet.

## Développement
Les dépendances de développement (ESLint) sont gérées via `npm`. Pour vérifier le linting et exécuter le jeu de tests factice :

```bash
npm run lint
npm test
```
