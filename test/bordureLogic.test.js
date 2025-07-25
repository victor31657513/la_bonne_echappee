import assert from 'node:assert';
import { updateBordure, BORDURE_LANE_GAP } from '../src/logic/bordureLogic.js';

function makeRider(dist, lane) {
  return {
    trackDist: dist,
    laneOffset: lane,
    bordureChasing: false,
    bordurePenalty: 0
  };
}

function testChasingGroup() {
  const riders = [
    makeRider(10, 0),
    makeRider(8, 0.5),
    makeRider(6, BORDURE_LANE_GAP + 0.6),
    makeRider(4, BORDURE_LANE_GAP + 0.9)
  ];
  updateBordure(riders, 1);
  assert.ok(!riders[0].bordureChasing);
  assert.ok(!riders[1].bordureChasing);
  assert.ok(riders[2].bordureChasing);
  assert.ok(riders[3].bordureChasing);
  assert.strictEqual(riders[2].bordurePenalty, 0.2);
}

function testWeakWind() {
  const riders = [makeRider(10, 0), makeRider(8, 2)];
  updateBordure(riders, 0.2);
  assert.ok(!riders[1].bordureChasing);
}

testChasingGroup();
testWeakWind();
console.log('Bordure logic tests executed');
