const BORDURE_LANE_GAP = 1.0;

function updateBordure(riders, windStrength = 0) {
  const STRONG_WIND = 0.7;
  riders.forEach(r => {
    r.bordureChasing = false;
    r.bordurePenalty = 0;
  });
  if (Math.abs(windStrength) < STRONG_WIND) return;
  const sorted = riders.slice().sort((a, b) => b.trackDist - a.trackDist);
  let group = 0;
  for (let i = 1; i < sorted.length; i++) {
    const ahead = sorted[i - 1];
    const r = sorted[i];
    if (Math.abs(ahead.laneOffset - r.laneOffset) > BORDURE_LANE_GAP) {
      group += 1;
    }
    if (group > 0) {
      r.bordureChasing = true;
      r.bordurePenalty = 0.2;
    }
  }
}

export { BORDURE_LANE_GAP, updateBordure };
