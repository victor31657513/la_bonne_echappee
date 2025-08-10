# La Bonne Échappée

Cette simulation affiche un peloton de cyclistes en 3D dans votre navigateur. Les sources sont séparées en modules JavaScript situés dans `src/`.

## Utilisation
Ouvrez `index.html` dans un navigateur moderne. Le fichier charge automatiquement les modules nécessaires via des imports ES modules et utilise des bibliothèques depuis un CDN. Le moteur physique [Rapier](https://rapier.rs/) est désormais requis et doit être chargé en tant que module externe.
Les versions du projet sont désormais créées automatiquement lors d'un merge dans `main` grâce au workflow `release-please`. Consultez les releases GitHub pour connaître la dernière version disponible.

Chaque coureur dispose maintenant d'un bouton **Attack** qui le pousse à 120 % d'intensité tant que sa jauge d'attaque n'est pas vide. Celle-ci se vide rapidement lors d'une attaque et se recharge lentement ensuite.
Les anciens boutons *Early Atk* et *Chase Breakaway* ont été retirés afin de simplifier l'interface.
Le système de boids, pensé pour gérer la cohésion du peloton, a été retiré car il n'était pas connecté à la physique.

## Modes des coureurs

Trois modes déterminent désormais le comportement d'intensité :

- **Follower** (par défaut) : l'intensité s'adapte automatiquement au peloton ou au coureur qui précède.
- **Solo** : le coureur applique en continu l'intensité choisie, sans ajustement automatique.
- **Relay** : le coureur rejoint la file à 100 % puis mène selon l'intensité de relais sélectionnée lorsqu'il arrive en tête. Hors phase de *pull*, son intensité redevient gérée comme en mode *follower*.

## Gestion des relais

Les coureurs d'une même équipe peuvent activer le mode *relay*. Ils se placent
alors en file indienne derrière le relayeur de tête. La durée d'un relais varie
automatiquement selon le nombre de coureurs présents dans cette file : plus la
file est longue, plus chaque relais est court. Lorsqu'un relayeur termine son
effort, il laisse les autres le dépasser et se replace derrière le dernier tout
en accélérant pour recoller si besoin. La glissière d'intensité de l'équipe se
synchronise automatiquement avec les coureurs lorsque ceux‑ci sont en mode
*relay*.
En mode *relay*, les coureurs passent désormais à 100 % d'intensité pour
rejoindre et mener la file.

## Développement
Les dépendances de développement (ESLint) sont gérées via `npm`. Pour vérifier le linting et exécuter le jeu de tests factice :

```bash
npm run lint
npm test
```

Dans le navigateur, Rapier peut être chargé depuis un CDN. La fonction `RAPIER.init` requiert désormais un objet de configuration, même vide :

```html
<script type="module">
  import RAPIER from 'https://unpkg.com/@dimforge/rapier3d-compat@0.18.0/rapier.mjs?module';
  await RAPIER.init({});
</script>
```

## Constantes supplémentaires

Deux nouvelles constantes sont définies dans `src/utils/constants.js` :

- `BASE_LINEAR_DAMPING` : amortissement de base appliqué aux coureurs avant la traînée.
- `DRAFT_FACTOR_SCALE` : intensité du bonus de vitesse lié à l'aspiration.

## Conventions de nommage

- Les modules JavaScript (`.js`) utilisent le lower camelCase (`monModule.js`).
- Les répertoires et fichiers d’assets sont nommés en minuscules.
- Les fichiers de test se terminent par `.test.js` et se trouvent dans `test/`.

## Effets sonores

Un dossier `sounds/` est présent à la racine du projet pour accueillir vos effets sonores au format `.wav`.
