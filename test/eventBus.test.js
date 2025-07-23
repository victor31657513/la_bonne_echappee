import assert from 'node:assert';
import { on, off, emit } from '../src/eventBus.js';

function busTest() {
  let called = 0;
  function listener(data) {
    called += data;
  }
  on('inc', listener);
  emit('inc', 1);
  emit('inc', 2);
  assert.strictEqual(called, 3);
  off('inc', listener);
  emit('inc', 1);
  assert.strictEqual(called, 3);
}

busTest();
console.log('EventBus test executed');
