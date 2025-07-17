// pelotonRelay.js
// -------------------------------------
// Adaptation for La Bonne Échappée – riders now seek the "rope line" (meilleure trajectoire)
// throughout the race so the peloton behaves like a rotating relay.
// Key changes are flagged with "// ★ MOD" comments.
// -------------------------------------

// Imports
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { System as BoidSystem, Boid, behaviors } from 'https://esm.sh/bird-oid@0.2.1';

//// 1. Three.js scene, camera, renderer ////
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('vis').appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

// Selection variables (initialized after riderGeom)
let selectedIndex = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Simulation control
let started = false; // peloton start flag

// Create start button
(function(){
  const startBtn = document.createElement('button');
  startBtn.textContent = 'Démarrer la simulation';
  startBtn.style.position = 'absolute';
  startBtn.style.bottom = '10px';
  startBtn.style.right = '10px';
  startBtn.style.padding = '8px 12px';
  startBtn.style.zIndex = 100;
  document.body.appendChild(startBtn);
  startBtn.addEventListener('click', () => {
    started = true;
    // Initialize physics and mesh positions and velocities for cruise
    riders.forEach(r => {
      // Reset any previous boost
      r.currentBoost = 0;
      // Compute tangent direction
      const theta = (polarToDist(r.body.position.x, r.body.position.z) / TRACK_WRAP) * 2 * Math.PI;
      const vx = -Math.sin(theta) * BASE_SPEED;
      const vz =  Math.cos(theta) * BASE_SPEED;
      // Set physics body velocity
      r.body.velocity.set(vx, 0, vz);
      // Sync mesh to body
      r.mesh.position.copy(r.body.position);
      // Update trackDist
      r.trackDist = polarToDist(r.body.position.x, r.body.position.z);
    });
    startBtn.disabled = true;
  });
})();

// (selectionMarker will be created after riderGeom is defined)

// Handle click to select rider
renderer.domElement.addEventListener('click', event => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(riders.map(r => r.mesh));
  if (intersects.length) {
    selectedIndex = riders.findIndex(r => r.mesh === intersects[0].object);
    updateSelectionHelper();
  }
});

// Handle arrow keys to change selection
window.addEventListener('keydown', event => {
  if (selectedIndex === null || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
  if (event.key === 'ArrowUp') selectedIndex = (selectedIndex - 1 + riders.length) % riders.length;
  if (event.key === 'ArrowDown') selectedIndex = (selectedIndex + 1) % riders.length;
  updateSelectionHelper();
});

function updateSelectionHelper() {
  if (selectedIndex !== null) {
    const rider = riders[selectedIndex];
    // Position and orient the marker to match the rider
    selectionMarker.position.copy(rider.mesh.position);
    selectionMarker.quaternion.copy(rider.mesh.quaternion);
    selectionMarker.visible = true;
  } else {
    selectionMarker.visible = false;
  }
}

// Vectors for updates
const forwardVec = new THREE.Vector3();
const lookAtPt = new THREE.Vector3();
let lastTime = performance.now();

//// 2. Cannon-ES physics world ////
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 10;

// Physics materials and contact settings
const defaultMaterial = new CANNON.Material('defaultMaterial');
const contactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  { friction: 0.3, restitution: 0.1 }
);
world.addContactMaterial(contactMaterial);
world.defaultContactMaterial = contactMaterial;

// Fixed-step physics stepping to ensure collision accuracy
let physicsAccumulator = 0;
const fixedTimeStep = 1 / 60;
function stepPhysics(dt) {
  physicsAccumulator += dt;
  while (physicsAccumulator >= fixedTimeStep) {
    world.step(fixedTimeStep);
    physicsAccumulator -= fixedTimeStep;
  }
}

//// 3. Boids system ////
const boidBehaviors = [
  { fn: behaviors.separate, options: { distance: 5, scale: 2.0 } },
  { fn: behaviors.align,    options: { distance: 8, scale: 0.5 } },
  { fn: behaviors.cohere,   options: { distance: 12, scale: 1.0 } },
];

const boidSystem = new BoidSystem({ maxSpeed: 1.0, maxForce: 0.4, behaviors: boidBehaviors });

const RELAY_SPEED_BOOST = 0.5; // m/s per relay unit
// Lateral boid steering force multiplier to allow side movement even at rest
const LATERAL_FORCE = 5; // increase for stronger lateral displacement // m/s per relay unit

//// 4. Create track ////
const TRACK_LENGTH = 1000;
const ROAD_WIDTH   = 10;
const BASE_RADIUS  = TRACK_LENGTH / (2 * Math.PI);
const INNER_R      = BASE_RADIUS - ROAD_WIDTH/2;  
const OUTER_R      = BASE_RADIUS + ROAD_WIDTH/2;  
const TRACK_WRAP   = TRACK_LENGTH;  // for wrap-around and grid initialization  
// Spacing between grid rows (meters)
const ROW_SPACING  = 2;  
const road = new THREE.Mesh(
  new THREE.RingGeometry(INNER_R, OUTER_R, 128),
  new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide })
);
road.rotation.x = -Math.PI/2;
scene.add(road);

