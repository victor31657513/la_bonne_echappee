// Fonctions utilitaires pour calculer les distances sur la piste

import { TRACK_WRAP } from '../entities/track.js';

/**
 * Convertit des coordonnées polaires en distance le long de la piste.
 *
 * @param {number} x Coordonnée X dans le plan.
 * @param {number} z Coordonnée Z dans le plan.
 * @returns {number} Distance correspondante sur le tour de piste.
 */
function polarToDist(x, z) {
  const a = Math.atan2(z, x);
  return ((a < 0 ? a + 2 * Math.PI : a) / (2 * Math.PI)) * TRACK_WRAP;
}

/**
 * Calcule la distance entre deux points en tenant compte du tour de piste.
 *
 * @param {number} from Point de référence.
 * @param {number} to Point situé en aval.
 * @returns {number} Distance positive sur la piste.
 */
function aheadDistance(from, to) {
  let diff = (to - from) % TRACK_WRAP;
  if (diff < 0) diff += TRACK_WRAP;
  return diff;
}

/**
 * Calcule la distance la plus courte entre deux positions sur le circuit.
 *
 * @param {number} a Première position.
 * @param {number} b Seconde position.
 * @returns {number} Distance minimale le long du tour.
 */
function wrapDistance(a, b) {
  let diff = Math.abs(b - a) % TRACK_WRAP;
  if (diff > TRACK_WRAP / 2) diff = TRACK_WRAP - diff;
  return diff;
}

export { polarToDist, aheadDistance, wrapDistance };
