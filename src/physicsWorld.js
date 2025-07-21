// Initialise le monde physique Cannon.js et gère le pas de simulation

import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
// Increase solver iterations to better handle dense rider collisions
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
