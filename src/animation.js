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
import { BASE_SPEED } from './constants.js';

const SPEED_GAIN = 0.3;
// Mix less with the ideal line so physical collisions have more influence
const IDEAL_MIX = 0.3;
const RELAY_SPEED_BOOST = 0.5;
// Reduce lateral acceleration so riders don't slide across the road
const LATERAL_FORCE = 3;
const MAX_SPEED = BASE_SPEED * 2;
// Limit side movement so riders don't slide across the road too quickly
// Limit side movement speed
const MAX_LATERAL_SPEED = 3;
const MAX_LANE_OFFSET = ROAD_WIDTH / 2 - 0.85;
// Slow down lane changes for smoother overtaking
const LANE_CHANGE_SPEED = 1.5;
const BASE_RELAY_INTERVAL = 5;
const RELAY_JOIN_GAP = 10;
const PULL_OFF_TIME = 2;
const PULL_OFFSET = 1.5;
const PULL_OFF_SPEED_FACTOR = 0.7;
const ATTACK_INTENSITY = 60; // 120% of base intensity
const ATTACK_DRAIN = 50; // gauge units per second during attack
const ATTACK_RECOVERY = 10; // gauge recovery per second
const RELAY_QUEUE_GAP = 4;
const RELAY_CHASE_INTENSITY = 70;

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
      // Move outward relative to the center of the road when overtaking
      const dir = r.baseLaneOffset >= 0 ? 1 : -1;

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
      r.laneOffset = THREE.MathUtils.lerp(r.laneOffset, r.baseLaneOffset, dt);
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
    const allTeam = riders.filter(r => r.team === t && r.relaySetting > 0);
    if (allTeam.length === 0) continue;

    const sorted = allTeam.filter(r => !r.pullingOff).sort((a, b) => b.trackDist - a.trackDist);
    const queue = [];
    sorted.forEach(r => {
      if (queue.length === 0) {
        queue.push(r);
      } else {
        const prev = queue[queue.length - 1];
        const dist = aheadDistance(r.trackDist, prev.trackDist);
        if (dist <= RELAY_JOIN_GAP) queue.push(r);
      }
    });

    if (queue.length === 0) continue;
    if (state.index >= queue.length) state.index = 0;
    const leader = queue[state.index];

    allTeam.forEach(r => {
      r.relayIntensity = 0;
      r.relayChasing = false;
    });
    leader.relayIntensity = leader.relaySetting;

    for (let i = 1; i < queue.length; i++) {
      const prev = queue[i - 1];
      const r = queue[i];
      const dist = aheadDistance(r.trackDist, prev.trackDist);
      if (dist > RELAY_QUEUE_GAP) r.relayChasing = true;
    }

    allTeam.forEach(r => {
      if (!queue.includes(r)) r.relayChasing = true;
    });

    state.timer += dt;
    const interval = BASE_RELAY_INTERVAL / queue.length;
    if (state.timer >= interval) {
      state.timer = 0;
      leader.pullingOff = true;
      leader.pullTimer = 0;
      leader.laneTarget = state.side * PULL_OFFSET;
      state.index = (state.index + 1) % queue.length;
      state.side *= -1;
    }
  }

  riders.forEach(r => {
    if (r.pullingOff) {
      r.pullTimer += dt;
      if (r.pullTimer >= PULL_OFF_TIME) {
        r.pullingOff = false;
        r.laneTarget = r.baseLaneOffset;
        }
    }
  });
}

/**
 * Adapte l'intensité des coureurs au leader lorsqu'il roule au maximum.
 *
 * @returns {void}
 */
function adjustIntensityToLeader() {
  const leader = riders.reduce((a, b) => (b.trackDist > a.trackDist ? b : a), riders[0]);
  if (leader.isAttacking || leader.intensity < 100) return;

  riders.forEach(r => {
    if (r !== leader && !r.isAttacking) {
      r.intensity = Math.max(r.intensity, leader.intensity);
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
  // The peloton no longer narrows at high speed so we don't compute stretch
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
        // Try progressively wider lateral moves when overtaking
        const SHIFT = 2;
        const maxOffset = ROAD_WIDTH / 2 - 1;
        let chosen = r.laneOffset;
        for (const dir of [-1, 1]) {
          for (let step = SHIFT; step <= maxOffset; step += SHIFT) {
            const cand = THREE.MathUtils.clamp(
              r.laneOffset + dir * step,
              -maxOffset,
              maxOffset
            );
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
          if (chosen !== r.laneOffset) break;
        }
        r.laneTarget = chosen;
      } else {
        r.laneTarget = r.baseLaneOffset;
      }
    } else if (!r.pullingOff) {
      r.laneTarget = r.baseLaneOffset;
    }

    // Smoothly steer towards the desired lateral position
    r.laneOffset = THREE.MathUtils.lerp(r.laneOffset, r.laneTarget, dt * 2);

    const bodyPos = r.body.position;
    const angle = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
    // Keep riders near their desired lane without pulling them to the center
    const targetRadius = BASE_RADIUS + r.laneOffset;
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
  // Iterate a few times to resolve chains of overlaps
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
          const pushX = nx * (overlap / 2);
          const pushZ = nz * (overlap / 2);
          a.body.position.x += pushX;
          a.body.position.z += pushZ;
          b.body.position.x -= pushX;
          b.body.position.z -= pushZ;
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
      if (r.isAttacking) {
        r.attackGauge = Math.max(0, r.attackGauge - ATTACK_DRAIN * dt);
        r.intensity = ATTACK_INTENSITY;
        if (r.attackGauge <= 0) {
          r.isAttacking = false;
          r.intensity = r.baseIntensity;
        }
      } else {
        r.attackGauge = Math.min(100, r.attackGauge + ATTACK_RECOVERY * dt);
        r.intensity = r.baseIntensity;
        if (r.relayChasing) {
          r.intensity = Math.max(r.intensity, RELAY_CHASE_INTENSITY);
        }
      }
    });

    adjustIntensityToLeader();

    riders.forEach(r => {
      const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      const currentSpeed = r.body.velocity.length();
      let desiredSpeed = BASE_SPEED * (r.intensity / 50);
      if (r.pullingOff) desiredSpeed *= PULL_OFF_SPEED_FACTOR;
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
    // Synchronize the logical lane offset with the actual body position so
    // collisions can push riders sideways
    const radial = Math.hypot(bodyPos.x, bodyPos.z);
    r.laneOffset = THREE.MathUtils.clamp(
      radial - BASE_RADIUS,
      -MAX_LANE_OFFSET,
      MAX_LANE_OFFSET
    );
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
