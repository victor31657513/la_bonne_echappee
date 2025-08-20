// Initialise le monde physique Rapier et gère le pas de simulation

let RAPIER;
try {
  ({ default: RAPIER } = await import('https://cdn.skypack.dev/@dimforge/rapier3d-compat'));
  await RAPIER.init();
} catch (e) {
  console.warn('Échec du chargement de Rapier depuis le CDN, tentative locale…', e);
  try {
    ({ default: RAPIER } = await import('../../node_modules/@dimforge/rapier3d-compat/rapier.mjs'));
    await RAPIER.init();
  } catch (e2) {
    console.error('Impossible d\'initialiser Rapier', e2);
    alert('La physique n\'a pas pu être initialisée.');
  }
}

const world = RAPIER ? new RAPIER.World({ gravity: { x: 0, y: 0, z: 0 } }) : null;
// Augmente le nombre d'itérations du solveur pour mieux gérer les collisions dans un peloton dense
if (world) {
  world.integrationParameters.numSolverIterations = 40;
  world.integrationParameters.numAdditionalFrictionIterations = 40;
}

let physicsAccumulator = 0;
const fixedTimeStep = 1 / 60;
if (world) world.integrationParameters.dt = fixedTimeStep;
/**
 * Avance la simulation physique par pas fixes.
 *
 * @param {number} dt Temps écoulé depuis le dernier appel en secondes.
 * @returns {void}
 */
function stepPhysics(dt) {
  if (!world) return;
  physicsAccumulator += dt;
  while (physicsAccumulator >= fixedTimeStep) {
    world.step();
    physicsAccumulator -= fixedTimeStep;
  }
}

export { RAPIER, world, stepPhysics };
