// Gère le bouton de démarrage pour lancer la simulation

import { riders } from '../entities/riders.js';
import { polarToDist } from '../utils/utils.js';
import { BASE_SPEED } from '../utils/constants.js';
import { emit } from '../utils/eventBus.js';
import { resumeAmbientSound } from '../logic/ambientSound.js';
import { RAPIER } from '../core/physicsWorld.js';
import { devLog } from '../utils/devLog.js';
import { camera } from '../core/setupScene.js';

let started = false;

const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    devLog('Start button clicked');
    started = true;
    resumeAmbientSound();
    riders.forEach(r => {
      r.currentBoost = 0;
      r.isAttacking = false;
      r.attackGauge = 100;
      r.intensity = r.baseIntensity;
      emit('intensityChange', { rider: r, value: r.intensity });
      const pos = r.body.translation();
      // Laisse la physique accélérer progressivement
      r.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
      r.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      r.body.resetForces();
      r.mesh.position.copy(pos);
      r.trackDist = polarToDist(pos.x, pos.z);
      r.prevDist = r.trackDist;
      r.lap = 0;
      if (r.boid) {
        r.boid.position = [pos.x, pos.z];
        // La vitesse du boid est nulle pour démarrer à l'arrêt
        r.boid.velocity = [0, 0];
      }
    });
    devLog('Riders repositioned', riders.map(r => r.body.translation()));
    // Force un recalcul de la taille du canvas au démarrage
    const before = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    devLog('Camera before resize', before);
    window.dispatchEvent(new Event('resize'));
    const after = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    devLog('Camera after resize', after);
    startBtn.disabled = true;
  });
}

export { started };
