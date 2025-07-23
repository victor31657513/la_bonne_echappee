// Prépare la scène Three.js, la caméra et le renderer

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';

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

// Stocke les LineMaterials à mettre à jour lors du redimensionnement
const lineMaterials = [];
function registerLineMaterial(mat) {
  lineMaterials.push(mat);
  mat.resolution.set(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  lineMaterials.forEach(mat =>
    mat.resolution.set(window.innerWidth, window.innerHeight)
  );
});

export { THREE, scene, camera, renderer, registerLineMaterial };
