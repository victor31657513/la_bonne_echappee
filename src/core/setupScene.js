// Prépare la scène Three.js, la caméra et le renderer

import * as THREE from 'three';

const container = document.getElementById('vis');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

// Stocke les LineMaterials à mettre à jour lors du redimensionnement
const lineMaterials = [];
function registerLineMaterial(mat) {
  lineMaterials.push(mat);
  mat.resolution.set(container.clientWidth, container.clientHeight);
}

function onResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  lineMaterials.forEach(mat => mat.resolution.set(width, height));
}

window.addEventListener('resize', onResize);

export { THREE, scene, camera, renderer, registerLineMaterial };
