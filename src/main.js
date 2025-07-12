import * as THREE from 'three';
import { curve3D } from './lib/gpxLoader.js';
import { CyclistSim } from './simulation/CyclistSim.js';

export async function init() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(0, 100, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(50, 50, 50);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x666666));

  let track;
  try {
    track = await curve3D('assets/parcours.gpx');
  } catch (err) {
    console.error('Failed to load GPX track', err);
    alert(err.message);
    throw err;
  }
  const roadWidth = 12;
  const segments = 5000;
  const frames = track.computeFrenetFrames(segments);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const p = track.getPointAt(u);
    const tangent = frames.tangents[i];
    const side = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), tangent)
      .normalize()
      .multiplyScalar(roadWidth / 2);
    positions.push(p.x + side.x, p.y + side.y, p.z + side.z);
    positions.push(p.x - side.x, p.y - side.y, p.z - side.z);
    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();
  const roadMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
  const road = new THREE.Mesh(roadGeo, roadMat);
  scene.add(road);

  const boxGeo = new THREE.BoxGeometry(1, 2, 4);
  boxGeo.translate(0, 1, 0);
  const boxMat = new THREE.MeshPhongMaterial({ color: 0x0000ff });
  const cyclist = new THREE.Mesh(boxGeo, boxMat);
  scene.add(cyclist);

  const sim = new CyclistSim(track);
  const speedEl = document.getElementById('speed');
  const energyFill = document.getElementById('energyFill');
  const attackFill = document.getElementById('attackFill');
  const intensitySlider = document.getElementById('intensity');
  const attackBtn = document.getElementById('attackBtn');

  intensitySlider.addEventListener('input', () => {
    sim.setIntensity(parseFloat(intensitySlider.value));
  });

  attackBtn.addEventListener('click', () => {
    sim.startAttack();
    attackBtn.disabled = true;
    attackBtn.textContent = 'Attaque !';
  });

  const cameraOffset = new THREE.Vector3(0, 3, -10);
  const smoothedOffset = cameraOffset.clone();
  const CAMERA_SMOOTHING = 0.05;
  let yaw = 0;
  let pitch = 0;
  const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
  };

  window.addEventListener('keydown', (e) => {
    if (e.code in keys) {
      e.preventDefault();
      keys[e.code] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code in keys) {
      e.preventDefault();
      keys[e.code] = false;
    }
  });

  if (matchMedia('(pointer: coarse)').matches) {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const SENSITIVITY = 0.005;

    const onPointerDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw += dx * SENSITIVITY;
      pitch = Math.min(Math.max(pitch + dy * SENSITIVITY, -Math.PI / 3), Math.PI / 3);
    };
    const onPointerUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function updateCamera(dt) {
    if (keys.ArrowLeft) yaw += 0.02;
    if (keys.ArrowRight) yaw -= 0.02;
    if (keys.ArrowUp) pitch = Math.min(pitch + 0.02, Math.PI / 3);
    if (keys.ArrowDown) pitch = Math.max(pitch - 0.02, -Math.PI / 3);

    const targetOffset = cameraOffset
      .clone()
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .applyQuaternion(cyclist.quaternion);
    smoothedOffset.lerp(targetOffset, CAMERA_SMOOTHING);
    camera.position.copy(cyclist.position).add(smoothedOffset);
    if (camera.position.y < cyclist.position.y) {
      camera.position.y = cyclist.position.y;
    }
    camera.lookAt(cyclist.position);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let last = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    sim.update(dt, cyclist);
    const tangent = track.getTangentAt(sim.u);
    const horiz = Math.hypot(tangent.x, tangent.z);
    const slope = horiz > 0 ? (tangent.y / horiz) * 100 : 0;
    speedEl.textContent = `${(sim.speed * 3.6).toFixed(1)} km/h | ${slope.toFixed(1)}%`;
    energyFill.style.width = `${sim.getEnergy()}%`;
    attackFill.style.width = `${sim.getAttackEnergy()}%`;
    attackBtn.disabled = sim.attackActive || sim.getAttackEnergy() <= 0;
    attackBtn.textContent = sim.attackActive ? 'Attaque !' : 'Attaquer';
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  animate();
}

init();
