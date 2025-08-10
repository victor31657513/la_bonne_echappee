# Test rapide anti-ré-entrance

## Objectif
Vérifier qu'un seul cycle `requestAnimationFrame` tourne après plusieurs clics rapides et que les actions déclenchées dans les callbacks utilisent uniquement des commandes en `WRITE`.

## Étapes
1. Ouvrir `index.html` dans un navigateur.
2. Ouvrir la console de développement.
3. Cliquer trois fois rapidement sur le bouton **Start**.
4. Contrôler que :
   - Un seul `requestAnimationFrame` est actif (vérifier les logs ou un compteur exposé par l'application).
   - Aucune erreur « recursive use of an object detected » ni « RuntimeError: unreachable » n'apparaît dans la console.
5. Pendant que la simulation tourne, déclencher des actions qui auparavant effectuaient des `set*` dans les itérateurs ou callbacks (sélection d'un coureur, déclenchement d'une attaque, relai, etc.).
6. Vérifier que ces actions génèrent uniquement des commandes appliquées en `WRITE`.
7. Le test est réussi si aucune des erreurs mentionnées n'apparaît durant tout le processus.
