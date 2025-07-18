// Initialise les coureurs et leur logique de regroupement

import { THREE, scene } from './setupScene.js';
import { CANNON, world } from './physicsWorld.js';
import { System as BoidSystem, Boid, behaviors } from 'https://esm.sh/bird-oid@0.2.1';
import { ROAD_WIDTH, TRACK_WRAP, TRACK_LENGTH, BASE_RADIUS, ROW_SPACING } from './track.js';

const boidBehaviors = [
  { fn: behaviors.separate, options: { distance: 5, scale: 2.0 } },
  { fn: behaviors.align, options: { distance: 8, scale: 0.5 } },
  { fn: behaviors.cohere, options: { distance: 12, scale: 1.0 } }
];
const boidSystem = new BoidSystem({ maxSpeed: 1.0, maxForce: 0.4, behaviors: boidBehaviors });

const NUM_TEAMS = 23,
  RIDERS_PER_TEAM = 8;
const teamColors = Array.from({ length: NUM_TEAMS }, (_, i) => {
  const c = new THREE.Color();
  c.setHSL(i / NUM_TEAMS, 0.8, 0.5);
  return c;
});
const riderGeom = new THREE.BoxGeometry(1.7, 1.5, 0.5);

const RIDER_WIDTH = 1.7; // match geometry width
// Reduced gap to fit more riders across the road at base speed
const MIN_LATERAL_GAP = 0.3;
// Collision body dimensions for Cannon.js bodies
const RIDER_BOX_HALF = {
  x: riderGeom.parameters.width / 2,
  y: riderGeom.parameters.height / 2,
  z: riderGeom.parameters.depth / 2
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
    const trackDist0 = (TRACK_LENGTH - row * ROW_SPACING + TRACK_WRAP) % TRACK_WRAP;
    const usableWidth = ROAD_WIDTH - RIDER_WIDTH;
    const rawOff = (ridersPerRow === 1 ? 0 : col / (ridersPerRow - 1) - 0.5) * usableWidth;
    const halfRider = RIDER_WIDTH / 2;
    const maxOff = ROAD_WIDTH / 2 - halfRider;
    const off = THREE.MathUtils.clamp(rawOff, -maxOff, maxOff);
    const angle0 = (trackDist0 / TRACK_LENGTH) * 2 * Math.PI;
    const x0 = (BASE_RADIUS + off) * Math.cos(angle0);
    const z0 = (BASE_RADIUS + off) * Math.sin(angle0);

    const mesh = new THREE.Mesh(riderGeom, mat);
    mesh.position.set(x0, 0, z0);
    mesh.rotation.y = angle0 + Math.PI / 2;
    scene.add(mesh);

    const body = new CANNON.Body({ mass: 1 });
    const halfExtents = new CANNON.Vec3(
      RIDER_BOX_HALF.x,
      RIDER_BOX_HALF.y,
      RIDER_BOX_HALF.z
    );
    body.addShape(new CANNON.Box(halfExtents));
    body.position.set(x0, 0, z0);
    body.linearDamping = 0.2;
    body.angularDamping = 0.2;
    world.addBody(body);

    const boid = new Boid(boidBehaviors);
    boid.position = [x0, z0];
    boid.velocity = [0, 0];
    boidSystem.addBoid(boid);

    riders.push({
      team,
      isLeader: i === 0,
      trackDist: trackDist0,
      lap: 0,
      prevDist: trackDist0,
      laneOffset: off,
      laneTarget: off,
      speed: 0,
      energy: 100,
      relaySetting: 0,
      relayIntensity: 0,
      intensity: 50,
      pullingOff: false,
      pullTimer: 0,
      protectLeader: false,
      effortMode: 1,
      mesh,
      body,
      boid
    });
  }
}

export {
  boidSystem,
  riders,
  teamColors,
  riderGeom,
  teamRelayState,
  RIDER_WIDTH,
  MIN_LATERAL_GAP
};
