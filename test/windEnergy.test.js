import assert from 'node:assert';
import { updateEnergy } from '../src/logic/energyLogic.js';
import { FATIGUE_RATE, EXPOSED_WIND_FATIGUE, SHELTERED_WIND_FATIGUE } from '../src/utils/constants.js';

function testWindExposureFatigue() {
  const exposed = { relayPhase: 'pull', draftFactor: 1, inRelayLine: false, inBreakaway: false, energy: 100, mode: 'follower' };
  const sheltered = { relayPhase: 'pull', draftFactor: 1.3, inRelayLine: false, inBreakaway: false, energy: 100, mode: 'follower' };
  updateEnergy([exposed, sheltered], 1);
  assert.strictEqual(exposed.energy, 100 - FATIGUE_RATE * EXPOSED_WIND_FATIGUE);
  assert.strictEqual(sheltered.energy, 100 - FATIGUE_RATE * SHELTERED_WIND_FATIGUE);
}

testWindExposureFatigue();
console.log('Wind energy tests executed');
