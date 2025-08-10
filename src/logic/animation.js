// Animation du peloton et logique de comportement des coureurs

import { THREE, scene, camera, renderer } from '../core/setupScene.js';
import { RAPIER } from '../core/physicsWorld.js';
import { riders } from '../entities/riders.js';
import { RIDER_WIDTH, MIN_LATERAL_GAP } from '../entities/riderConstants.js';
import {
  computeOverlapCommands,
  applyOverlapCommands
} from './overlapResolver.js';
import {
  outerSpline,
  innerSpline,
  centerSpline,
  INNER_R,
  OUTER_R,
  TRACK_WRAP,
  BASE_RADIUS,
  ROAD_WIDTH
} from '../entities/track.js';
import { stepPhysics } from '../core/physicsWorld.js';
import { updateSelectionHelper, selectedIndex } from '../ui/ui.js';
import { started, setStarted } from '../ui/startButton.js';
import { aheadDistance, wrapDistance, polarToDist } from '../utils/utils.js';
import { updateDraftFactors as computeDraftFactors } from './draftLogic.js';
import { updateBordure } from './bordureLogic.js';
import { BASE_SPEED, FATIGUE_RATE } from '../utils/constants.js';
import { updateEnergy } from './energyLogic.js';
import { updateRelays } from './relayController.js';
import { updateCamera } from './cameraController.js';
import { emit } from '../utils/eventBus.js';
import { updateBreakaway } from './breakawayManager.js';
import { devLog } from '../utils/devLog.js';

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
const PULL_OFF_SPEED_FACTOR = 0.7;
const ATTACK_INTENSITY = 60; // 120 % de l'intensité de base
const ATTACK_DRAIN = 50; // unités de jauge par seconde lors d'une attaque
const ATTACK_RECOVERY = 10; // récupération de jauge par seconde
const RELAY_CHASE_INTENSITY = 100;
const RELAY_LEADER_INTENSITY = 100;
const PELOTON_GAP = 5;
const BREAKAWAY_INTENSITY = 80;

// Intensité et direction du vent latéral. direction = 1 pour un vent venant de la gauche
const WIND_STRENGTH = 0.5;
const WIND_DIRECTION = 1;

function setIntensity(rider, value) {
  if (rider.intensity !== value) {
    const prev = rider.intensity;
    rider.intensity = value;
    emit('intensityChange', { rider, value, prev });
  } else {
    rider.intensity = value;
  }
}

let lastTime = performance.now();
let loggedStartFrame = false;

/**
 * Limite la vitesse maximale des coureurs pour éviter des accélérations
 * trop fortes qui déstabiliseraient la simulation.
 *
 * @returns {void}
 */
function limitRiderSpeed() {
  riders.forEach(r => {
    const v = r.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed > MAX_SPEED) {
      const scale = MAX_SPEED / speed;
      r.body.setLinvel(
        new RAPIER.Vector3(v.x * scale, v.y * scale, v.z * scale),
        true
      );
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
    const right = new RAPIER.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const v = r.body.linvel();
    const latSpeed = v.x * right.x + v.z * right.z;
    if (Math.abs(latSpeed) > MAX_LATERAL_SPEED) {
      const excess = latSpeed - Math.sign(latSpeed) * MAX_LATERAL_SPEED;
      const newV = new RAPIER.Vector3(
        v.x - excess * right.x,
        v.y,
        v.z - excess * right.z
      );
      r.body.setLinvel(newV, true);
    }
  });
}

function sanitizeRider(r) {
  const pos = r.body.translation();
  const vel = r.body.linvel();
  const invalid = [pos.x, pos.y, pos.z, vel.x, vel.y, vel.z].some(
    v => Number.isNaN(v) || !Number.isFinite(v)
  );
  if (invalid) {
    const angle = Number.isFinite(r.trackDist)
      ? ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI
      : 0;
    const x = (BASE_RADIUS + r.baseLaneOffset) * Math.cos(angle);
    const z = (BASE_RADIUS + r.baseLaneOffset) * Math.sin(angle);
    r.body.setTranslation({ x, y: 0, z }, true);
    r.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    r.trackDist = polarToDist(x, z);
    r.prevDist = r.trackDist;
    r.lap = 0;
  }
  if (!Number.isFinite(r.laneOffset)) {
    r.laneOffset = r.baseLaneOffset;
  }
}

function sanitizeRiders() {
  riders.forEach(sanitizeRider);
}

/**
 * Calcule le facteur d\'aspiration et la tra\xEEn\xE9e pour chaque coureur.
 *
 * @returns {void}
 */
