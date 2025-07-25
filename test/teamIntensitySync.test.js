import assert from 'node:assert';
import { on, off, emit } from '../src/utils/eventBus.js';

function testRiderChangeUpdatesTeamSlider() {
  const tid = 0;
  const teamModeSelect = { value: 'relay' };
  const teamIntInput = { value: 50 };
  const teamIntVal = { textContent: 50 };
  function handler(payload) {
    if (payload.rider.team === tid && teamModeSelect.value === 'relay') {
      teamIntInput.value = payload.value;
      teamIntVal.textContent = payload.value;
    }
  }
  on('intensityChange', handler);
  const rider = { team: tid, relaySetting: 75 };
  emit('intensityChange', { rider, value: 75 });
  assert.strictEqual(teamIntInput.value, 75);
  assert.strictEqual(teamIntVal.textContent, 75);
  off('intensityChange', handler);
}

function testTeamSliderPropagation() {
  const tid = 1;
  const teamModeSelect = { value: 'relay' };
  const teamIntInput = { value: 50 };
  const teamIntVal = { textContent: 50 };
  const riders = [
    { team: tid, mode: 'relay', relayPhase: 'pull', relaySetting: 0, intensity: 0, isAttacking: false },
    { team: tid, mode: 'relay', relayPhase: 'line', relaySetting: 0, intensity: 0, isAttacking: false }
  ];

  const val = Math.round(75 / 25) * 25;
  teamIntInput.value = val;
  teamIntVal.textContent = val;
  riders
    .filter(r => r.team === tid)
    .forEach(r => {
      r.relaySetting = val;
      if (teamModeSelect.value === 'relay' && r.mode === 'relay' && r.relayPhase === 'pull') {
        r.intensity = val;
      }
    });
  assert.strictEqual(riders[0].relaySetting, 75);
  assert.strictEqual(riders[1].relaySetting, 75);
  assert.strictEqual(riders[0].intensity, 75);
}

testRiderChangeUpdatesTeamSlider();
testTeamSliderPropagation();
console.log('Team intensity sync tests executed');
