import { RIDER_WIDTH, MIN_LATERAL_GAP } from '../entities/riderConstants.js';
import { devLog } from '../utils/devLog.js';

// Rapier utilise des unités m/s. Un réglage trop élevé expulse
// violemment les coureurs ; 5 offre une séparation visible sans
// créer d'instabilités.
const OVERLAP_FORCE = 5;

/**
 * Pass 1: calcule les nouvelles vitesses pour corriger les overlaps
 * sans modifier immédiatement les corps Rapier.
 *
 * @param {Array} riders Array of rider objects with body.
 * @returns {Array} commandes à appliquer lors de la phase WRITE.
 */
function computeOverlapCommands(riders) {
  const minDist = RIDER_WIDTH + MIN_LATERAL_GAP;
  // snapshot des vitesses courantes
  const vel = riders.map(r => {
    const v = r.body.linvel();
    return { x: v.x, y: v.y, z: v.z };
  });

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
          devLog('Overlap detected', { a: i, b: j, overlap: overlap.toFixed(3) });
          const nx = dx / dist;
          const nz = dz / dist;
          const adjust = (overlap / 2) * OVERLAP_FORCE;
          const adjX = nx * adjust;
          const adjZ = nz * adjust;
          const av = vel[i];
          const bv = vel[j];
          av.x += adjX;
          av.z += adjZ;
          bv.x -= adjX;
          bv.z -= adjZ;
          moved = true;

          const relVX = av.x - bv.x;
          const relVZ = av.z - bv.z;
          const relVN = relVX * nx + relVZ * nz;
          if (relVN < 0) {
            const impulse = Math.max(relVN / 2, -overlap * OVERLAP_FORCE);
            av.x -= impulse * nx;
            av.z -= impulse * nz;
            bv.x += impulse * nx;
            bv.z += impulse * nz;
          }
        }
      }
    }
    if (!moved) break;
  }

  return riders.map((r, idx) => ({ body: r.body, vel: vel[idx] }));
}

/**
 * Pass 2: applique les vitesses calculées sur les corps Rapier.
 *
 * @param {Array} commands résultats de computeOverlapCommands.
 * @returns {void}
 */
function applyOverlapCommands(commands) {
  commands.forEach(cmd => {
    cmd.body.setLinvel(
      { x: cmd.vel.x, y: cmd.vel.y, z: cmd.vel.z },
      true
    );
  });
}

export { computeOverlapCommands, applyOverlapCommands };