// 4ter. Ligne de départ matérialisée selon formation en grille
const startLineHeight = 0.05; // hauteur au-dessus du sol
const startLineDepth  = ROW_SPACING; // utilise la constante ROW_SPACING
const startLineGeom   = new THREE.BoxGeometry(ROAD_WIDTH, startLineHeight, startLineDepth);
const startLineMat    = new THREE.MeshBasicMaterial({ color: 0xffffff });
const startLineMesh   = new THREE.Mesh(startLineGeom, startLineMat);
startLineMesh.position.set(BASE_RADIUS, startLineHeight / 2, 0);
startLineMesh.rotation.y = 0;
scene.add(startLineMesh);

// 4bis. Dashed centerline marking following center curve
const stripeHeight = 0.05; // slight elevation
const DASH_LENGTH = 4;     // length of dash in meters
const GAP_LENGTH = 4;      // gap between dashes in meters
const curve = new THREE.ArcCurve(0, 0, BASE_RADIUS, 0, 2 * Math.PI, false);
const divisions = Math.ceil((2 * Math.PI * BASE_RADIUS) / (DASH_LENGTH + GAP_LENGTH) * 8);
const points2D = curve.getPoints(divisions);
const linePoints = points2D.map(p => new THREE.Vector3(p.x, stripeHeight, p.y));
const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
const dashMat = new THREE.LineDashedMaterial({
  color: 0xffffff,
  dashSize: DASH_LENGTH,
  gapSize: GAP_LENGTH,
  linewidth: 1
});
const dashLine = new THREE.Line(lineGeom, dashMat);
dashLine.computeLineDistances();
scene.add(dashLine);

// 4ter. Splines for ideal racing line
const trackPoints = [];
for (let a = 0; a <= Math.PI * 2; a += 0.1) {
  trackPoints.push(new THREE.Vector3(BASE_RADIUS * Math.cos(a), 0, BASE_RADIUS * Math.sin(a)));
}
const centerSpline = new THREE.CatmullRomCurve3(trackPoints, true);
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

//// 5. Initialize riders + physics bodies + boids ////
const NUM_TEAMS = 23, RIDERS_PER_TEAM = 8;
const teamColors = Array.from({ length: NUM_TEAMS }, (_, i) => {
  const c = new THREE.Color(); c.setHSL(i/NUM_TEAMS, 0.8, 0.5);
  return c;
});
const riderGeom = new THREE.BoxGeometry(1.7, 1.5, 0.5);

// Create selection marker
const selectionMarkerGeom = new THREE.EdgesGeometry(riderGeom);
const selectionMarkerMat  = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 4 });
const selectionMarker     = new THREE.LineSegments(selectionMarkerGeom, selectionMarkerMat);
selectionMarker.visible = false;
scene.add(selectionMarker);

const riders = [];
for (let team = 0; team < NUM_TEAMS; team++) {
  const mat = new THREE.MeshLambertMaterial({ color: teamColors[team] });
  for (let i = 0; i < RIDERS_PER_TEAM; i++) {
    const RIDER_WIDTH = 1.3;
    const MIN_LATERAL_GAP = 0.3;
    const spacing = RIDER_WIDTH + MIN_LATERAL_GAP;
    const ridersPerRow = Math.max(1, Math.floor(ROAD_WIDTH / spacing));
    const idx = team * RIDERS_PER_TEAM + i;
    const row = Math.floor(idx / ridersPerRow);
    const col = idx % ridersPerRow;
    const trackDist0 = (TRACK_LENGTH - row * ROW_SPACING + TRACK_WRAP) % TRACK_WRAP;
    const usableWidth = ROAD_WIDTH - RIDER_WIDTH;
    const rawOff = (ridersPerRow === 1 ? 0 : (col / (ridersPerRow - 1) - 0.5)) * usableWidth;
    const halfRider = RIDER_WIDTH / 2;
    const maxOff = ROAD_WIDTH/2 - halfRider;
    const off = THREE.MathUtils.clamp(rawOff, -maxOff, maxOff);
    const angle0 = (trackDist0 / TRACK_LENGTH) * 2 * Math.PI;
    const x0 = (BASE_RADIUS + off) * Math.cos(angle0);
    const z0 = (BASE_RADIUS + off) * Math.sin(angle0);

    const mesh = new THREE.Mesh(riderGeom, mat);
    mesh.position.set(x0, 0, z0);
    mesh.rotation.y = angle0 + Math.PI/2;
    scene.add(mesh);

    const body = new CANNON.Body({ mass: 1 });
    body.addShape(new CANNON.Sphere(0.25));
    body.position.set(x0, 0, z0);
    world.addBody(body);

    const boid = new Boid(boidBehaviors);
    boid.position = [x0, z0];
    boid.velocity = [0, 0];
    boidSystem.addBoid(boid);

    riders.push({
      team,
      isLeader: i === 0,
      trackDist: trackDist0,
      laneOffset: off,
      speed: 0,
      energy: 100,
      relayIntensity: 0,
      protectLeader: false,
      effortMode: 1,
      mesh,
      body,
      boid
    });
  }
}

