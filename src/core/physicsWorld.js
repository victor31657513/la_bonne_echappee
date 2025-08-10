// Initialise le monde physique Rapier et gère le pas de simulation

import RAPIER from 'https://unpkg.com/@dimforge/rapier3d-compat@0.18.0/rapier.mjs?module';

// Rapier requiert désormais un objet (même vide) pour l'initialisation
await RAPIER.init({});

const world = new RAPIER.World({ gravity: { x: 0, y: 0, z: 0 } });
// Augmente le nombre d'itérations du solveur pour mieux gérer les collisions dans un peloton dense
world.integrationParameters.numSolverIterations = 40;
world.integrationParameters.numAdditionalFrictionIterations = 40;

let physicsAccumulator = 0;
const fixedTimeStep = 1 / 60;
world.integrationParameters.dt = fixedTimeStep;
/**
 * Avance la simulation physique par pas fixes.
 *
 * @param {number} dt Temps écoulé depuis le dernier appel en secondes.
 * @returns {void}
 */
function stepPhysics(dt) {
  physicsAccumulator += dt;
  while (physicsAccumulator >= fixedTimeStep) {
    world.step();
    physicsAccumulator -= fixedTimeStep;
  }
}

export { RAPIER, world, stepPhysics };
