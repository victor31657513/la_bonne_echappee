import { resumeAmbientSound, pauseAmbientSound } from '../logic/ambientSound.js';

const toggleBtn = document.getElementById('soundToggle');
let enabled = true;

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    enabled = !enabled;
    if (enabled) {
      toggleBtn.textContent = '🔊';
      resumeAmbientSound();
    } else {
      toggleBtn.textContent = '🔇';
      pauseAmbientSound();
    }
  });
}

export { enabled as soundEnabled };
