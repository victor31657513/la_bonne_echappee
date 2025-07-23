// Animation du peloton et logique de comportement des coureurs

import { THREE, scene, camera, renderer } from './setupScene.js';
import { CANNON } from './physicsWorld.js';
import { riders, boidSystem, teamRelayState } from './riders.js';
import { RIDER_WIDTH, MIN_LATERAL_GAP } from './riderConstants.js';
import { resolveOverlaps } from './overlapResolver.js';
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
import { BASE_SPEED, RELAY_MIN_DIST, RELAY_MAX_DIST } from './constants.js';
import { updateRelayCluster } from './relayCluster.js';
import { relayStep } from './relayLogic.js';
import { emit } from './eventBus.js';

const SPEED_GAIN = 0.3;
// On mélange moins avec la trajectoire idéale pour que les collisions physiques aient plus d'influence
const IDEAL_MIX = 0.3;
const RELAY_SPEED_BOOST = 0.5;
// Réduit l'accélération latérale pour éviter que les coureurs glissent sur la route
const LATERAL_FORCE = 3;
const MAX_SPEED = BASE_SPEED * 2;
// Limite les mouvements latéraux pour que les coureurs ne glissent pas trop vite de côté
// Limite la vitesse de déplacement latéral
const MAX_LATERAL_SPEED = 3;
const MAX_LANE_OFFSET = ROAD_WIDTH / 2 - RIDER_WIDTH / 2 - MIN_LATERAL_GAP / 2;
// Ralentit les changements de ligne pour des dépassements plus fluides
const LANE_CHANGE_SPEED = 1.5;
const BASE_RELAY_INTERVAL = 5;
const RELAY_JOIN_GAP = 10;
const PULL_OFF_TIME = 2;
const PULL_OFFSET = 1.5;
const PULL_OFF_SPEED_FACTOR = 0.7;
const ATTACK_INTENSITY = 60; // 120 % de l'intensité de base
const ATTACK_DRAIN = 50; // unités de jauge par seconde lors d'une attaque
const ATTACK_RECOVERY = 10; // récupération de jauge par seconde
const RELAY_QUEUE_GAP = 2.5;
const RELAY_CHASE_INTENSITY = 70;
const RELAY_TARGET_GAP = 1.5;
const RELAY_LEADER_INTENSITY = 70;
// Force appliquée pour corriger l'écart entre deux coureurs en relais
const RELAY_CORRECTION_GAIN = 5;

function setIntensity(rider, value) {
  if (rider.intensity !== value) {
    const prev = rider.intensity;
    rider.intensity = value;
    emit('intensityChange', { rider, value, prev });
  } else {
    rider.intensity = value;
  }
}

