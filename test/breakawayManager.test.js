import assert from 'node:assert';
import { updateBreakaway, breakaway } from '../src/logic/breakawayManager.js';
import { BREAKAWAY_TRIGGER_GAP, BREAKAWAY_CAPTURE_GAP } from '../src/utils/constants.js';

function testDetection() {
  const riders = [
    { trackDist: 100, inRelayLine: false },
    { trackDist: 100 - (BREAKAWAY_TRIGGER_GAP + 1), inRelayLine: false },
    { trackDist: 50, inRelayLine: false }
  ];
  updateBreakaway(riders);
  assert.strictEqual(breakaway.members.length, 1);
  assert.ok(riders[0].inBreakaway);
}

function testReintegration() {
  const riders = [
    { trackDist: 100, inRelayLine: false },
    { trackDist: 100 - (BREAKAWAY_TRIGGER_GAP + 1), inRelayLine: false },
    { trackDist: 50, inRelayLine: false }
  ];
  updateBreakaway(riders);
  // reduce gap below capture threshold
  riders[1].trackDist = riders[0].trackDist - (BREAKAWAY_CAPTURE_GAP - 1);
  updateBreakaway(riders);
  assert.strictEqual(breakaway.members.length, 0);
  assert.ok(!riders[0].inBreakaway);
}

testDetection();
testReintegration();
console.log('BreakawayManager tests executed');
