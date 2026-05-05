---
name: Three.js Templates
description: Шаблоны кода для Three.js разработки
version: 1.0.0
---

# Three.js Templates

## 🏗️ Базовая сцена

```javascript
import * as THREE from 'three';

function createBasicScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Освещение
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(50, 100, 50);
  sun.castShadow = true;
  scene.add(sun);

  return { scene, camera, renderer };
}
```

## 🎮 Игровой цикл

```javascript
const clock = new THREE.Clock();

function gameLoop() {
  requestAnimationFrame(gameLoop);

  const dt = Math.min(clock.getDelta(), 0.05);
  
  // Обновление физики
  world.step(1/60, dt, 10);
  
  // Обновление объектов
  player.update(dt);
  enemies.forEach(e => e.update(dt));
  
  // Камера
  camera.position.lerp(player.position, 0.1);
  
  // Рендер
  renderer.render(scene, camera);
}

gameLoop();
```

## 🚗 Vehicle Physics (Cannon.js)

```javascript
import * as CANNON from 'cannon-es';

function createVehicle(world) {
  const chassisBody = new CANNON.Body({ mass: 150 });
  chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)));
  
  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2
  });

  const wheelOptions = {
    radius: 0.35,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: 30,
    suspensionRestLength: 0.3,
    frictionSlip: 2,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4,
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
    maxSuspensionTravel: 0.3,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  };

  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, 1) });
  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1) });
  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, -1) });
  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(1, 0, -1) });

  vehicle.addToWorld(world);
  return { vehicle, chassisBody };
}
```

## ✨ Система частиц

```javascript
class ParticleSystem {
  constructor(scene) {
    this.particles = [];
    this.scene = scene;
  }

  emit(position, velocity, color = 0xffaa00, size = 0.1, lifetime = 1) {
    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color, 
      transparent: true,
      opacity: 1 
    });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    particle.userData = { velocity, life: lifetime };
    this.scene.add(particle);
    this.particles.push(particle);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.add(p.userData.velocity.clone().multiplyScalar(dt));
      p.userData.life -= dt;
      p.material.opacity = p.userData.life;
      
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
      }
    }
  }
}
```

## 🎨 Post-Processing (Bloom)

```javascript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

function addBloomEffect(scene, camera, renderer) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,  // strength
    0.4,  // radius
    0.85  // threshold
  );
  composer.addPass(bloomPass);

  return composer;
}

// В цикле:
composer.render();
```

## 📱 Mobile Controls

```javascript
class MobileControls {
  constructor() {
    this.gas = false;
    this.brake = false;
    this.left = false;
    this.right = false;

    this._initTouch();
  }

  _initTouch() {
    // Газ
    document.getElementById('gas-btn').addEventListener('touchstart', () => this.gas = true);
    document.getElementById('gas-btn').addEventListener('touchend', () => this.gas = false);

    // Тормоз
    document.getElementById('brake-btn').addEventListener('touchstart', () => this.brake = true);
    document.getElementById('brake-btn').addEventListener('touchend', () => this.brake = false);

    // Поворот
    document.getElementById('left-btn').addEventListener('touchstart', () => this.left = true);
    document.getElementById('left-btn').addEventListener('touchend', () => this.left = false);
    document.getElementById('right-btn').addEventListener('touchstart', () => this.right = true);
    document.getElementById('right-btn').addEventListener('touchend', () => this.right = false);
  }

  get input() {
    return { gas: this.gas, brake: this.brake, left: this.left, right: this.right };
  }
}
```

## 🔊 Звуковой менеджер

```javascript
class AudioManager {
  constructor() {
    this.sounds = {};
    this.masterVolume = 1.0;
  }

  load(name, url) {
    const audio = new Audio(url);
    audio.volume = this.masterVolume;
    this.sounds[name] = audio;
  }

  play(name, loop = false) {
    if (this.sounds[name]) {
      this.sounds[name].loop = loop;
      this.sounds[name].play();
    }
  }

  stop(name) {
    if (this.sounds[name]) {
      this.sounds[name].pause();
      this.sounds[name].currentTime = 0;
    }
  }

  setVolume(name, volume) {
    if (this.sounds[name]) {
      this.sounds[name].volume = volume * this.masterVolume;
    }
  }
}
```