function setPhase(rider, phase) {
  if (rider.relayPhase !== phase) {
    const prev = rider.relayPhase;
    rider.relayPhase = phase;
    emit('phaseChange', { rider, phase, prev });
  } else {
    rider.relayPhase = phase;
  }
}

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
    if (r.inRelayLine) {
      r.laneOffset = THREE.MathUtils.lerp(r.laneOffset, r.laneTarget, dt);
      return;
    }
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
      // Se décaler vers l'extérieur par rapport au centre de la route lors d'un dépassement
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

    const { queue } = relayStep(allTeam, state, dt);

    for (let i = 1; i < queue.length; i++) {
      const prev = queue[i - 1];
      const r = queue[i];
      const dist = aheadDistance(r.trackDist, prev.trackDist);
      if (dist > RELAY_TARGET_GAP) r.relayChasing = true;

      const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      let diff = 0;
      if (dist > RELAY_MAX_DIST) diff = dist - RELAY_MAX_DIST;
      else if (dist < RELAY_MIN_DIST) diff = dist - RELAY_MIN_DIST;
      if (diff !== 0) {
        const force = forward.scale(diff * RELAY_CORRECTION_GAIN * r.body.mass);
        r.body.applyForce(force, r.body.position);
      }

      r.inRelayLine = true;
    }

    allTeam.forEach(r => {
      if (!queue.includes(r)) r.relayChasing = true;
    });

    state.timer += dt;
    const interval = BASE_RELAY_INTERVAL / queue.length;
    if (state.timer >= interval) {
      state.timer = 0;
      setPhase(queue[state.index], 'fall_back');
      queue[state.index].relayTimer = 0;
      queue[state.index].inRelayLine = false;
      queue[state.index].relayLeader = false;
      queue[state.index].laneTarget = state.side * PULL_OFFSET;
      state.index = (state.index + 1) % queue.length;
      state.side *= -1;
    }
  }

  riders.forEach(r => {
    if (r.relayPhase === 'fall_back') {
      r.relayTimer += dt;
      if (r.relayTimer >= PULL_OFF_TIME) {
        setPhase(r, 'line');
        r.relayChasing = true;
        r.laneTarget = 0;
      }
    }
    if (r.inRelayLine) {
      r.laneTarget = 0;
    } else if (r.relayPhase !== 'fall_back') {
      r.laneTarget = r.baseLaneOffset;
    }
  });

  updateRelayCluster(riders);
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
      setIntensity(r, Math.max(r.intensity, leader.intensity));
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
  // Le peloton ne se resserre plus à haute vitesse, donc on ne calcule plus l'étirement
  riders.forEach(r => {
    r.currentBoost =
      r.currentBoost !== undefined
        ? THREE.MathUtils.lerp(r.currentBoost, r.relayIntensity * RELAY_SPEED_BOOST, dt * 2)
        : r.relayIntensity * RELAY_SPEED_BOOST;


    // Determine if this rider is blocked by another rider directly ahead
    if (r.relayIntensity > 0 && r.relayPhase !== 'fall_back') {
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
        // Tenter des décalages latéraux de plus en plus larges lors d'un dépassement
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
    } else if (r.relayPhase !== 'fall_back') {
      r.laneTarget = r.baseLaneOffset;
    }

    // Oriente progressivement vers la position latérale souhaitée
    r.laneOffset = THREE.MathUtils.lerp(r.laneOffset, r.laneTarget, dt * 2);

    const bodyPos = r.body.position;
    const angle = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
    // Garde les coureurs près de leur voie cible sans les ramener vers le centre
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
        setIntensity(r, ATTACK_INTENSITY);
        if (r.attackGauge <= 0) {
          r.isAttacking = false;
          setIntensity(r, r.baseIntensity);
        }
      } else {
        r.attackGauge = Math.min(100, r.attackGauge + ATTACK_RECOVERY * dt);
        let newInt = r.baseIntensity;
        if (r.relayChasing) {
          newInt = Math.max(newInt, RELAY_CHASE_INTENSITY);
        }
        if (r.relayLeader) {
          newInt = Math.max(newInt, RELAY_LEADER_INTENSITY);
        }
        setIntensity(r, newInt);
      }
    });

    adjustIntensityToLeader();

    riders.forEach(r => {
      const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      const currentSpeed = r.body.velocity.length();
      let desiredSpeed = BASE_SPEED * (r.intensity / 50);
      if (r.relayPhase === 'fall_back') desiredSpeed *= PULL_OFF_SPEED_FACTOR;
      const speedDiff = desiredSpeed - currentSpeed;
      const accel = speedDiff * SPEED_GAIN;
      const accelForce = forward.scale(r.body.mass * accel);
      r.body.applyForce(accelForce, r.body.position);
    });

    clampAndRedirect();
    updateLaneOffsets(dt);
    updateRelays(dt);
    applyForces(dt);
    resolveOverlaps(riders);
    boidSystem.update(dt);
  }


  riders.forEach(r => {
    const bodyPos = new THREE.Vector3().copy(r.body.position);
    // Synchroniser le décalage logique de voie avec la position réelle du corps
    // afin que les collisions puissent repousser latéralement les coureurs
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
