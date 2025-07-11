import * as THREE from 'three';
// Use a local copy of togeojson to avoid CDN issues
import { gpx } from './togeojson.esm.js';

const R = 6371000;
const RAD = Math.PI / 180;

function smoothPoints(points, iterations = 1) {
  let result = points;
  for (let k = 0; k < iterations; k++) {
    const smoothed = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];
      const q = p0
        .clone()
        .multiplyScalar(0.75)
        .add(p1.clone().multiplyScalar(0.25));
      const r = p0
        .clone()
        .multiplyScalar(0.25)
        .add(p1.clone().multiplyScalar(0.75));
      smoothed.push(q, r);
    }
    smoothed.push(result[result.length - 1]);
    result = smoothed;
  }
  return result;
}

function resampleCatmullRom(points, subdivisions = 5) {
  const curve = new THREE.CatmullRomCurve3(points);
  const totalSegments = (points.length - 1) * subdivisions;
  const resampled = [];
  for (let i = 0; i <= totalSegments; i++) {
    const t = i / totalSegments;
    resampled.push(curve.getPoint(t));
  }
  return resampled;
}

export async function curve3D(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load GPX \"${url}\": ${res.status} ${res.statusText}`);
  }
  let geojson;
  try {
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    geojson = gpx(xml);
  } catch (err) {
    throw new Error(`Malformed GPX data: ${err.message}`);
  }
  const coords = geojson.features[0].geometry.coordinates;
  const baseLat = coords[0][1];
  const baseLon = coords[0][0];

  const points = coords.map(([lon, lat, ele]) => {
    const x = (lon - baseLon) * RAD * R * Math.cos(baseLat * RAD);
    const z = (lat - baseLat) * RAD * R;
    const y = ele || 0;
    return new THREE.Vector3(x, y, z);
  });

  const smooth = smoothPoints(points, 2);
  const resampled = resampleCatmullRom(smooth, 5);

  return new THREE.CatmullRomCurve3(resampled);
}
