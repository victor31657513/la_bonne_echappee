import { aheadDistance } from '../utils/utils.js';

function updateDraftFactors(riders, windDirection = 1) {
  riders.forEach(r => {
    const ahead = [];
    riders.forEach(o => {
      if (o === r) return;
      const dist = aheadDistance(r.trackDist, o.trackDist);
      if (dist > 0 && dist <= 12 && Math.abs(o.laneOffset - r.laneOffset) < 1.5) {
        ahead.push(dist);
      }
    });
    ahead.sort((a, b) => a - b);
    const position = ahead.length + 1;
    let reduction = 0;
    if (position >= 2 && position <= 5) {
      reduction = 0.3 + ((position - 2) * (0.2 / 3));
    } else if (position >= 6) {
      reduction = 0.9 + (position >= 7 ? 0.05 : 0);
    }
    let drag = 1 - reduction;

    const needLeft = windDirection === 1;
    const sheltered = riders.some(o => {
      if (o === r) return false;
      const dist = aheadDistance(r.trackDist, o.trackDist);
      const lateral = o.laneOffset - r.laneOffset;
      if (needLeft) {
        return dist >= 0 && dist < 2 && lateral < 0 && Math.abs(lateral) < 2;
      }
      if (windDirection === -1) {
        return dist >= 0 && dist < 2 && lateral > 0 && Math.abs(lateral) < 2;
      }
      return false;
    });
    if (!sheltered && windDirection !== 0) drag = Math.min(1, drag + 0.2);

    r.body.linearDamping = 0.2 * drag;
    r.draftFactor = 1 + 0.625 * (1 - drag);
  });
}

export { updateDraftFactors };
