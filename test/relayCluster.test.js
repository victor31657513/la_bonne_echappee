import assert from 'node:assert';
import { calculateCluster } from '../src/logic/relayCluster.js';

function approxEqual(a, b, eps = 1e-6) {
  assert.ok(Math.abs(a - b) <= eps, `${a} not close to ${b}`);
}

function testBasic() {
  const riders = [
    { trackDist: 0, inRelayLine: true },
    { trackDist: 4, inRelayLine: true },
    { trackDist: 10, inRelayLine: false }
  ];
  const res = calculateCluster(riders);
  assert.strictEqual(res.members.length, 2);
  approxEqual(res.avgDist, 2);
  approxEqual(res.stdDev, 2);
}

function testEmpty() {
  const riders = [{ trackDist: 5, inRelayLine: false }];
  const res = calculateCluster(riders);
  assert.strictEqual(res.members.length, 0);
  assert.strictEqual(res.avgDist, 0);
  assert.strictEqual(res.stdDev, 0);
}

testBasic();
testEmpty();
console.log('Tests executed');
