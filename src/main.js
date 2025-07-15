// Import modules directement depuis des CDN afin de pouvoir ouvrir
// `index.html` sans passer par Vite.
import * as THREE from "https://unpkg.com/three@0.178.0/build/three.module.js";
import * as YUKA from "https://unpkg.com/yuka@0.7.8/build/yuka.module.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";

import { closestIdx } from "./utils.js";
// — Scène & Caméra
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333);
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 25, -40);

// — Lumières séparées
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);
const ambLight = new THREE.AmbientLight(0x222222);
scene.add(ambLight);

// — Route plate circulaire
const R = 20, segments = 200, roadWidth = 6;
const pathPts = [];
for (let i = 0; i <= segments; i++) {
const θ = (i / segments) * Math.PI * 2;
pathPts.push(new THREE.Vector3(R * Math.cos(θ), 0, R * Math.sin(θ)));
}

// **Créer la courbe AVANT de l’utiliser**
const curve = new THREE.CatmullRomCurve3(pathPts, true);

// Ruban plat
const posArr = [], idxArr = [];
for (let i = 0; i < pathPts.length; i++) {
const p = pathPts[i];
const next = pathPts[(i + 1) % pathPts.length];
const t = next.clone().sub(p).normalize();
const right = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
const pL = p.clone().addScaledVector(right, roadWidth / 2);
const pR = p.clone().addScaledVector(right, -roadWidth / 2);
posArr.push(pL.x, pL.y, pL.z, pR.x, pR.y, pR.z);
if (i < pathPts.length - 1) {
const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
idxArr.push(a, b, c, b, d, c);
}
}
const roadGeo = new THREE.BufferGeometry();
roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
roadGeo.setIndex(idxArr);
roadGeo.computeVertexNormals();
scene.add(new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({
color: 0x888888, side: THREE.DoubleSide
})));
scene.add(new THREE.LineLoop(
new THREE.BufferGeometry().setFromPoints(pathPts),
new THREE.LineBasicMaterial({color: 0xffffff})
));

// — Physique cannon-es
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 10;

// — YUKA + instancedMesh
const entityManager = new YUKA.EntityManager();
const yukaPath = new YUKA.Path();
pathPts.forEach(p => yukaPath.add(new YUKA.Vector3(p.x, p.y, p.z)));
yukaPath.loop = true;

const N = 30;
const ridersPerRow = Math.floor(roadWidth / 0.7);
const rowSpacing = 2;
const vehicles = [];
const bodies = [];

const riderGeo = new THREE.BoxGeometry(0.6, 1.2, 2);
const riderMat = new THREE.MeshLambertMaterial({color: 0xff2222, emissive: 0x220000});
const inst = new THREE.InstancedMesh(riderGeo, riderMat, N);
inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(inst);

// Création des agents
for (let i = 0; i < N; i++) {
// 1) calcul de u le long de la courbe (point de départ commun)
const u = 0;
// 2) tangent et normale à la route au point u
const base = curve.getPointAt(u);
const tangent = curve.getTangentAt(u).normalize();
const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

// 3) ligne et colonne pour répartir le peloton
const row = Math.floor(i / ridersPerRow);
const col = i % ridersPerRow;
const maxLat = roadWidth / 2 - 0.6 / 2;               // demi-largeur route moins demi-largeur du vélo
const sideOffset = (col / (ridersPerRow - 1)) * 2 * maxLat - maxLat;
const forwardOffset = row * rowSpacing;

// 4) position initiale avec offsets latéral et longitudinal
const v = new YUKA.Vehicle();
v.maxSpeed = 6; v.maxForce = 8;
v.position.set(
base.x - tangent.x * forwardOffset + normal.x * sideOffset,
0,
base.z - tangent.z * forwardOffset + normal.z * sideOffset
);

// 5) comportements YUKA
v.steering.add(new YUKA.FollowPathBehavior(yukaPath, 1));
v.steering.add(new YUKA.SeparationBehavior(vehicles, 2));
v.steering.add(new YUKA.CohesionBehavior(vehicles, 3));
entityManager.add(v);
vehicles.push(v);

// 6) corps Cannon correspondant
const box = new CANNON.Box(new CANNON.Vec3(0.3, 0.6, 1));
const b = new CANNON.Body({mass: 1});
b.addShape(box);
b.position.set(v.position.x, v.position.y, v.position.z);
b.fixedRotation = true;
b.updateMassProperties();
world.addBody(b);
bodies.push(b);
}

// Trouver l’indice le plus proche (2D)

// — Animation
const clock = new THREE.Clock();
const hud = document.getElementById('speed');
const dummy = new THREE.Object3D();

function animate() {
const dt = clock.getDelta();
entityManager.update(dt);

// 1) Injecter vélocité YUKA → Cannon
vehicles.forEach((v, i) => {
bodies[i].velocity.set(v.velocity.x, 0, v.velocity.z);
});

// 2) Step physique
world.step(dt);

// 3) Clamp latéral et orientation le long du tangent
vehicles.forEach((v, i) => {
const b = bodies[i];
// 3a) trouver tangent
const idx = closestIdx(b.position, pathPts);
const curr = pathPts[idx];
const next = pathPts[(idx + 1) % pathPts.length];
const tan = next.clone().sub(curr).normalize();
const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();

// 3b) calculer projeté longitudinal + latéral
const rel = new THREE.Vector3().subVectors(b.position, curr);
const longDist = rel.dot(tan);
let latDist = rel.dot(right);
const halfBox = 0.6 / 2 + 0.01;
const maxLat = roadWidth / 2 - halfBox;
if (latDist > maxLat) latDist = maxLat;
if (latDist < -maxLat) latDist = -maxLat;

// 3c) nouvelle position confinée
const newPos = curr.clone()
.add(tan.clone().multiplyScalar(longDist))
.add(right.clone().multiplyScalar(latDist));
b.position.set(newPos.x, 0, newPos.z);

  // 3d) vitesse uniquement le long du tangent avec effet d'aspiration
  const speed = v.velocity.length();
  let boost = 1;
  for (let j = 0; j < bodies.length; j++) {
    if (j === i) continue;
    const other = bodies[j];
    const delta = new THREE.Vector3().subVectors(other.position, b.position);
    const forward = delta.dot(tan);
    const lateral = Math.abs(delta.dot(right));
    if (forward > 0 && forward < 3 && lateral < 1) {
      boost = 1.2 - (forward / 15); // boost diminue avec la distance
      break;
    }
  }
  const finalSpeed = speed * boost;
  b.velocity.set(tan.x * finalSpeed, 0, tan.z * finalSpeed);

// 3e) synchroniser Yuka + mesh
v.position.copy(b.position);
const heading = Math.atan2(tan.x, tan.z);
dummy.position.copy(b.position);
dummy.rotation.set(0, heading, 0);
dummy.updateMatrix();
inst.setMatrixAt(i, dummy.matrix);
});
inst.instanceMatrix.needsUpdate = true;

// HUD
hud.textContent = (vehicles[0].velocity.length() * 3.6).toFixed(1);

// Caméra
const L = bodies[0].position;
camera.position.lerp(new THREE.Vector3(L.x, 25, L.z - 40), 0.05);
camera.lookAt(L.x, L.y, L.z);

renderer.render(scene, camera);
requestAnimationFrame(animate);
}
animate();

// — Resize
window.addEventListener('resize', () => {
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(innerWidth, innerHeight);
});
