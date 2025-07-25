import { RAPIER } from '../core/physicsWorld.js';
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
      const forward = new RAPIER.Vector3(-Math.sin(theta), 0, Math.cos(theta));
      let diff = 0;
      if (dist > RELAY_MAX_DIST) diff = dist - RELAY_MAX_DIST;
      else if (dist < RELAY_MIN_DIST) diff = dist - RELAY_MIN_DIST;
      if (diff !== 0) {
        const force = new RAPIER.Vector3(
          forward.x * diff * RELAY_CORRECTION_GAIN * r.body.mass(),
          0,
          forward.z * diff * RELAY_CORRECTION_GAIN * r.body.mass()
        );
        r.body.addForce(force, true);
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
  }

  riders.forEach(r => {
    if (r.inRelayLine) {
      r.laneTarget = 0;
    } else if (r.relayPhase !== 'fall_back') {
      r.laneTarget = r.baseLaneOffset;
    }
  });

  updateRelayCluster(riders);
}

export { updateRelays };
