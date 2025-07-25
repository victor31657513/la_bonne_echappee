import assert from 'node:assert';
import { updateEnergy } from '../src/logic/energyLogic.js';
import { FATIGUE_RATE, RECOVERY_RATE, EXPOSED_WIND_FATIGUE } from '../src/utils/constants.js';

function testFatigue() {
  const riders = [{ relayPhase: 'pull', draftFactor: 1, inRelayLine: false, inBreakaway: false, energy: 100, mode: 'follower' }];
  updateEnergy(riders, 1);
  assert.strictEqual(riders[0].energy, 100 - FATIGUE_RATE * EXPOSED_WIND_FATIGUE);
}

function testRecovery() {
  const riders = [{ relayPhase: 'line', draftFactor: 1.2, inRelayLine: false, inBreakaway: false, energy: 50, mode: 'follower' }];
  updateEnergy(riders, 1);
  assert.strictEqual(riders[0].energy, 50 + RECOVERY_RATE * 1.2);
}

testFatigue();
testRecovery();
console.log('Energy tests executed');
