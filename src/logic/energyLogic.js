import {
  FATIGUE_RATE,
  RECOVERY_RATE,
  BREAKAWAY_MIN_GAP
} from '../utils/constants.js';
import { breakaway } from './breakawayManager.js';

function updateEnergy(riders, dt) {
  riders.forEach(r => {
    let fatigue = FATIGUE_RATE;
    if (r.inBreakaway && breakaway.gap < BREAKAWAY_MIN_GAP) {
      const ratio = 1 - breakaway.gap / BREAKAWAY_MIN_GAP;
      fatigue += FATIGUE_RATE * ratio;
    }

    if (r.relayPhase === 'pull' || (r.inBreakaway && !r.inRelayLine)) {
      r.energy = Math.max(0, r.energy - fatigue * dt);
    } else if (r.draftFactor > 1 || r.inRelayLine) {
      let recovery = RECOVERY_RATE;
      if (!r.inBreakaway && r.draftFactor > 1) {
        recovery *= r.draftFactor;
      }
      r.energy = Math.min(100, r.energy + recovery * dt);
    }
  });
}

export { updateEnergy };

