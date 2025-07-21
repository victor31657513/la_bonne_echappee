// Gère le bouton de démarrage pour lancer la simulation

import { riders } from './riders.js';
import { polarToDist } from './utils.js';

let started = false;

const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    started = true;
    riders.forEach(r => {
      r.currentBoost = 0;
      r.isAttacking = false;
      r.attackGauge = 100;
      r.intensity = r.baseIntensity;
      r.body.velocity.set(0, 0, 0);
      r.body.angularVelocity.set(0, 0, 0);
      r.body.force.set(0, 0, 0);
      r.body.torque.set(0, 0, 0);
      r.mesh.position.copy(r.body.position);
      r.trackDist = polarToDist(r.body.position.x, r.body.position.z);
      r.prevDist = r.trackDist;
      r.lap = 0;
      if (r.boid) {
        r.boid.position = [r.body.position.x, r.body.position.z];
        r.boid.velocity = [0, 0];
      }
    });
    startBtn.disabled = true;
  });
}

export { started };
