import { THREE, camera, renderer } from '../core/setupScene.js';
import { riders } from '../entities/riders.js';
import { TRACK_WRAP } from '../entities/track.js';
import { selectedIndex } from '../ui/ui.js';

const forwardVec = new THREE.Vector3();
const lookAtPt = new THREE.Vector3();
const tmpVec = new THREE.Vector3();

let extraAngle = 0;
let rotating = false;
let lastX = 0;
let zoomFactor = 1;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

function initCameraControls() {
  renderer.domElement.addEventListener('mousedown', e => {
    if (e.button !== 1) return;
    if (e.detail === 2) {
      extraAngle = 0;
      zoomFactor = 1;
      return;
    }
    rotating = true;
    lastX = e.clientX;
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!rotating) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    extraAngle += dx * 0.005;
  });

  window.addEventListener('mouseup', e => {
    if (e.button === 1) rotating = false;
  });

  renderer.domElement.addEventListener('wheel', e => {
    const delta = e.deltaY > 0 ? 0.1 : -0.1;
    zoomFactor = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomFactor + delta));
    e.preventDefault();
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
  tmpVec.copy(forwardVec).applyAxisAngle(new THREE.Vector3(0, 1, 0), extraAngle);
  const BACK = 10 * zoomFactor,
    H = 5 * zoomFactor;
  camera.position.set(tx - tmpVec.x * BACK, H, tz - tmpVec.z * BACK);
  lookAtPt.set(tx, 1.5, tz);
  camera.lookAt(lookAtPt);
}

export { updateCamera, initCameraControls };
