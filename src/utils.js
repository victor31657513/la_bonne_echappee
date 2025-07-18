// Fonctions utilitaires pour calculer les distances sur la piste

import { TRACK_WRAP } from './track.js';

// Convertit des coordonnées polaires en distance le long de la piste
function polarToDist(x, z) {
  const a = Math.atan2(z, x);
  return ((a < 0 ? a + 2 * Math.PI : a) / (2 * Math.PI)) * TRACK_WRAP;
}

// Distance en tenant compte du tour de piste
function aheadDistance(from, to) {
  let diff = (to - from) % TRACK_WRAP;
  if (diff < 0) diff += TRACK_WRAP;
  return diff;
}

// Calcule la distance la plus courte sur le circuit
function wrapDistance(a, b) {
  let diff = Math.abs(b - a) % TRACK_WRAP;
  if (diff > TRACK_WRAP / 2) diff = TRACK_WRAP - diff;
  return diff;
}

export { polarToDist, aheadDistance, wrapDistance };
