import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { breakaway } from '../src/logic/breakawayManager.js';

const dom = new JSDOM('<div id="breakaway-banner"></div>');
global.window = dom.window;
global.document = dom.window.document;

const { updateBreakawayDisplay } = await import('../src/ui/breakawayDisplay.js');

function testBanner() {
  breakaway.members = [{ team: 0 }, { team: 1 }];
  breakaway.gap = 7.3;
  updateBreakawayDisplay();
  const banner = document.getElementById('breakaway-banner');
  assert.strictEqual(banner.style.display, 'block');
  assert.ok(banner.textContent.includes('Team 1'));
  assert.ok(banner.textContent.includes('7.3'));

  breakaway.members = [];
  breakaway.gap = 0;
  updateBreakawayDisplay();
  assert.strictEqual(banner.style.display, 'none');
}

testBanner();
console.log('UI display test executed');
