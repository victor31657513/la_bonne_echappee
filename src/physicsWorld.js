// Initialise le monde physique Cannon.js et gère le pas de simulation

import * as CANNON from 'https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js?module';

const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
// Augmente le nombre d'itérations du solveur pour mieux gérer les collisions dans un peloton dense
world.solver.iterations = 40;

const defaultMaterial = new CANNON.Material('defaultMaterial');
const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, { friction: 0.3, restitution: 0.1 });
world.addContactMaterial(contactMaterial);
world.defaultContactMaterial = contactMaterial;

let physicsAccumulator = 0;
const fixedTimeStep = 1 / 60;
/**
 * Avance la simulation physique par pas fixes.
 *
 * @param {number} dt Temps écoulé depuis le dernier appel en secondes.
 * @returns {void}
 */
function stepPhysics(dt) {
  physicsAccumulator += dt;
  while (physicsAccumulator >= fixedTimeStep) {
    world.step(fixedTimeStep);
    physicsAccumulator -= fixedTimeStep;
  }
}

export { CANNON, world, stepPhysics };
