// Animation du peloton et logique de comportement des coureurs

import { THREE, scene, camera, renderer } from './setupScene.js';
import { CANNON } from './physicsWorld.js';
import {
  riders,
  boidSystem,
  teamRelayState,
  RIDER_WIDTH,
  MIN_LATERAL_GAP
} from './riders.js';
import {
  outerSpline,
  innerSpline,
  centerSpline,
  INNER_R,
  OUTER_R,
  TRACK_WRAP,
  BASE_RADIUS,
  ROAD_WIDTH
} from './track.js';
import { stepPhysics } from './physicsWorld.js';
import { updateSelectionHelper, selectedIndex } from './ui.js';
import { started } from './startButton.js';
import { aheadDistance, wrapDistance } from './utils.js';

const BASE_SPEED = 8;
const SPEED_GAIN = 0.3;
const IDEAL_MIX = 0.8;
const RELAY_SPEED_BOOST = 0.5;
const LATERAL_FORCE = 5;
const MAX_SPEED = BASE_SPEED * 2;
// Limit side movement so riders don't slide across the road too quickly
const MAX_LATERAL_SPEED = 4;
const MAX_LANE_OFFSET = ROAD_WIDTH / 2 - 0.85;
const LANE_CHANGE_SPEED = 2;
const RELAY_INTERVAL = 5;
const PULL_OFF_TIME = 2;
const PULL_OFFSET = 1.5;

const forwardVec = new THREE.Vector3();
const lookAtPt = new THREE.Vector3();
let lastTime = performance.now();

/**
 * Limite la vitesse maximale des coureurs pour éviter des accélérations
 * trop fortes qui déstabiliseraient la simulation.
 *
 * @returns {void}
 */
function limitRiderSpeed() {
  riders.forEach(r => {
    const v = r.body.velocity;
    const speed = v.length();
    if (speed > MAX_SPEED) {
      v.scale(MAX_SPEED / speed, v);
    }
  });
}

/**
 * Réduit la vitesse latérale afin de faciliter la gestion des collisions.
 *
 * @returns {void}
 */
function limitLateralSpeed() {
  riders.forEach(r => {
    const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
    const right = new CANNON.Vec3(Math.cos(theta), 0, Math.sin(theta));
    const latSpeed = r.body.velocity.dot(right);
    if (Math.abs(latSpeed) > MAX_LATERAL_SPEED) {
      const excess = latSpeed - Math.sign(latSpeed) * MAX_LATERAL_SPEED;
      r.body.velocity.x -= excess * right.x;
      r.body.velocity.z -= excess * right.z;
    }
  });
}

/**
 * Redirige les coureurs et recadre leur position pour rester sur la piste.
 *
 * @returns {void}
 */
function clampAndRedirect() {
  const minR = INNER_R + 0.1;
  const maxR = OUTER_R - 0.1;
  riders.forEach(r => {
    const p = r.body.position;
    const v = r.body.velocity;
    p.y = 0;
    v.y = 0;
    const radial = Math.hypot(p.x, p.z);
    if (radial < minR || radial > maxR) {
      const nx = p.x / radial,
        nz = p.z / radial;
      const clamped = THREE.MathUtils.clamp(radial, minR, maxR);
      p.x = nx * clamped;
      p.z = nz * clamped;
      const tangent = new CANNON.Vec3(-nz, 0, nx);
      const speed = v.dot(tangent);
      v.x = tangent.x * speed;
      v.z = tangent.z * speed;
    }
  });
}

/**
 * Calcule l'étirement du peloton en fonction de la vitesse du leader.
 *
 * @returns {number} Facteur d'étirement compris entre 0 et 1.
 */
function computeStretch() {
  if (!started || riders.length === 0) return 0;
  let minDist = riders[0].trackDist;
  riders.forEach(r => {
    if (r.trackDist < minDist) minDist = r.trackDist;
  });
  let leader = riders[0];
  let maxOffset = 0;
  riders.forEach(r => {
    const offset = aheadDistance(minDist, r.trackDist);
    if (offset > maxOffset) {
      maxOffset = offset;
      leader = r;
    }
  });

  // Stretch the peloton according to the speed of the leading rider.
  // A faster leader narrows the width of the group.
  const leaderSpeed = leader.body.velocity.length();
  const speedFactor = leaderSpeed / BASE_SPEED;

  // At or below base speed allow riders to occupy the full width
  if (speedFactor <= 1) return 0;

  const stretch = Math.min(1, 0.1 + 0.5 * (speedFactor - 1));
  return stretch;
}

/**
 * Met à jour la position latérale de chaque coureur pour éviter les
 * collisions et optimiser l'espace sur la route.
 *
 * @param {number} dt Durée écoulée depuis la dernière mise à jour en secondes.
 * @returns {void}
 */