//// 6. UI Controls ////
const teamSelect = document.getElementById('teamSelect');
const teamControlsDiv = document.getElementById('teamControls');
const teamColorsCss = teamColors.map(c=>`#${c.getHexString()}`);
teamSelect.innerHTML='';
teamColorsCss.forEach((col,t)=>{
  const opt=new Option(`Team ${t+1}`,t);
  opt.style.backgroundColor=col; opt.style.color='#fff';
  teamSelect.append(opt);
});
function showTeamControls(tid){
  teamControlsDiv.innerHTML='';
  const relayLabel=document.createElement('label'); relayLabel.textContent='Team Relay: ';
  const relaySel=document.createElement('select');
  [0,1,2,3].forEach(v=>relaySel.append(new Option(v===0?'None':v,v)));
  relaySel.value=0;
  relaySel.addEventListener('change',e=>{
    const lvl=+e.target.value;
    riders.filter(r=>r.team===tid).forEach((r,idx)=>{ r.relayIntensity=lvl;
      const sel=document.getElementById(`relay_${tid}_${idx}`);
      if(sel) sel.value=lvl;
    });
  });
  teamControlsDiv.append(relayLabel, relaySel, document.createElement('hr'));
  riders.filter(r=>r.team===tid).forEach((r,idx)=>{
    const row=document.createElement('div'); row.className='rider-control';
    row.innerHTML=`
      <span>Rider ${idx+1}${r.isLeader?' (Leader)':''}</span>
      <label>Relay:<select id="relay_${tid}_${idx}"><option>0</option><option>1</option><option>2</option><option>3</option></select></label>
      <label><input type="checkbox" id="prot_${tid}_${idx}" ${r.protectLeader?'checked':''} ${r.isLeader?'disabled':''}/> Protect</label>
      <label>Effort:<select id="eff_${tid}_${idx}"><option value="0">Follower</option><option value="1">Normal</option><option value="2">Attack</option></select></label>`;
    teamControlsDiv.append(row);
    document.getElementById(`relay_${tid}_${idx}`).value=r.relayIntensity;
    document.getElementById(`relay_${tid}_${idx}`).addEventListener('change',e=>r.relayIntensity=+e.target.value);
    document.getElementById(`prot_${tid}_${idx}`).addEventListener('change',e=>r.protectLeader=e.target.checked);
    document.getElementById(`eff_${tid}_${idx}`).value=r.effortMode;
    document.getElementById(`eff_${tid}_${idx}`).addEventListener('change',e=>r.effortMode=+e.target.value);
  });
}
teamSelect.addEventListener('change',()=>showTeamControls(+teamSelect.value));
teamSelect.dispatchEvent(new Event('change'));

// Default to selecting the first rider
selectedIndex = 0;
updateSelectionHelper();

//// 7. Simulation params ////
const BASE_SPEED=8, SPEED_GAIN=0.3, MAX_SPEED=20;
function polarToDist(x,z){ const a=Math.atan2(z,x); return ((a<0? a+2*Math.PI: a)/(2*Math.PI))*TRACK_WRAP; }

// ★ MOD: New constant to control how aggressively riders stick to the ideal line
const IDEAL_MIX = 0.8; // 0 = stay on physics body, 1 = glue to ideal racing line

