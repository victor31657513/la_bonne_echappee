import { riders } from './riders.js';
import { polarToDist } from './utils.js';

let started = false;

const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    started = true;
    riders.forEach(r => {
      r.currentBoost = 0;
      r.body.velocity.set(0, 0, 0);
      r.mesh.position.copy(r.body.position);
      r.trackDist = polarToDist(r.body.position.x, r.body.position.z);
    });
    startBtn.disabled = true;
  });
}

export { started };