function updateLaneOffsets(dt) {
  riders.forEach((r, idx) => {
    let bestDelta = TRACK_WRAP;
    let ahead = null;
    riders.forEach((o, j) => {
      if (j === idx) return;
      const delta = aheadDistance(r.trackDist, o.trackDist);
      if (delta < bestDelta) {
        bestDelta = delta;
        ahead = o;
      }
    });
    if (ahead && bestDelta < 5) {
      const dir = r.laneOffset <= ahead.laneOffset ? -1 : 1;

      const sideBlocked = riders.some((o, j) => {
        if (j === idx) return false;
        const dist = Math.abs(wrapDistance(r.trackDist, o.trackDist));
        if (dist > 2) return false;
        const gap = o.laneOffset - (r.laneOffset + dir * (RIDER_WIDTH + MIN_LATERAL_GAP));
        return Math.abs(gap) < RIDER_WIDTH;
      });

      if (!sideBlocked) {
        r.laneOffset = THREE.MathUtils.clamp(
          r.laneOffset + dir * LANE_CHANGE_SPEED * dt,
          -MAX_LANE_OFFSET,
          MAX_LANE_OFFSET
        );
      }
    } else {
      r.laneOffset = THREE.MathUtils.lerp(r.laneOffset, 0, dt);
    }
  });
}

/**
 * Gère la logique de relais pour chaque équipe.
 *
 * @param {number} dt Durée écoulée depuis la dernière mise à jour en secondes.
 * @returns {void}
 */
function updateRelays(dt) {
  for (let t = 0; t < teamRelayState.length; t++) {
    const state = teamRelayState[t];
    const teamRiders = riders.filter(r => r.team === t && r.relaySetting > 0);
    if (teamRiders.length === 0) continue;

    teamRiders.sort((a, b) => b.trackDist - a.trackDist);
    const leader = teamRiders[state.index % teamRiders.length];
    teamRiders.forEach(r => {
      r.relayIntensity = 0;
    });
    leader.relayIntensity = leader.relaySetting;

    state.timer += dt;
    if (state.timer >= RELAY_INTERVAL) {
      state.timer = 0;
      leader.pullingOff = true;
      leader.pullTimer = 0;
      leader.laneTarget = state.side * PULL_OFFSET;
      state.index = (state.index + 1) % teamRiders.length;
      state.side *= -1;
    }
  }

  riders.forEach(r => {
    if (r.pullingOff) {
      r.pullTimer += dt;
      if (r.pullTimer >= PULL_OFF_TIME) {
        r.pullingOff = false;
        r.laneTarget = 0;
      }
    }
  });
}

/**
 * Applique les différentes forces physiques sur les coureurs.
 *
 * @param {number} dt Durée écoulée depuis la dernière mise à jour en secondes.
 * @returns {void}
 */
function applyForces(dt) {
  const stretch = computeStretch();
  riders.forEach(r => {
    r.currentBoost =
      r.currentBoost !== undefined
        ? THREE.MathUtils.lerp(r.currentBoost, r.relayIntensity * RELAY_SPEED_BOOST, dt * 2)
        : r.relayIntensity * RELAY_SPEED_BOOST;

    // Determine if this rider is blocked by another rider directly ahead
    if (r.relayIntensity > 0 && !r.pullingOff) {
      const SAFE_DIST = 4;
      const LANE_GAP = 1.2;
      let blocked = false;
      for (const other of riders) {
        if (other === r) continue;
        const dist = aheadDistance(r.trackDist, other.trackDist);
        if (dist > 0 && dist < SAFE_DIST) {
          if (Math.abs(other.laneOffset - r.laneOffset) < LANE_GAP) {
            blocked = true;
            break;
          }
        }
      }

      if (blocked) {
        const SHIFT = 1.5;
        const maxOffset = ROAD_WIDTH / 2 - 1;
        let chosen = r.laneOffset;
        for (const dir of [-1, 1]) {
          const cand = THREE.MathUtils.clamp(r.laneOffset + dir * SHIFT, -maxOffset, maxOffset);
          let collide = false;
          for (const other of riders) {
            if (other === r) continue;
            const d = wrapDistance(other.trackDist, r.trackDist);
            if (d < SAFE_DIST && Math.abs(other.laneOffset - cand) < LANE_GAP) {
              collide = true;
              break;
            }
          }
          if (!collide) {
            chosen = cand;
            break;
          }
        }
        r.laneTarget = chosen;
      } else {
        r.laneTarget = 0;
      }
    } else if (!r.pullingOff) {
      r.laneTarget = 0;
    }

    // Smoothly steer towards the desired lateral position
    r.laneOffset = THREE.MathUtils.lerp(r.laneOffset, r.laneTarget, dt * 2);

    const bodyPos = r.body.position;
    const angle = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
    const targetRadius = BASE_RADIUS + r.laneOffset * (1 - stretch);
    const targetX = targetRadius * Math.cos(angle);
    const targetZ = targetRadius * Math.sin(angle);
    const lateralVec = new CANNON.Vec3(targetX - bodyPos.x, 0, targetZ - bodyPos.z);
    const lateralForce = lateralVec.scale(LATERAL_FORCE);

    const theta = angle;
    const fwd = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
    const fwdForce = fwd.scale(r.currentBoost);

    const totalForce = new CANNON.Vec3(lateralForce.x + fwdForce.x, 0, lateralForce.z + fwdForce.z);
    r.body.applyForce(totalForce, bodyPos);
  });
}

