import { TRACK_WRAP } from './track.js';

function polarToDist(x, z) {
  const a = Math.atan2(z, x);
  return ((a < 0 ? a + 2 * Math.PI : a) / (2 * Math.PI)) * TRACK_WRAP;
}

export { polarToDist };
