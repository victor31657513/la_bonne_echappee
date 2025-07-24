import assert from 'node:assert';
import { updateDraftFactors } from '../src/logic/draftLogic.js';

function makeRider(dist, lane = 0) {
  return {
    trackDist: dist,
    laneOffset: lane,
    body: { linearDamping: 0 },
    draftFactor: 1
  };
}

function approx(val, expected, eps = 1e-2) {
  assert.ok(Math.abs(val - expected) < eps, `${val} !~= ${expected}`);
}

function testLinePositions() {
  const riders = [makeRider(10), makeRider(8), makeRider(6), makeRider(4), makeRider(2)];
  updateDraftFactors(riders, 0);
  approx(riders[0].draftFactor, 1.0);
  approx(riders[1].draftFactor, 1.19);
  approx(riders[4].draftFactor, 1.31);
}

function testDeepGroup() {
  const riders = [
    makeRider(12),
    makeRider(10),
    makeRider(8),
    makeRider(6),
    makeRider(4),
    makeRider(2),
    makeRider(0)
  ];
  updateDraftFactors(riders, 0);
  assert.ok(riders[6].draftFactor > 1.5);
  approx(riders[6].body.linearDamping, 0.01);
}

testLinePositions();
testDeepGroup();
console.log('Draft factor tests executed');
