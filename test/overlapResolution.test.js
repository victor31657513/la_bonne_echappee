import assert from 'node:assert';
import {
  computeOverlapCommands,
  applyOverlapCommands
} from '../src/logic/overlapResolver.js';

function makeRider(x, z) {
  const body = {
    _pos: { x, y: 0, z },
    _vel: { x: 0, y: 0, z: 0 },
    get position() {
      return this._pos;
    },
    get velocity() {
      return this._vel;
    },
    translation() {
      return { x: this._pos.x, y: this._pos.y, z: this._pos.z };
    },
    linvel() {
      return { x: this._vel.x, y: this._vel.y, z: this._vel.z };
    },
    setLinvel(v) {
      this._vel.x = v.x;
      this._vel.y = v.y;
      this._vel.z = v.z;
    }
  };
  return { body, mode: 'follower' };
}

function testNoTeleport() {
  const r1 = makeRider(0, 0);
  const r2 = makeRider(0.5, 0); // closer than min distance
  const riders = [r1, r2];

  const cmds = computeOverlapCommands(riders);
  applyOverlapCommands(cmds);

  // positions should remain unchanged after resolution step
  assert.strictEqual(r1.body.position.x, 0);
  assert.strictEqual(r2.body.position.x, 0.5);
  // velocities should be adjusted to separate the riders
  assert.ok(r1.body.velocity.x < 0);
  assert.ok(r2.body.velocity.x > 0);
}

testNoTeleport();
console.log('Overlap resolution test executed');
