import { THREE, scene, camera, renderer } from './setupScene.js';
import { CANNON } from './physicsWorld.js';
import { riders, boidSystem } from './riders.js';
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
const MAX_LANE_OFFSET = ROAD_WIDTH / 2 - 0.85;
const LANE_CHANGE_SPEED = 2;

const forwardVec = new THREE.Vector3();
const lookAtPt = new THREE.Vector3();
let lastTime = performance.now();

function clampAndRedirect() {
  const minR = INNER_R + 0.1;
  const maxR = OUTER_R - 0.1;
  riders.forEach(r => {
    const p = r.body.position;
    const radial = Math.hypot(p.x, p.z);
    if (radial < minR || radial > maxR) {
      const nx = p.x / radial,
        nz = p.z / radial;
      const clamped = THREE.MathUtils.clamp(radial, minR, maxR);
      p.x = nx * clamped;
      p.z = nz * clamped;
      const v = r.body.velocity;
      const tangent = new CANNON.Vec3(-nz, 0, nx);
      const speed = v.dot(tangent);
      v.x = tangent.x * speed;
      v.z = tangent.z * speed;
    }
  });
}

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
  const intensity = leader.relayIntensity || 0;
  return Math.min(1, 0.2 + 0.2 * intensity);
}

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
      r.laneOffset = THREE.MathUtils.clamp(
        r.laneOffset + dir * LANE_CHANGE_SPEED * dt,
        -MAX_LANE_OFFSET,
        MAX_LANE_OFFSET
      );
    } else {
      r.laneOffset = THREE.MathUtils.lerp(r.laneOffset, 0, dt);
    }
  });
}

function applyForces(dt) {
  const stretch = computeStretch();
  riders.forEach(r => {
    r.currentBoost =
      r.currentBoost !== undefined
        ? THREE.MathUtils.lerp(r.currentBoost, r.relayIntensity * RELAY_SPEED_BOOST, dt * 2)
        : r.relayIntensity * RELAY_SPEED_BOOST;

    // Determine if this rider is blocked by another rider directly ahead
    if (r.relayIntensity > 0) {
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
    } else {
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

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  stepPhysics(dt);

  riders.forEach(r => {
    if (started) {
      const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      const currentSpeed = r.body.velocity.length();
      const speedDiff = BASE_SPEED - currentSpeed;
      const accel = speedDiff * SPEED_GAIN;
      const accelForce = forward.scale(r.body.mass * accel);
      r.body.applyForce(accelForce, r.body.position);
    }
  });

  clampAndRedirect();
  updateLaneOffsets(dt);
  applyForces(dt);
  boidSystem.update(dt);

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