/**
 * Évite que les coureurs se superposent en appliquant une résolution
 * d'interpénétration simple.
 *
 * @returns {void}
 */
function resolveOverlaps() {
  const minDist = RIDER_WIDTH + MIN_LATERAL_GAP;
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
        const pushX = nx * (overlap / 2);
        const pushZ = nz * (overlap / 2);
        a.body.position.x += pushX;
        a.body.position.z += pushZ;
        b.body.position.x -= pushX;
        b.body.position.z -= pushZ;

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
}

/**
 * Ajuste la caméra en fonction du coureur sélectionné ou de la moyenne du peloton.
 *
 * @returns {void}
 */
function updateCamera() {
  let tx, tz, ang;
  if (selectedIndex !== null) {
    const r = riders[selectedIndex];
    tx = r.mesh.position.x;
    tz = r.mesh.position.z;
    ang = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
  } else {
    tx = 0;
    tz = 0;
    riders.forEach(r => {
      tx += r.mesh.position.x;
      tz += r.mesh.position.z;
    });
    tx /= riders.length;
    tz /= riders.length;
    const avg = riders.reduce((s, r) => s + r.trackDist, 0) / riders.length;
    ang = ((avg % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
  }
  forwardVec.set(-Math.sin(ang), 0, Math.cos(ang));
  const BACK = 10,
    H = 5;
  camera.position.set(tx - forwardVec.x * BACK, H, tz - forwardVec.z * BACK);
  lookAtPt.set(tx, 1.5, tz);
  camera.lookAt(lookAtPt);
}

/**
 * Boucle principale d'animation déclenchée à chaque frame.
 *
 * @returns {void}
 */
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (started) {
    stepPhysics(dt);
    limitRiderSpeed();
    limitLateralSpeed();

    riders.forEach(r => {
      const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      const currentSpeed = r.body.velocity.length();
      const desiredSpeed = BASE_SPEED * (r.intensity / 50);
      const speedDiff = desiredSpeed - currentSpeed;
      const accel = speedDiff * SPEED_GAIN;
      const accelForce = forward.scale(r.body.mass * accel);
      r.body.applyForce(accelForce, r.body.position);
    });

    clampAndRedirect();
    updateLaneOffsets(dt);
    updateRelays(dt);
    applyForces(dt);
    resolveOverlaps();
    boidSystem.update(dt);
  }


  riders.forEach(r => {
    const bodyPos = new THREE.Vector3().copy(r.body.position);
    const angleRaw = Math.atan2(bodyPos.z, bodyPos.x);
    const distRaw = ((angleRaw < 0 ? angleRaw + 2 * Math.PI : angleRaw) / (2 * Math.PI)) * TRACK_WRAP;
    if (distRaw < r.prevDist - TRACK_WRAP / 2) r.lap += 1;
    r.prevDist = distRaw;
    r.trackDist = distRaw + r.lap * TRACK_WRAP;
    const u = (distRaw % TRACK_WRAP) / TRACK_WRAP;
    const posOut = outerSpline.getPointAt(u);
    const posIn = innerSpline.getPointAt(u);
    const t0 = centerSpline.getTangentAt(u);
    const t1 = centerSpline.getTangentAt((u + 0.01) % 1);
    const curvature = t0.angleTo(t1);
    const blend = THREE.MathUtils.clamp(curvature * 10, 0, 1);
    const idealPos = posOut.clone().lerp(posIn, blend);
    const lateralDir = new THREE.Vector3(-t0.z, 0, t0.x).normalize();
    const lanePos = idealPos.clone().addScaledVector(lateralDir, r.laneOffset);

    r.mesh.position.copy(bodyPos.clone().lerp(lanePos, IDEAL_MIX));

    const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
    const dx = -Math.sin(theta),
      dz = Math.cos(theta);
    const lookAtPoint = new THREE.Vector3(r.mesh.position.x + dx, 0, r.mesh.position.z + dz);
    r.mesh.lookAt(lookAtPoint);
    r.mesh.rotateY(-Math.PI / 2);
    r.body.quaternion.set(
      r.mesh.quaternion.x,
      r.mesh.quaternion.y,
      r.mesh.quaternion.z,
      r.mesh.quaternion.w
    );
  });

  updateSelectionHelper();
  updateCamera();
  renderer.render(scene, camera);
}

export { animate };
