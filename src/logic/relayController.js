import { CANNON } from '../core/physicsWorld.js';
import { riders, teamRelayState } from '../entities/riders.js';
import { relayStep } from './relayLogic.js';
import { updateRelayCluster } from './relayCluster.js';
import { TRACK_WRAP } from '../entities/track.js';
import { aheadDistance } from '../utils/utils.js';
import { RELAY_MIN_DIST, RELAY_MAX_DIST } from '../utils/constants.js';
import {
  BASE_RELAY_INTERVAL,
  PULL_OFF_TIME,
  PULL_OFFSET,
  RELAY_TARGET_GAP
} from '../utils/relayConstants.js';
import { emit } from '../utils/eventBus.js';

const RELAY_CORRECTION_GAIN = 5;

function setPhase(rider, phase) {
  if (rider.relayPhase !== phase) {
    const prev = rider.relayPhase;
    rider.relayPhase = phase;
    emit('phaseChange', { rider, phase, prev });
  } else {
    rider.relayPhase = phase;
  }
}

function updateRelays(dt) {
  for (let t = 0; t < teamRelayState.length; t++) {
    const state = teamRelayState[t];
    const teamRiders = riders.filter(r => r.team === t);
    const relayRiders = teamRiders.filter(r => r.relaySetting > 0);
    if (relayRiders.length === 0) continue;

    const { queue } = relayStep(relayRiders, state, dt);

    for (let i = 1; i < queue.length; i++) {
      const prev = queue[i - 1];
      const r = queue[i];
      const dist = aheadDistance(r.trackDist, prev.trackDist);
      if (dist > RELAY_TARGET_GAP) r.relayChasing = true;

      const theta = ((r.trackDist % TRACK_WRAP) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      let diff = 0;
      if (dist > RELAY_MAX_DIST) diff = dist - RELAY_MAX_DIST;
      else if (dist < RELAY_MIN_DIST) diff = dist - RELAY_MIN_DIST;
      if (diff !== 0) {
        const force = forward.scale(diff * RELAY_CORRECTION_GAIN * r.body.mass);
        r.body.applyForce(force, r.body.position);
      }

      r.inRelayLine = true;
    }

    relayRiders.forEach(r => {
      if (!queue.includes(r)) r.relayChasing = true;
    });

    teamRiders.forEach(r => {
      if (
        !relayRiders.includes(r) &&
        r.relayPhase !== 'fall_back' &&
        queue.length > 0
      ) {
        r.relayChasing = true;
      }
    });

    state.timer += dt;
    const interval = BASE_RELAY_INTERVAL / queue.length;
    if (state.timer >= interval) {
      state.timer = 0;
      setPhase(queue[state.index], 'fall_back');
      queue[state.index].relayTimer = 0;
      queue[state.index].inRelayLine = false;
      queue[state.index].relayLeader = false;
      queue[state.index].laneTarget = state.side * PULL_OFFSET;
      state.index = (state.index + 1) % queue.length;
      state.side *= -1;
    }
  }

  riders.forEach(r => {
    if (r.relayPhase === 'fall_back') {
      r.relayTimer += dt;
      if (r.relayTimer >= PULL_OFF_TIME) {
        setPhase(r, 'line');
        r.relayChasing = true;
        r.laneTarget = 0;
      }
    }
    if (r.inRelayLine) {
      r.laneTarget = 0;
    } else if (r.relayPhase !== 'fall_back') {
      r.laneTarget = r.baseLaneOffset;
    }
  });

  updateRelayCluster(riders);
}

export { updateRelays };
