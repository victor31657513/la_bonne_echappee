import assert from 'node:assert';
import { breakaway } from '../src/logic/breakawayManager.js';
import { breakawayText } from '../src/ui/breakawayDisplay.js';

function testBreakawayText() {
  breakaway.members = [{ team: 0 }, { team: 1 }];
  breakaway.gap = 7.3;
  const txt = breakawayText();
  assert.ok(txt.includes('Team 1'));
  assert.ok(txt.includes('7.3'));

  breakaway.members = [];
  breakaway.gap = 0;
  assert.strictEqual(breakawayText(), '');
}

testBreakawayText();
console.log('UI display test executed');