////// 8. Animate loop ////
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Physics update
  stepPhysics(dt);

  // Apply cruise acceleration towards BASE_SPEED
  riders.forEach(r => {
    if (started) {
      const theta = (polarToDist(r.body.position.x, r.body.position.z) / TRACK_WRAP) * 2 * Math.PI;
      const forward = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
      const currentSpeed = r.body.velocity.length();
      const speedDiff = BASE_SPEED - currentSpeed;
      const accel = speedDiff * SPEED_GAIN;
      const accelForce = forward.scale(r.body.mass * accel);
      r.body.applyForce(accelForce, r.body.position);
    }
  });

  clampAndRedirect();
  applyForces(dt);
  boidSystem.update(dt);

  // Sync Three.js meshes based on physics + ideal line
  riders.forEach(r => {
    const bodyPos = new THREE.Vector3().copy(r.body.position);

    // ★ MOD: Always compute the ideal position along the rope line (no more grid preservation)
    const u = (polarToDist(bodyPos.x, bodyPos.z) % TRACK_WRAP) / TRACK_WRAP;
    const posOut = outerSpline.getPointAt(u);
    const posIn  = innerSpline.getPointAt(u);
    const t0 = centerSpline.getTangentAt(u);
    const t1 = centerSpline.getTangentAt((u + 0.01) % 1);
    const curvature = t0.angleTo(t1);
    const blend = THREE.MathUtils.clamp(curvature * 10, 0, 1);
    const idealPos = posOut.clone().lerp(posIn, blend);

    // Move rider toward the ideal line with configurable strength
    r.mesh.position.copy(bodyPos.clone().lerp(idealPos, IDEAL_MIX)); // ★ MOD
    r.trackDist = polarToDist(r.mesh.position.x, r.mesh.position.z);

    // Orientation along tangent
    const theta = (r.trackDist / TRACK_WRAP) * 2 * Math.PI;
    const dx = -Math.sin(theta), dz = Math.cos(theta);
    const lookAtPoint = new THREE.Vector3(r.mesh.position.x + dx, 0, r.mesh.position.z + dz);
    r.mesh.lookAt(lookAtPoint);
    r.mesh.rotateY(-Math.PI/2);
  });

  updateSelectionHelper();
  updateCamera();
  renderer.render(scene, camera);
}

// Helper: clamp riders to track and redirect at edges to track and redirect at edges
function clampAndRedirect() {
  const minR = INNER_R + 0.1;
  const maxR = OUTER_R - 0.1;
  riders.forEach(r => {
    const p = r.body.position;
    const radial = Math.hypot(p.x, p.z);
    if (radial < minR || radial > maxR) {
      const nx = p.x / radial, nz = p.z / radial;
      const clamped = THREE.MathUtils.clamp(radial, minR, maxR);
      p.x = nx * clamped;
      p.z = nz * clamped;
      const v = r.body.velocity;
      const tangent = new CANNON.Vec3(-nz, 0, nx);
      const speed = v.dot(tangent);
      v.x = tangent.x * speed;
      v.z = tangent.z * speed;
    }
  });
}

// Helper: apply Boid steering and relay boost forces with smoothing
function applyForces(dt) {
  riders.forEach(r => {
    // Smooth relay boost
    r.currentBoost = r.currentBoost !== undefined
      ? THREE.MathUtils.lerp(r.currentBoost, r.relayIntensity * RELAY_SPEED_BOOST, dt * 2)
      : r.relayIntensity * RELAY_SPEED_BOOST;

    // Add lateral steering toward ideal racing line (stronger than before)
    const bodyPos = r.body.position;
    const u = (polarToDist(bodyPos.x, bodyPos.z) % TRACK_WRAP) / TRACK_WRAP;
    const ideal = centerSpline.getPointAt(u);
    const lateralVec = new CANNON.Vec3(ideal.x - bodyPos.x, 0, ideal.z - bodyPos.z);
    const lateralForce = lateralVec.scale(LATERAL_FORCE); // ★ MOD – use geometric difference instead of Boid velocity only

    // Forward boost force
    const theta = (polarToDist(bodyPos.x, bodyPos.z) / TRACK_WRAP) * 2 * Math.PI;
    const fwd = new CANNON.Vec3(-Math.sin(theta), 0, Math.cos(theta));
    const fwdForce = fwd.scale(r.currentBoost);

    const totalForce = new CANNON.Vec3(lateralForce.x + fwdForce.x, 0, lateralForce.z + fwdForce.z);
    r.body.applyForce(totalForce, bodyPos);
  });
}

// Helper: update camera position and orientation
function updateCamera() {
  let tx, tz, ang;
  if (selectedIndex !== null) {
    const r = riders[selectedIndex];
    tx = r.mesh.position.x;
    tz = r.mesh.position.z;
    ang = (r.trackDist / TRACK_WRAP) * 2 * Math.PI;
  } else {
    tx = 0; tz = 0;
    riders.forEach(r => { tx += r.mesh.position.x; tz += r.mesh.position.z; });
    tx /= riders.length; tz /= riders.length;
    const avg = riders.reduce((s, r) => s + r.trackDist, 0) / riders.length;
    ang = (avg / TRACK_WRAP) * 2 * Math.PI;
  }
  forwardVec.set(-Math.sin(ang), 0, Math.cos(ang));
  const BACK = 10, H = 5;
  camera.position.set(tx - forwardVec.x * BACK, H, tz - forwardVec.z * BACK);
  lookAtPt.set(tx, 1.5, tz);
  camera.lookAt(lookAtPt);
}

// Start
animate();

// Resize
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
