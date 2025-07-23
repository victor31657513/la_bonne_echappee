import { RIDER_WIDTH, MIN_LATERAL_GAP } from './riderConstants.js';

const OVERLAP_FORCE = 10;

/**
 * Resolve rider overlaps gradually by applying velocity adjustments.
 * Keeps the multi-pass approach to handle chains of collisions.
 *
 * @param {Array} riders Array of rider objects with body, position and velocity.
 * @returns {void}
 */
function resolveOverlaps(riders) {
  const minDist = RIDER_WIDTH + MIN_LATERAL_GAP;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < riders.length; i++) {
      const a = riders[i];
      for (let j = i + 1; j < riders.length; j++) {
        const b = riders[j];
        const dx = a.body.position.x - b.body.position.x;
        const dz = a.body.position.z - b.body.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          const adjust = (overlap / 2) * OVERLAP_FORCE;
          const adjX = nx * adjust;
          const adjZ = nz * adjust;
          a.body.velocity.x += adjX;
          a.body.velocity.z += adjZ;
          b.body.velocity.x -= adjX;
          b.body.velocity.z -= adjZ;
          moved = true;

          const relVX = a.body.velocity.x - b.body.velocity.x;
          const relVZ = a.body.velocity.z - b.body.velocity.z;
          const relVN = relVX * nx + relVZ * nz;
          if (relVN < 0) {
            const impulse = relVN / 2;
            a.body.velocity.x -= impulse * nx;
            a.body.velocity.z -= impulse * nz;
            b.body.velocity.x += impulse * nx;
            b.body.velocity.z += impulse * nz;
          }
        }
      }
    }
    if (!moved) break;
  }
}

export { resolveOverlaps };
