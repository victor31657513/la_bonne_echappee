import {
  BREAKAWAY_TRIGGER_GAP,
  BREAKAWAY_CAPTURE_GAP
} from '../utils/constants.js';
import { aheadDistance } from '../utils/utils.js';

const breakaway = {
  members: [],
  gap: 0,
  closingRate: 0
};

function updateBreakaway(riders) {
  const sorted = riders.slice().sort((a, b) => b.trackDist - a.trackDist);

  if (breakaway.members.length === 0) {
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = aheadDistance(sorted[i + 1].trackDist, sorted[i].trackDist);
      if (gap > BREAKAWAY_TRIGGER_GAP) {
        breakaway.members = sorted.slice(0, i + 1);
        breakaway.members.forEach(r => { r.inBreakaway = true; });
        sorted.slice(i + 1).forEach(r => { r.inBreakaway = false; });
        breakaway.gap = gap;
        return;
      }
    }
    breakaway.members = [];
    breakaway.gap = 0;
    riders.forEach(r => { r.inBreakaway = false; });
  } else {
    let lastIndex = -1;
    for (const m of breakaway.members) {
      const idx = sorted.indexOf(m);
      if (idx > lastIndex) lastIndex = idx;
    }
    if (lastIndex === -1) lastIndex = breakaway.members.length - 1;
    if (lastIndex >= sorted.length - 1) {
      breakaway.gap = 0;
      return;
    }
    const gap = aheadDistance(sorted[lastIndex + 1].trackDist, sorted[lastIndex].trackDist);
    if (gap < BREAKAWAY_CAPTURE_GAP) {
      breakaway.members.forEach(r => { r.inBreakaway = false; });
      breakaway.members = [];
      breakaway.gap = 0;
    } else {
      const newMembers = sorted.slice(0, lastIndex + 1);
      breakaway.members = newMembers;
      riders.forEach(r => { r.inBreakaway = newMembers.includes(r); });
      breakaway.gap = gap;
    }
  }

  const chasers = riders.filter(r => !r.inBreakaway && r.relayChasing);
  if (chasers.length > 0) {
    const avg = chasers.reduce((s, r) => s + (r.intensity || 50), 0) / chasers.length;
    breakaway.closingRate = Math.max(0, (avg - 50) / 50);
  } else {
    breakaway.closingRate = 0;
  }
}

export { breakaway, updateBreakaway };
