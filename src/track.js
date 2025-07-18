import { THREE, scene } from './setupScene.js';

const TRACK_LENGTH = 1000;
const ROAD_WIDTH = 10;
const BASE_RADIUS = TRACK_LENGTH / (2 * Math.PI);
const INNER_R = BASE_RADIUS - ROAD_WIDTH / 2;
const OUTER_R = BASE_RADIUS + ROAD_WIDTH / 2;
const TRACK_WRAP = TRACK_LENGTH;
const ROW_SPACING = 2;

const road = new THREE.Mesh(
  new THREE.RingGeometry(INNER_R, OUTER_R, 128),
  new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide })
);
road.rotation.x = -Math.PI / 2;
scene.add(road);

const trackPoints = [];
for (let a = 0; a <= Math.PI * 2; a += 0.1) {
  trackPoints.push(new THREE.Vector3(BASE_RADIUS * Math.cos(a), 0, BASE_RADIUS * Math.sin(a)));
}
const centerSpline = new THREE.CatmullRomCurve3(trackPoints, true);

// Central dashed line (ligne de dissuasion)
const centerLineGeometry = new THREE.BufferGeometry().setFromPoints(
  centerSpline.getPoints(500)
);
const centerLineMaterial = new THREE.LineDashedMaterial({
  color: 0xffffff,
  dashSize: 5,
  gapSize: 3
});
const centerLine = new THREE.Line(centerLineGeometry, centerLineMaterial);
centerLine.computeLineDistances();
scene.add(centerLine);

// Start/finish line across the road
const startLineGeom = new THREE.PlaneGeometry(ROAD_WIDTH, 0.2);
const startLineMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide
});
const startLine = new THREE.Mesh(startLineGeom, startLineMat);
startLine.rotation.x = -Math.PI / 2;
startLine.position.set(BASE_RADIUS, 0.01, 0);
scene.add(startLine);

function offsetSpline(spline, dist) {
  const pts = spline.getPoints(200).map((p, i, arr) => {
    const u = i / (arr.length - 1);
    const t = spline.getTangentAt(u);
    const normal = new THREE.Vector3(-t.z, 0, t.x).normalize();
    return p.clone().addScaledVector(normal, dist);
  });
  return new THREE.CatmullRomCurve3(pts, true);
}

const borderOffset = ROAD_WIDTH / 2 - 0.5;
const outerSpline = offsetSpline(centerSpline, borderOffset);
const innerSpline = offsetSpline(centerSpline, -borderOffset);

export {
  TRACK_LENGTH,
  ROAD_WIDTH,
  BASE_RADIUS,
  INNER_R,
  OUTER_R,
  TRACK_WRAP,
  ROW_SPACING,
  road,
  centerSpline,
  centerLine,
  startLine,
  outerSpline,
  innerSpline
};
