// Gère le bouton de démarrage pour lancer la simulation

import { riders } from '../entities/riders.js';
import { polarToDist } from '../utils/utils.js';
import { BASE_SPEED } from '../utils/constants.js';
import { emit } from '../utils/eventBus.js';

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
      emit('intensityChange', { rider: r, value: r.intensity });
      const angle = Math.atan2(r.body.position.z, r.body.position.x);
      r.body.velocity.set(
        -Math.sin(angle) * BASE_SPEED,
        0,
        Math.cos(angle) * BASE_SPEED
      );
      r.body.angularVelocity.set(0, 0, 0);
      r.body.force.set(0, 0, 0);
      r.body.torque.set(0, 0, 0);
      r.mesh.position.copy(r.body.position);
      r.trackDist = polarToDist(r.body.position.x, r.body.position.z);
      r.prevDist = r.trackDist;
      r.lap = 0;
      if (r.boid) {
        r.boid.position = [r.body.position.x, r.body.position.z];
        r.boid.velocity = [
          -Math.sin(angle) * BASE_SPEED,
          Math.cos(angle) * BASE_SPEED
        ];
      }
    });
    startBtn.disabled = true;
  });
}

export { started };
