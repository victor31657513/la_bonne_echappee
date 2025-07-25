import assert from 'node:assert';
import { updateBreakaway, breakaway } from '../src/logic/breakawayManager.js';
import { updateEnergy } from '../src/logic/energyLogic.js';
import { BREAKAWAY_MIN_GAP, FATIGUE_RATE, EXPOSED_WIND_FATIGUE } from '../src/utils/constants.js';

function approx(a, b, eps = 1e-6) {
  assert.ok(Math.abs(a - b) <= eps, `${a} not close to ${b}`);
}

function testPenalty() {
  const r = { relayPhase: 'line', inRelayLine: false, inBreakaway: true, draftFactor: 1, energy: 100 };
  breakaway.members = [r];
  breakaway.gap = BREAKAWAY_MIN_GAP / 2;
  updateEnergy([r], 1);
  const ratio = 1 - breakaway.gap / BREAKAWAY_MIN_GAP;
  const expected = 100 - FATIGUE_RATE * (1 + ratio) * EXPOSED_WIND_FATIGUE;
  approx(r.energy, expected);
}

function testClosingRate() {
  const riders = [
    { trackDist: 100, team: 0, intensity: 50, relayChasing: false },
    { trackDist: 80, team: 1, intensity: 50, relayChasing: false },
    { trackDist: 60, team: 2, intensity: 100, relayChasing: true },
    { trackDist: 58, team: 3, intensity: 100, relayChasing: true }
  ];
  updateBreakaway(riders);
  approx(breakaway.closingRate, 1);
}


testPenalty();
testClosingRate();
console.log('Gap regulation tests executed');