function updateDraftFactors() {
  computeDraftFactors(riders, WIND_DIRECTION);
}

/**
 * Active le mode "chase" lorsque l'espace devant un coureur devient trop grand.
 *
 * @returns {void}
 */
function updatePelotonChase() {
  let chase = false;
  riders.forEach(r => {
    let minDist = TRACK_WRAP;
    riders.forEach(o => {
      if (o === r) return;
      const d = aheadDistance(r.trackDist, o.trackDist);
      if (d > 0 && d < minDist) minDist = d;
    });
    if (minDist > PELOTON_GAP) chase = true;
  });

  riders.forEach(r => {
    if (r.mode !== 'solo') {
      r.relayChasing = chase;
    } else {
      r.relayChasing = false;
    }
  });
}

function updateBordureStatus() {
  updateBordure(riders, WIND_STRENGTH);
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
    const p = r.body.translation();
    const v = r.body.linvel();
    p.y = 0;
    v.y = 0;
    const radial = Math.hypot(p.x, p.z);
    if (radial < minR || radial > maxR) {
      // Si un coureur se retrouve exactement au centre, son rayon est nul
      // ce qui produirait des valeurs NaN lors de la normalisation.
      const nx = radial > 0 ? p.x / radial : 1;
      const nz = radial > 0 ? p.z / radial : 0;
      const clamped = THREE.MathUtils.clamp(radial || minR, minR, maxR);
      r.body.setTranslation({ x: nx * clamped, y: 0, z: nz * clamped }, true);
      const tangent = new RAPIER.Vector3(-nz, 0, nx);
      const speed = v.x * tangent.x + v.z * tangent.z;
      r.body.setLinvel(
        new RAPIER.Vector3(tangent.x * speed, 0, tangent.z * speed),
        true
      );
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
    if (r.protectLeader) {
      const leader = riders.find(o => o.team === r.team && o.isLeader);
      if (leader && leader !== r) {
        r.laneTarget = THREE.MathUtils.lerp(r.laneTarget, leader.laneOffset, dt);
      }
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
    const windShift = WIND_DIRECTION * 0.3;
    r.laneOffset = THREE.MathUtils.lerp(
      r.laneOffset,
      THREE.MathUtils.clamp(r.laneTarget + windShift, -MAX_LANE_OFFSET, MAX_LANE_OFFSET),
      dt
    );
  });
}

/**
 * Gère la logique de relais pour chaque équipe.
 *
 * @param {number} dt Durée écoulée depuis la dernière mise à jour en secondes.
 * @returns {void}
 */

function updateRiderIntensity(r, dt) {
  if (r.isAttacking) {
    r.attackGauge = Math.max(0, r.attackGauge - ATTACK_DRAIN * dt);
    setIntensity(r, ATTACK_INTENSITY);
    if (r.attackGauge <= 0) {
      r.isAttacking = false;
      setIntensity(r, r.baseIntensity);
    }
    return;
  }

  r.attackGauge = Math.min(100, r.attackGauge + ATTACK_RECOVERY * dt);

  if (r.mode === 'solo') {
    setIntensity(r, r.baseIntensity);
    return;
  }

  if (r.mode === 'follower') {
    let minDist = TRACK_WRAP;
    riders.forEach(o => {
      if (o === r) return;
      const d = aheadDistance(r.trackDist, o.trackDist);
      if (d > 0 && d < minDist) minDist = d;
    });
    if (minDist > 2) {
      const desiredIntensity = Math.min(100, (35 / 3.6 / BASE_SPEED) * 50);
      setIntensity(r, desiredIntensity);
      return;
    }
  }

  if (r.mode === 'relay' && r.relayPhase === 'pull') {
    setIntensity(r, r.relaySetting);
    return;
  }

  let newInt = r.baseIntensity;
  if (r.relayChasing) newInt = Math.max(newInt, RELAY_CHASE_INTENSITY);
  if (r.relayLeader) newInt = Math.max(newInt, RELAY_LEADER_INTENSITY);
  if (r.inBreakaway) newInt = Math.max(newInt, BREAKAWAY_INTENSITY);

  let bestDist = TRACK_WRAP;
  let ahead = null;
  for (const o of riders) {
    if (o === r) continue;
    const d = aheadDistance(r.trackDist, o.trackDist);
    if (d > 0 && d < bestDist) {
      bestDist = d;
      ahead = o;
    }
  }
  if (!ahead || bestDist > PELOTON_GAP) {
    newInt = Math.min(100, newInt + 50 * dt);
  } else {
    newInt = Math.max(newInt, ahead.intensity);
  }

  setIntensity(r, newInt);
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
    if (r !== leader && r.mode !== 'solo' && !r.isAttacking) {
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

    const bodyPos = r.body.translation();
    const angle = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
    // Garde les coureurs près de leur voie cible sans les ramener vers le centre
    const targetRadius = BASE_RADIUS + r.laneOffset;
    const targetX = targetRadius * Math.cos(angle);
    const targetZ = targetRadius * Math.sin(angle);
    const lateralVec = new RAPIER.Vector3(targetX - bodyPos.x, 0, targetZ - bodyPos.z);
    const lateralForce = new RAPIER.Vector3(
      lateralVec.x * LATERAL_FORCE,
      0,
      lateralVec.z * LATERAL_FORCE
    );

    const theta = angle;
    const fwd = new RAPIER.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const fwdForce = new RAPIER.Vector3(
      fwd.x * r.currentBoost,
      0,
      fwd.z * r.currentBoost
    );
    const right = new RAPIER.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const windForce = new RAPIER.Vector3(
      right.x * WIND_STRENGTH * WIND_DIRECTION,
      0,
      right.z * WIND_STRENGTH * WIND_DIRECTION
    );

    const totalForce = new RAPIER.Vector3(
      lateralForce.x + fwdForce.x + windForce.x,
      0,
      lateralForce.z + fwdForce.z + windForce.z
    );
    r.body.addForce(totalForce, true);
  });
}

