// Gère le bouton de démarrage pour lancer la simulation

import { riders } from '../entities/riders.js';
import { BASE_LINEAR_DAMPING } from '../utils/constants.js';
import { emit } from '../utils/eventBus.js';
import { resumeAmbientSound } from '../logic/ambientSound.js';
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
    r.mode = 'follower';
    r.energy = 100;
    r.draftFactor = 1;
    r.laneOffset = r.baseLaneOffset;
    r.laneTarget = r.baseLaneOffset;
    r.relayPhase = 'line';
    r.relayTimer = 0;
    r.relayTime = 0;
    r.relayIntensity = 0;
    r.relayChasing = false;
    r.relayLeader = false;
    r.inRelayLine = false;
    r.inBreakaway = false;
    r.inRelayCluster = false;
    r.protectLeader = false;
    emit('intensityChange', { rider: r, value: r.intensity });
    r.body.resetForces();
    r.body.linearDamping = BASE_LINEAR_DAMPING;
    // Wake up and synchronise the physics body with its visual mesh
    r.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    r.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const { x, y, z } = r.initialPosition;
    const { x: qx, y: qy, z: qz, w: qw } = r.initialQuaternion;
    r.body.setTranslation({ x, y, z }, true);
    r.body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true);
    r.mesh.position.set(x, y, z);
    r.mesh.quaternion.set(qx, qy, qz, qw);
    r.speed = 0;
    r.trackDist = r.initialTrackDist;
    r.prevDist = r.trackDist;
    r.lap = 0;
  });
  devLog('Riders repositioned', riders.map(r => r.body.translation()));
}

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  if (!startBtn) {
    console.error('Start button with id "startBtn" not found');
    return;
  }

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
        if (startBtn) startBtn.disabled = false;
      } else {
        startSimulation();
        running = true;
        pauseBtn.textContent = 'Pause';
        if (startBtn) startBtn.disabled = true;
      }
    });
  }
});

export { isStarted, setStarted };
