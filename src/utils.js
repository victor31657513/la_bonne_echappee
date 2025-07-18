import { TRACK_WRAP } from './track.js';

function polarToDist(x, z) {
  const a = Math.atan2(z, x);
  return ((a < 0 ? a + 2 * Math.PI : a) / (2 * Math.PI)) * TRACK_WRAP;
}

function aheadDistance(from, to) {
  let diff = (to - from) % TRACK_WRAP;
  if (diff < 0) diff += TRACK_WRAP;
  return diff;
}

function wrapDistance(a, b) {
  let diff = Math.abs(b - a) % TRACK_WRAP;
  if (diff > TRACK_WRAP / 2) diff = TRACK_WRAP - diff;
  return diff;
}

export { polarToDist, aheadDistance, wrapDistance };
