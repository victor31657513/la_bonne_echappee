import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';
// Load togeojson directly from a CDN
import { gpx } from 'https://cdn.jsdelivr.net/npm/togeojson@0.16.0/dist/togeojson.esm.js';

const R = 6371000;
const RAD = Math.PI / 180;

export async function curve3D(url) {
  const res = await fetch(url);
  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  const geojson = gpx(xml);
  const coords = geojson.features[0].geometry.coordinates;
  const baseLat = coords[0][1];
  const baseLon = coords[0][0];

  const points = coords.map(([lon, lat, ele]) => {
    const x = (lon - baseLon) * RAD * R * Math.cos(baseLat * RAD);
    const z = (lat - baseLat) * RAD * R;
    const y = ele || 0;
    return new THREE.Vector3(x, y, z);
  });

  return new THREE.CatmullRomCurve3(points);
}
