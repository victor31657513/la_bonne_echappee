import { breakaway } from '../logic/breakawayManager.js';

function breakawayText() {
  if (breakaway.members.length > 0) {
    const labels = breakaway.members.map(r => `Team ${r.team + 1}`).join(', ');
    return `Breakaway: ${labels} - Gap ${breakaway.gap.toFixed(1)}`;
  }
  return '';
}

export { breakawayText };
