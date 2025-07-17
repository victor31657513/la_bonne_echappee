import { riders } from './riders.js';
import { TRACK_WRAP } from './track.js';
import { polarToDist } from './utils.js';

const BASE_SPEED = 8;

let started = false;

(function () {
  const startBtn = document.createElement('button');
  startBtn.textContent = 'Démarrer la simulation';
  startBtn.style.position = 'absolute';
  startBtn.style.bottom = '10px';
  startBtn.style.right = '10px';
  startBtn.style.padding = '8px 12px';
  startBtn.style.zIndex = 100;
  document.body.appendChild(startBtn);
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
    });
    startBtn.disabled = true;
  });
})();

export { started };
