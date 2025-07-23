// Exemple autonome illustrant un leader suivi par plusieurs boîtes
// Les positions récentes du leader sont stockées dans un buffer circulaire
// Chaque suiveur vise une ancienne position du leader pour former une file indienne

import * as THREE from 'https://unpkg.com/three@0.153.0/build/three.module.js?module';
import * as CANNON from 'https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js?module';

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

// Monde Cannon.js
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.NaiveBroadphase();

// Matériel simple pour tous les coureurs
const boxGeo = new THREE.BoxGeometry(1, 1, 2);
const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });

// Corps physiques et entités Three.js
const runners = [];
for (let i = 0; i < NUM_RUNNERS; i++) {
  const mesh = new THREE.Mesh(boxGeo, material);
  scene.add(mesh);
  const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 1)) });
  body.position.set(-i * 2, 0, 0);
  world.addBody(body);
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
  world.step(1 / 60);

  // Le leader avance simplement vers +X
  const leader = runners[0];
  leader.body.velocity.x = 2;
  updateTrace(leader.body.position);

  // Chaque suiveur vise une ancienne position du leader
  for (let i = 1; i < runners.length; i++) {
    const follower = runners[i];
    const target = getTrace(i * STEP_BACK);
    const dx = target.x - follower.body.position.x;
    const dz = target.z - follower.body.position.z;

    // Force seulement dans la direction longitudinale (ici l'axe X)
    const forceX = dx * 5 - follower.body.velocity.x;
    follower.body.velocity.x += forceX * world.dt;
    follower.body.position.z += dz * 0.2; // correction douce de l'écart latéral
  }

  // Synchronisation Three.js
  runners.forEach(r => {
    r.mesh.position.copy(r.body.position);
  });

  camera.position.set(0, 10, 15);
  camera.lookAt(leader.mesh.position);
  renderer.render(scene, camera);
}

animate();

export { runners, leaderTrace };
