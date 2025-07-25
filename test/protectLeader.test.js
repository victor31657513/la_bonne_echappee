import assert from 'node:assert';
import { relayStep } from '../src/logic/relayLogic.js';

function protectLeaderTest() {
  const riders = [
    {
      team: 0,
      isLeader: true,
      relaySetting: 3,
      mode: 'relay',
      trackDist: 100,
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
      protectLeader: true,
      relaySetting: 3,
      mode: 'relay',
      trackDist: 99,
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
      relaySetting: 3,
      mode: 'relay',
      trackDist: 98,
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
  const res = relayStep(riders, state, 0);
  assert.notStrictEqual(res.leader, riders[0]);
  assert.ok(res.leader === riders[1] || res.leader === riders[2]);
}

protectLeaderTest();
console.log('Protect leader test executed');
