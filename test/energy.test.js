import assert from 'node:assert';
import { updateEnergy } from '../src/logic/energyLogic.js';
import { FATIGUE_RATE, RECOVERY_RATE } from '../src/utils/constants.js';

function testFatigue() {
  const riders = [{ relayPhase: 'pull', draftFactor: 1, inRelayLine: false, energy: 100 }];
  updateEnergy(riders, 1);
  assert.strictEqual(riders[0].energy, 100 - FATIGUE_RATE);
}

function testRecovery() {
  const riders = [{ relayPhase: 'line', draftFactor: 1.2, inRelayLine: false, energy: 50 }];
  updateEnergy(riders, 1);
  assert.strictEqual(riders[0].energy, 50 + RECOVERY_RATE);
}

testFatigue();
testRecovery();
console.log('Energy tests executed');
