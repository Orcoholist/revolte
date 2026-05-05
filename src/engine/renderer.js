import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ParticleSystem } from './particleSystem.js';

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById('game-container').appendChild(renderer.domElement);
  
  const particleSystem = new ParticleSystem(null); // scene будет передан позже
  
  return { renderer, particleSystem };
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.sky);
  scene.fog = new THREE.Fog(CONFIG.colors.sky, 100, 400);
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  return camera;
}

export function createLighting(scene) {
  // Окружающий свет
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Солнце
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(60, 100, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  scene.add(sun);

  // Полусферический свет для реалистичного освещения
  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x4a7c2e, 0.4);
  scene.add(hemi);
}