/**
 * Ajuste la caméra en fonction du coureur sélectionné ou de la moyenne du peloton.
 *
 * @returns {void}
 */

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
    if (!loggedStartFrame) {
      const cam = camera.position;
      const first = riders[0]?.body.translation();
      devLog('First animation frame', {
        cameraPos: { x: cam.x, y: cam.y, z: cam.z },
        firstRider: first
      });
      loggedStartFrame = true;
    }
    try {
      stepPhysics(dt);
    } catch (e) {
      console.error('Crash physics:', e);
      setStarted(false);
    }
    riders.forEach(r => {
      const v = r.body.linvel();
      r.speed = Math.hypot(v.x, v.y, v.z) * 3.6;
    });
    sanitizeRiders();
    const first = riders[0];
    if (first) {
      const pos = first.body.translation();
      const vel = first.body.linvel();
      const lane = first.laneOffset;
      devLog('Physics step', {
        pos: { x: pos.x, y: pos.y, z: pos.z },
        vel: { x: vel.x, y: vel.y, z: vel.z },
        laneOffset: lane
      });
      if ([pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, lane].some(v => Number.isNaN(v) || Math.abs(v) > 1e5)) {
        devLog('Unstable physics values', { pos, vel, laneOffset: lane });
      }
    }
    limitRiderSpeed();
    limitLateralSpeed();
    updatePelotonChase();
    updateBordureStatus();
    updateBreakaway(riders);
    updateDraftFactors();
    updateEnergy(riders, dt);

    riders.forEach(r => {
      updateRiderIntensity(r, dt);
    });

    adjustIntensityToLeader();

    riders.forEach(r => {
      const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new RAPIER.Vector3(-Math.sin(theta), 0, Math.cos(theta));
      const vel = r.body.linvel();
      const currentSpeed = Math.hypot(vel.x, vel.y, vel.z);
      let desiredSpeed = BASE_SPEED * (r.intensity / 50) * r.draftFactor;
      if (r.relayPhase === 'fall_back') desiredSpeed *= PULL_OFF_SPEED_FACTOR;
      const speedDiff = desiredSpeed - currentSpeed;
      const accel = speedDiff * SPEED_GAIN;
      const accelForce = new RAPIER.Vector3(
        forward.x * r.body.mass() * accel,
        0,
        forward.z * r.body.mass() * accel
      );
      r.body.addForce(accelForce, true);
    });

    clampAndRedirect();
    updateLaneOffsets(dt);
    updateRelays(dt);
    applyForces(dt);
    const overlapCmds = computeOverlapCommands(riders);
    applyOverlapCommands(overlapCmds);
  }


  riders.forEach(r => {
    const bodyPos = new THREE.Vector3().copy(r.body.translation());
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
    const uRaw = (distRaw % TRACK_WRAP) / TRACK_WRAP;
    const u = Number.isFinite(uRaw) ? uRaw : 0;
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
    r.body.setRotation(
      {
        x: r.mesh.quaternion.x,
        y: r.mesh.quaternion.y,
        z: r.mesh.quaternion.z,
        w: r.mesh.quaternion.w
      },
      false
    );
  });

  updateSelectionHelper();
  updateCamera();
  renderer.render(scene, camera);
}

export { animate, updateLaneOffsets };
