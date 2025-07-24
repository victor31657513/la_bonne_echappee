// Constantes partagées entre plusieurs modules
const BASE_SPEED = 8;
// Distances minimales et maximales entre deux coéquipiers lors d'un relais
const RELAY_MIN_DIST = 1.0;
const RELAY_MAX_DIST = 3.0;

// Gestion de la fatigue et de la récupération d'énergie
const FATIGUE_RATE = 5; // unités par seconde
const RECOVERY_RATE = 3; // unités par seconde
const ENERGY_THRESHOLD = 20;

export {
  BASE_SPEED,
  RELAY_MIN_DIST,
  RELAY_MAX_DIST,
  FATIGUE_RATE,
  RECOVERY_RATE,
  ENERGY_THRESHOLD
};
