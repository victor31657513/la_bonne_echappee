import assert from 'node:assert';
import { dashAngle } from '../src/utils/utils.js';

function orientationTest() {
  assert.strictEqual(dashAngle(0, 1), 0);
  assert.ok(Math.abs(dashAngle(1, 0) - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(dashAngle(0, -1) - Math.PI) < 1e-6);
  assert.ok(Math.abs(dashAngle(-1, 0) + Math.PI / 2) < 1e-6);
}

orientationTest();
console.log('Dash orientation test executed');
