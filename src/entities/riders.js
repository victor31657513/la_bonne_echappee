// Initialise les coureurs et leurs corps physiques

import { THREE, scene } from '../core/setupScene.js';
import { RAPIER, world } from '../core/physicsWorld.js';
import { ROAD_WIDTH, TRACK_WRAP, TRACK_LENGTH, BASE_RADIUS, ROW_SPACING } from './track.js';
import { RIDER_WIDTH, MIN_LATERAL_GAP } from './riderConstants.js';


const NUM_TEAMS = 23,
  RIDERS_PER_TEAM = 8;
const teamColors = Array.from({ length: NUM_TEAMS }, (_, i) => {
  const c = new THREE.Color();
  c.setHSL(i / NUM_TEAMS, 0.8, 0.5);
  return c;
});
const riderGeom = new THREE.BoxGeometry(1.7, 1.5, 0.5);
// Dimensions du corps de collision pour les objets Cannon.js
// On inverse largeur/profondeur pour que les collisions latérales utilisent la face longue de la boîte
const RIDER_BOX_HALF = {
  // selon la direction de la piste
  x: riderGeom.parameters.depth / 2,
  y: riderGeom.parameters.height / 2,
  // demi-largeur latérale
  z: riderGeom.parameters.width / 2
};
const riders = [];
const teamRelayState = Array.from({ length: NUM_TEAMS }, () => ({
  index: 0,
  timer: 0,
  side: 1
}));

// Création des coureurs pour chaque équipe
for (let team = 0; team < NUM_TEAMS; team++) {
  const mat = new THREE.MeshLambertMaterial({ color: teamColors[team] });
  for (let i = 0; i < RIDERS_PER_TEAM; i++) {

    const spacing = RIDER_WIDTH + MIN_LATERAL_GAP;
    const ridersPerRow = Math.max(1, Math.floor(ROAD_WIDTH / spacing));
    const idx = team * RIDERS_PER_TEAM + i;
    const row = Math.floor(idx / ridersPerRow);
    const col = idx % ridersPerRow;
    // Introduit un léger décalage aléatoire pour éviter que les coureurs soient parfaitement alignés au départ
    const trackJitter = THREE.MathUtils.randFloatSpread(ROW_SPACING);
    const trackDist0 =
      (TRACK_LENGTH - row * ROW_SPACING + trackJitter + TRACK_WRAP) % TRACK_WRAP;

    const halfRider = RIDER_WIDTH / 2;
    const edgeGap = MIN_LATERAL_GAP / 2;
    const maxOff = ROAD_WIDTH / 2 - halfRider - edgeGap;
    const usableWidth = maxOff * 2;
    const rawOff =
      (ridersPerRow === 1 ? 0 : col / (ridersPerRow - 1) - 0.5) * usableWidth;
    const off = THREE.MathUtils.clamp(
      rawOff + THREE.MathUtils.randFloatSpread(0.3),
      -maxOff,
      maxOff
    );
    const angle0 = (trackDist0 / TRACK_LENGTH) * 2 * Math.PI;
    const x0 = (BASE_RADIUS + off) * Math.cos(angle0);
    const z0 = (BASE_RADIUS + off) * Math.sin(angle0);

    const mesh = new THREE.Mesh(riderGeom, mat);
    mesh.position.set(x0, 0, z0);
    mesh.rotation.y = angle0 + Math.PI / 2;
    const { x: qx, y: qy, z: qz, w: qw } = mesh.quaternion;
    scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation({ x: x0, y: 0, z: z0 })
      .setRotation({ x: qx, y: qy, z: qz, w: qw })
      .setLinearDamping(0.2)
      .setAngularDamping(0.2);
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      RIDER_BOX_HALF.x,
      RIDER_BOX_HALF.y,
      RIDER_BOX_HALF.z
    );
    world.createCollider(colliderDesc, body);

    riders.push({
      team,
      isLeader: i === 0,
      trackDist: trackDist0,
      lap: 0,
      prevDist: trackDist0,
      baseLaneOffset: off,
      laneOffset: off,
      laneTarget: off,
      speed: 0,
      draftFactor: 1,
      attackGauge: 100,
      isAttacking: false,
      relaySetting: 0,
      relayIntensity: 0,
      baseIntensity: 50,
      intensity: 50,
      mode: 'follower',
      energy: 100,
      relayChasing: false,
      relayLeader: false,
      inRelayLine: false,
      inBreakaway: false,
      relayPhase: 'line',
      relayTimer: 0,
      relayTime: 0,
      isRelayLeader: false,
      protectLeader: false,
      mesh,
      body    });
  }
}

export {
  riders,
  teamColors,
  riderGeom,
  teamRelayState,
  
};
