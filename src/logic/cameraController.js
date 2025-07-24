import { THREE, camera } from '../core/setupScene.js';
import { riders } from '../entities/riders.js';
import { TRACK_WRAP } from '../entities/track.js';
import { selectedIndex } from '../ui/ui.js';

const forwardVec = new THREE.Vector3();
const lookAtPt = new THREE.Vector3();

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

export { updateCamera };
