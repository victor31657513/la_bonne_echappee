import { breakaway } from '../logic/breakawayManager.js';

const banner = document.getElementById('breakaway-banner');

function updateBreakawayDisplay() {
  if (!banner) return;
  if (breakaway.members.length > 0) {
    banner.style.display = 'block';
    const labels = breakaway.members.map(r => `Team ${r.team + 1}`).join(', ');
    banner.textContent = `Breakaway: ${labels} - Gap ${breakaway.gap.toFixed(1)}`;
  } else {
    banner.style.display = 'none';
    banner.textContent = '';
  }
}

export { updateBreakawayDisplay };
