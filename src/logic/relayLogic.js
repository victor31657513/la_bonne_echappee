import {
  RELAY_MIN_DIST,
  RELAY_MAX_DIST,
  ENERGY_THRESHOLD
} from '../utils/constants.js';
import { emit } from '../utils/eventBus.js';
import {
  BASE_RELAY_INTERVAL,
  RELAY_JOIN_GAP,
  PULL_OFF_TIME,
  PULL_OFFSET,
  RELAY_TARGET_GAP
} from '../utils/relayConstants.js';
import { aheadDistance } from '../utils/utils.js';

function setPhase(rider, phase) {
  if (rider.relayPhase !== phase) {
    const prev = rider.relayPhase;
    rider.relayPhase = phase;
    emit('phaseChange', { rider, phase, prev });
  } else {
    rider.relayPhase = phase;
  }
}


function relayStep(riders, state, dt) {
  const sorted = riders
    .filter(r => r.relayPhase !== 'fall_back')
    .sort((a, b) => b.trackDist - a.trackDist);

  let queue = [];
  for (let start = 0; start < sorted.length; start++) {
    const candidate = [sorted[start]];
    for (let j = start + 1; j < sorted.length; j++) {
      const prev = candidate[candidate.length - 1];
      const r = sorted[j];
      const dist = aheadDistance(r.trackDist, prev.trackDist);
      if (dist <= RELAY_JOIN_GAP) {
        candidate.push(r);
      } else {
        break;
      }
    }
    if (candidate.length >= 2) {
      queue = candidate;
      break;
    }
  }

  if (queue.length === 0) {
    return { queue: [] };
  }

  if (state.index >= queue.length) state.index = 0;
  let leader = queue[state.index];
  let attempts = 0;
  while (leader.energy < ENERGY_THRESHOLD && attempts < queue.length) {
    state.index = (state.index + 1) % queue.length;
    leader = queue[state.index];
    attempts += 1;
  }

  riders.forEach(r => {
    r.relayIntensity = 0;
    r.relayChasing = false;
    r.inRelayLine = false;
    r.relayLeader = false;
  });

  setPhase(leader, 'pull');
  leader.relayIntensity = leader.relaySetting;
  leader.inRelayLine = true;
  leader.relayLeader = true;

  for (let i = 1; i < queue.length; i++) {
    const prev = queue[i - 1];
    const r = queue[i];
    const dist = aheadDistance(r.trackDist, prev.trackDist);
    if (dist > RELAY_TARGET_GAP) r.relayChasing = true;
    r.inRelayLine = true;
  }

  riders.forEach(r => {
    if (!queue.includes(r) && r.relayPhase !== 'fall_back') r.relayChasing = true;
  });

  state.timer += dt;
  const interval = BASE_RELAY_INTERVAL / queue.length;
  if (state.timer >= interval) {
    state.timer = 0;
    setPhase(leader, 'fall_back');
    leader.relayTimer = 0;
    leader.inRelayLine = false;
    leader.relayLeader = false;
    leader.laneTarget = state.side * PULL_OFFSET;
    state.index = (state.index + 1) % queue.length;
    state.side *= -1;
  }

  riders.forEach(r => {
    if (r.relayPhase === 'fall_back') {
      r.relayTimer += dt;
      r.relayIntensity = r.relaySetting * Math.max(0, 1 - r.relayTimer / PULL_OFF_TIME);
      if (r.relayTimer >= PULL_OFF_TIME) {
        setPhase(r, 'line');
        r.relayChasing = true;
        r.laneTarget = 0;
        r.relayIntensity = 0;
      }
    } else if (r.relayPhase === 'pull') {
      r.relayIntensity = r.relaySetting;
    } else {
      r.relayIntensity = 0;
    }
    if (r.inRelayLine) {
      r.laneTarget = 0;
    } else if (r.relayPhase !== 'fall_back') {
      r.laneTarget = r.baseLaneOffset;
    }
  });

  return { queue, leader };
}

export { relayStep };
