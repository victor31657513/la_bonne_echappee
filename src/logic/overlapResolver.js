import { RIDER_WIDTH, MIN_LATERAL_GAP } from '../entities/riderConstants.js';

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
        const ap = a.body.translation();
        const bp = b.body.translation();
        const dx = ap.x - bp.x;
        const dz = ap.z - bp.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          const adjust = (overlap / 2) * OVERLAP_FORCE;
          const adjX = nx * adjust;
          const adjZ = nz * adjust;
          const av = a.body.linvel();
          const bv = b.body.linvel();
          a.body.setLinvel({ x: av.x + adjX, y: av.y, z: av.z + adjZ }, true);
          b.body.setLinvel({ x: bv.x - adjX, y: bv.y, z: bv.z - adjZ }, true);
          moved = true;

          const av2 = a.body.linvel();
          const bv2 = b.body.linvel();
          const relVX = av2.x - bv2.x;
          const relVZ = av2.z - bv2.z;
          const relVN = relVX * nx + relVZ * nz;
          if (relVN < 0) {
            const impulse = relVN / 2;
            a.body.setLinvel(
              { x: av2.x - impulse * nx, y: av2.y, z: av2.z - impulse * nz },
              true
            );
            b.body.setLinvel(
              { x: bv2.x + impulse * nx, y: bv2.y, z: bv2.z + impulse * nz },
              true
            );
          }
        }
      }
    }
    if (!moved) break;
  }
}

export { resolveOverlaps };
