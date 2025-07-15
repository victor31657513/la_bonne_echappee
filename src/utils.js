export function closestIdx(cpos, pathPts) {
  let best = 0;
  let minD2 = Infinity;
  for (let i = 0; i < pathPts.length; i++) {
    const dx = cpos.x - pathPts[i].x;
    const dz = cpos.z - pathPts[i].z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD2) {
      minD2 = d2;
      best = i;
    }
  }
  return best;
}
