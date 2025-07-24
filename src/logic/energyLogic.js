import { FATIGUE_RATE, RECOVERY_RATE } from '../utils/constants.js';

function updateEnergy(riders, dt) {
  riders.forEach(r => {
    if (r.relayPhase === 'pull') {
      r.energy = Math.max(0, r.energy - FATIGUE_RATE * dt);
    } else if (r.draftFactor > 1 || r.inRelayLine) {
      r.energy = Math.min(100, r.energy + RECOVERY_RATE * dt);
    }
  });
}

export { updateEnergy };

