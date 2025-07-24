import assert from 'node:assert';
import { relayStep } from '../src/logic/relayLogic.js';

function cycleTest() {
  const riders = [
    {
      team: 0,
      trackDist: 100,
      relaySetting: 2,
      baseLaneOffset: 0,
      laneOffset: 0,
      laneTarget: 0,
      relayPhase: 'line',
      relayTimer: 0,
      relayTime: 0,
      energy: 100
    },
    {
      team: 0,
      trackDist: 98,
      relaySetting: 2,
      baseLaneOffset: 0,
      laneOffset: 0,
      laneTarget: 0,
      relayPhase: 'line',
      relayTimer: 0,
      relayTime: 0,
      energy: 100
    },
    {
      team: 0,
      trackDist: 96,
      relaySetting: 2,
      baseLaneOffset: 0,
      laneOffset: 0,
      laneTarget: 0,
      relayPhase: 'line',
      relayTimer: 0,
      relayTime: 0,
      energy: 100
    }
  ];
  const state = { index: 0, timer: 0, side: 1 };

  relayStep(riders, state, 1);
  const interval = 5 / riders.length;
  assert.strictEqual(riders[0].relayPhase, 'pull');
  assert.ok(Math.abs(riders[0].relayTime - interval) < 1e-6);

  relayStep(riders, state, interval - 1 + 0.01);
  assert.strictEqual(riders[0].relayPhase, 'fall_back');
  
  relayStep(riders, state, 0);
  assert.strictEqual(riders[2].relayPhase, 'pull');

  relayStep(riders, state, 2);
  assert.strictEqual(riders[0].relayPhase, 'line');
  assert.ok(riders[0].relayIntensity < 0.01);
}

cycleTest();
console.log('Relay cycle test executed');
