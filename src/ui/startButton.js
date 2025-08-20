// Gère le bouton de démarrage pour lancer la simulation

import { riders } from '../entities/riders.js';
import { polarToDist } from '../utils/utils.js';
import { BASE_SPEED } from '../utils/constants.js';
import { emit } from '../utils/eventBus.js';
import { resumeAmbientSound } from '../logic/ambientSound.js';
import { RAPIER } from '../core/physicsWorld.js';
import { devLog } from '../utils/devLog.js';
import { camera } from '../core/setupScene.js';
import { startSimulation, stopSimulation } from '../logic/animation.js';

let started = false;
let running = false;

function setStarted(value) {
  started = value;
}

function isStarted() {
  return started;
}

function resetRiders() {
  riders.forEach(r => {
    r.currentBoost = 0;
    r.isAttacking = false;
    r.attackGauge = 100;
    r.intensity = r.baseIntensity;
    emit('intensityChange', { rider: r, value: r.intensity });
    const pos = r.body.translation();
    r.body.resetForces();
    r.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    r.mesh.position.copy(pos);
    r.trackDist = polarToDist(pos.x, pos.z);
    r.prevDist = r.trackDist;
    r.lap = 0;
  });
  devLog('Riders repositioned', riders.map(r => r.body.translation()));
}

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const pauseBtn = document.getElementById('pauseBtn');

if (startBtn) {
  startBtn.addEventListener('click', () => {
    devLog('Start button clicked');
    setStarted(true);
    resumeAmbientSound();
    resetRiders();
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
    startSimulation();
    running = true;
    if (pauseBtn) pauseBtn.textContent = 'Pause';
    startBtn.disabled = true;
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    devLog('Reset button clicked');
    stopSimulation();
    setStarted(false);
    resetRiders();
    running = false;
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.textContent = 'Pause';
  });
}

if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    if (!isStarted()) return;
    if (running) {
      stopSimulation();
      running = false;
      pauseBtn.textContent = 'Resume';
    } else {
      startSimulation();
      running = true;
      pauseBtn.textContent = 'Pause';
    }
  });
}

export { isStarted, setStarted };
