import { THREE, scene, camera, renderer } from './setupScene.js';
import { CANNON } from './physicsWorld.js';
import { riders, boidSystem } from './riders.js';
import { outerSpline, innerSpline, centerSpline, INNER_R, OUTER_R, TRACK_WRAP } from './track.js';
import { stepPhysics } from './physicsWorld.js';
import { updateSelectionHelper, selectedIndex } from './ui.js';
import { started } from './startButton.js';
import { polarToDist } from './utils.js';

const BASE_SPEED = 8;
const SPEED_GAIN = 0.3;
const IDEAL_MIX = 0.8;
const RELAY_SPEED_BOOST = 0.5;
const LATERAL_FORCE = 5;

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

function applyForces(dt) {
  riders.forEach(r => {
    r.currentBoost =
      r.currentBoost !== undefined
        ? THREE.MathUtils.lerp(r.currentBoost, r.relayIntensity * RELAY_SPEED_BOOST, dt * 2)
        : r.relayIntensity * RELAY_SPEED_BOOST;

    const bodyPos = r.body.position;
    const u = (polarToDist(bodyPos.x, bodyPos.z) % TRACK_WRAP) / TRACK_WRAP;
    const ideal = centerSpline.getPointAt(u);
    const lateralVec = new CANNON.Vec3(ideal.x - bodyPos.x, 0, ideal.z - bodyPos.z);
    const lateralForce = lateralVec.scale(LATERAL_FORCE);

    const theta = (polarToDist(bodyPos.x, bodyPos.z) / TRACK_WRAP) * 2 * Math.PI;
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
    ang = (r.trackDist / TRACK_WRAP) * 2 * Math.PI;
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
    ang = (avg / TRACK_WRAP) * 2 * Math.PI;
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
      const theta = (polarToDist(r.body.position.x, r.body.position.z) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      const currentSpeed = r.body.velocity.length();
      const speedDiff = BASE_SPEED - currentSpeed;
      const accel = speedDiff * SPEED_GAIN;
      const accelForce = forward.scale(r.body.mass * accel);
      r.body.applyForce(accelForce, r.body.position);
    }
  });

  clampAndRedirect();
  applyForces(dt);
  boidSystem.update(dt);

  riders.forEach(r => {
    const bodyPos = new THREE.Vector3().copy(r.body.position);
    const u = (polarToDist(bodyPos.x, bodyPos.z) % TRACK_WRAP) / TRACK_WRAP;
    const posOut = outerSpline.getPointAt(u);
    const posIn = innerSpline.getPointAt(u);
    const t0 = centerSpline.getTangentAt(u);
    const t1 = centerSpline.getTangentAt((u + 0.01) % 1);
    const curvature = t0.angleTo(t1);
    const blend = THREE.MathUtils.clamp(curvature * 10, 0, 1);
    const idealPos = posOut.clone().lerp(posIn, blend);

    r.mesh.position.copy(bodyPos.clone().lerp(idealPos, IDEAL_MIX));
    r.trackDist = polarToDist(r.mesh.position.x, r.mesh.position.z);

    const theta = (r.trackDist / TRACK_WRAP) * 2 * Math.PI;
    const dx = -Math.sin(theta),
      dz = Math.cos(theta);
    const lookAtPoint = new THREE.Vector3(r.mesh.position.x + dx, 0, r.mesh.position.z + dz);
    r.mesh.lookAt(lookAtPoint);
    r.mesh.rotateY(-Math.PI / 2);
  });

  updateSelectionHelper();
  updateCamera();
  renderer.render(scene, camera);
}

export { animate };
