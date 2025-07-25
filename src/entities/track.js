// Définit la géométrie de la piste et les courbes auxiliaires

import { THREE, scene } from '../core/setupScene.js';
import { dashAngle } from '../utils/utils.js';

const TRACK_LENGTH = 1000;
// Élargit légèrement la route pour que six coureurs puissent passer côte à côte
const ROAD_WIDTH = 12;
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
const STEP_ANGLE = 0.1;
// On exclut l'angle 2π pour ne pas dupliquer le premier point. Un doublon
// avait autrefois créé un virage brusque qui faisait ralentir les coureurs à
// chaque passage sur la ligne de départ/arrivée.
for (let a = 0; a < Math.PI * 2; a += STEP_ANGLE) {
  trackPoints.push(
    new THREE.Vector3(BASE_RADIUS * Math.cos(a), 0, BASE_RADIUS * Math.sin(a))
  );
}
const centerSpline = new THREE.CatmullRomCurve3(trackPoints, true);

// Ligne centrale en pointillés (ligne de dissuasion)
const DASH_LENGTH = 5;
const GAP_LENGTH = 3;
const DASH_WIDTH = 0.2;

const centerDashes = new THREE.Group();
const dashGeom = new THREE.PlaneGeometry(DASH_WIDTH, DASH_LENGTH);
const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
dashGeom.rotateX(-Math.PI / 2);

const centerLength = centerSpline.getLength();
for (let dist = 0; dist < centerLength; dist += DASH_LENGTH + GAP_LENGTH) {
  const u = (dist + DASH_LENGTH / 2) / centerLength;
  const pos = centerSpline.getPointAt(u % 1);
  const tangent = centerSpline.getTangentAt(u % 1);
  const angle = dashAngle(tangent.x, tangent.z);
  const dash = new THREE.Mesh(dashGeom, dashMat);
  dash.rotation.y = angle;
  dash.position.copy(pos);
  dash.position.y = 0.01;
  centerDashes.add(dash);
}
scene.add(centerDashes);

// Ligne de départ/arrivée traversant la chaussée
const startLineGeom = new THREE.PlaneGeometry(ROAD_WIDTH, 0.2);
const startLineMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide
});
const startLine = new THREE.Mesh(startLineGeom, startLineMat);
startLine.rotation.x = -Math.PI / 2;
startLine.position.set(BASE_RADIUS, 0.01, 0);
scene.add(startLine);

/**
 * Crée une courbe décalée par rapport à la spline centrale.
 *
 * @param {THREE.Curve} spline Spline de référence.
 * @param {number} dist Distance de décalage latéral.
 * @returns {THREE.CatmullRomCurve3} Nouvelle spline décalée.
 */
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
  centerDashes,
  startLine,
  outerSpline,
  innerSpline
};
