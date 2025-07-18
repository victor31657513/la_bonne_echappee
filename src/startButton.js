import { riders } from './riders.js';
import { TRACK_WRAP } from './track.js';
import { polarToDist } from './utils.js';

const BASE_SPEED = 8;

let started = false;

const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    started = true;
    riders.forEach(r => {
      r.currentBoost = 0;
      const theta = (polarToDist(r.body.position.x, r.body.position.z) / TRACK_WRAP) * 2 * Math.PI;
      const vx = -Math.sin(theta) * BASE_SPEED;
      const vz = Math.cos(theta) * BASE_SPEED;
      r.body.velocity.set(vx, 0, vz);
      r.mesh.position.copy(r.body.position);
      r.trackDist = polarToDist(r.body.position.x, r.body.position.z);
      r.prevDist = r.trackDist;
      r.lap = 0;
    });
    startBtn.disabled = true;
  });
}

export { started };
