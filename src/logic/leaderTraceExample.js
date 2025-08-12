// Exemple autonome illustrant un leader suivi par plusieurs boîtes
// Les positions récentes du leader sont stockées dans un buffer circulaire
// Chaque suiveur vise une ancienne position du leader pour former une file indienne

import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

// Initialise Rapier
await RAPIER.init();

// Paramètres principaux
const NUM_RUNNERS = 5; // leader compris
const TRACE_SIZE = 200; // nombre maximal de points mémorisés
const STEP_BACK = 5; // écart entre deux coureurs en indices de buffer

// Scène Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Monde Rapier
const world = new RAPIER.World({ gravity: { x: 0, y: 0, z: 0 } });

// Matériel simple pour tous les coureurs
const boxGeo = new THREE.BoxGeometry(1, 1, 2);
const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });

// Corps physiques et entités Three.js
const runners = [];
for (let i = 0; i < NUM_RUNNERS; i++) {
  const mesh = new THREE.Mesh(boxGeo, material);
  scene.add(mesh);
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(-i * 2, 0, 0);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 1);
  world.createCollider(colliderDesc, body);
  runners.push({ mesh, body });
}

// Buffer circulaire des positions du leader
const leaderTrace = new Array(TRACE_SIZE).fill(new THREE.Vector3());
let traceIndex = 0;

function updateTrace(pos) {
  leaderTrace[traceIndex] = pos.clone();
  traceIndex = (traceIndex + 1) % TRACE_SIZE;
}

function getTrace(i) {
  return leaderTrace[(traceIndex - i + TRACE_SIZE) % TRACE_SIZE];
}

// Animation principale
function animate() {
  requestAnimationFrame(animate);
  world.step();

  // Le leader avance simplement vers +X
  const leader = runners[0];
  leader.body.setLinvel({ x: 2, y: 0, z: 0 }, true);
  updateTrace(leader.body.translation());

  // Chaque suiveur vise une ancienne position du leader
  for (let i = 1; i < runners.length; i++) {
    const follower = runners[i];
    const target = getTrace(i * STEP_BACK);
    const pos = follower.body.translation();
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;

    // Force seulement dans la direction longitudinale (ici l'axe X)
    const vel = follower.body.linvel();
    const forceX = dx * 5 - vel.x;
    follower.body.setLinvel(
      { x: vel.x + forceX * world.integrationParameters.dt, y: 0, z: vel.z },
      true
    );
    follower.body.setTranslation({ x: pos.x, y: 0, z: pos.z + dz * 0.2 }, true);
  }

  // Synchronisation Three.js
  runners.forEach(r => {
    const p = r.body.translation();
    r.mesh.position.set(p.x, p.y, p.z);
  });

  camera.position.set(0, 10, 15);
  camera.lookAt(leader.mesh.position);
  renderer.render(scene, camera);
}

animate();

export { runners, leaderTrace };
