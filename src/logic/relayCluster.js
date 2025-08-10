// Track riders currently in the relay cluster and compute stats

const relayCluster = {
  avgDist: 0,
  stdDev: 0,
  members: []
};

function calculateCluster(riderList) {
  const cluster = riderList.filter(r => r.inRelayLine);
  if (cluster.length === 0) {
    return { members: [], avgDist: 0, stdDev: 0 };
  }
  const distances = cluster.map(r => r.trackDist);
  const avg = distances.reduce((s, d) => s + d, 0) / cluster.length;
  const variance =
    distances.reduce((s, d) => s + (d - avg) ** 2, 0) / cluster.length;
  return { members: cluster, avgDist: avg, stdDev: Math.sqrt(variance) };
}

function updateRelayCluster(riderList) {
  const res = calculateCluster(riderList);
  relayCluster.avgDist = res.avgDist;
  relayCluster.stdDev = res.stdDev;
  relayCluster.members = res.members;
  riderList.forEach(r => {
    r.inRelayCluster = relayCluster.members.includes(r);
  });
}

export { relayCluster, updateRelayCluster, calculateCluster };
