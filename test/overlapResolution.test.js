import assert from 'node:assert';
import { resolveOverlaps } from '../src/overlapResolver.js';

function makeRider(x, z) {
  return {
    body: {
      position: { x, z },
      velocity: { x: 0, z: 0 }
    }
  };
}

function testNoTeleport() {
  const r1 = makeRider(0, 0);
  const r2 = makeRider(0.5, 0); // closer than min distance
  const riders = [r1, r2];

  resolveOverlaps(riders);

  // positions should remain unchanged after resolution step
  assert.strictEqual(r1.body.position.x, 0);
  assert.strictEqual(r2.body.position.x, 0.5);
  // velocities should be adjusted to separate the riders
  assert.ok(r1.body.velocity.x < 0);
  assert.ok(r2.body.velocity.x > 0);
}

testNoTeleport();
console.log('Overlap resolution test executed');
