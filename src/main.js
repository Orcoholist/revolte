import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from './engine/config.js';
import { createRenderer, createScene, createCamera, createLighting } from './engine/renderer.js';
import { createPhysicsWorld } from './engine/physics.js';
import { createTrack } from './world/track.js';
import { createEnvironment } from './world/environment.js';
import { preloadCarModel, createCarMesh, createWheelMeshes, createCarPhysics } from './car/carFactory.js';
import { recolorCarModel } from './car/carModelLoader.js';
import { CarController } from './car/carController.js';
import { BotManager } from './car/botManager.js';
import { InputManager } from './controls/input.js';
import { HUD } from './ui/hud.js';
import { initTelegram } from './ui/telegram.js';
import { LapCounter } from './world/lapCounter.js';
import { ItemSystem } from './world/itemSystem.js';
import { EffectsPool } from './world/effectsPool.js';
import { MovingTrain } from './world/movingTrain.js';

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

const { renderer, particleSystem } = createRenderer();
const scene = createScene();
const camera = createCamera();
createLighting(scene);

particleSystem.setScene(scene);

camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const { world, groundMat, wheelMat } = createPhysicsWorld();

const track = createTrack(scene, world);
const environment = createEnvironment(scene, world);

const obstacles = [...track.obstacles, ...environment.obstacles];
window.obstacles = obstacles;

let trackElements = [];
if (track.elements && track.elements.length > 0) {
  trackElements = track.elements;
} else {
  trackElements = [];
}

// Поезд теперь статичен – путь не нужен
let train = null;

// ==================== СОСТОЯНИЕ ИГРЫ ====================
window.state = {
  isPlaying: false,
  startTime: 0,
  bestTime: null,
  lap: 1,
  maxLaps: 3
};

window.lapCounter = new LapCounter(
  track.segments,
  track.spawnPos,
  (lapNumber) => {
    console.log(`🏁 Круг ${lapNumber} завершен!`);
    window.state.lap = lapNumber;
    if (lapNumber >= window.state.maxLaps) {
      showResults();
    }
  },
  scene,
  track.spawnRot
);

window.hud = new HUD();

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const loadingProgress = document.getElementById('loading-progress');
const loadingText = document.getElementById('loading-text');
const resultScreen = document.getElementById('result-screen');
const finalTime = document.getElementById('final-time');
const finalLaps = document.getElementById('final-laps');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');

function showResults() {
  const time = (Date.now() - window.state.startTime) / 1000;
  finalTime.textContent = time.toFixed(2) + 's';
  finalLaps.textContent = window.state.maxLaps;
  window.state.isPlaying = false;
  resultScreen.style.display = 'flex';
}

function restartRace() {
  resultScreen.style.display = 'none';
  window.state.lap = 1;
  window.state.startTime = Date.now();
  window.lapCounter.reset();
  window.car.reset(track.spawnPos, track.spawnRot.y);
  window.botManager.reset();
  if (train) train.reset();
  if (window.itemSystem) {
    window.itemSystem.clear();
    for (let i = 0; i < 60; i++) {
      window.itemSystem.spawnItem(track.segments);
    }
  }
  if (window.effectsPool) {
    window.effectsPool.clear();
  }
  window.state.isPlaying = true;
}

function returnToMenu() {
  resultScreen.style.display = 'none';
  startScreen.style.display = 'flex';
  startBtn.style.display = 'block';
  loadingText.style.display = 'none';
  loadingProgress.style.width = '100%';
  window.state.isPlaying = false;
  if (window.itemSystem) {
    window.itemSystem.clear();
  }
  if (window.effectsPool) {
    window.effectsPool.clear();
  }
}

// Загружаем модель поезда
const trainLoader = new GLTFLoader();
trainLoader.load(
  '/models/train/train.glb',
  (gltf) => {
    console.log('Модель поезда загружена');
    loadingText.textContent = '✅ Модель поезда загружена!';
    loadingProgress.style.width = '100%';
    loadingText.style.color = '#4ade80';

    // Поезд статичен – передаём null путь
    train = new MovingTrain(scene, world, null, gltf.scene);

    // Если машина уже загружена, показываем кнопку
    if (window.car) {
      setTimeout(() => {
        startBtn.style.display = 'block';
        loadingText.style.display = 'none';
        document.getElementById('loading-bar').style.display = 'none';
      }, 800);
    }
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total * 100) + '% загружено поезда');
    loadingText.textContent = `Загрузка поезда: ${Math.round(xhr.loaded / xhr.total * 100)}%`;
  },
  (error) => {
    console.error('Ошибка загрузки модели поезда:', error);
    loadingText.textContent = 'Ошибка загрузки поезда';
    loadingText.style.color = '#ef4444';
  }
);

preloadCarModel('models/cars/subaru_impreza_rally_car_99_gt4.glb', (model) => {
  console.log('Модель машины загружена');
  loadingText.textContent = '✅ Модель машины загружена!';
  loadingProgress.style.width = '100%';
  loadingText.style.color = '#4ade80';

  if (train) {
    setTimeout(() => {
      startBtn.style.display = 'block';
      loadingText.style.display = 'none';
      document.getElementById('loading-bar').style.display = 'none';
    }, 800);
  }

  const carMesh = createCarMesh();
  recolorCarModel(carMesh, 0x2266ff, 0x333333);
  scene.add(carMesh);

  const wheelMeshes = [];

  const { chassisBody, vehicle } = createCarPhysics(world, wheelMat);
  window.car = new CarController(chassisBody, vehicle, carMesh, wheelMeshes);
  window.car.reset(track.spawnPos, track.spawnRot.y);

  window.botManager = new BotManager(scene, world, wheelMat, track.segments, track.spawnPoints);
  window.botManager.spawnBots(7);

  window.itemSystem = new ItemSystem(scene);
  window.effectsPool = new EffectsPool(scene);
  for (let i = 0; i < 60; i++) {
    window.itemSystem.spawnItem(track.segments);
  }

  const input = new InputManager();
  input.onUpdate((state) => { window.car.input = state; });

  input.onUseItem(() => {
    if (window.state.isPlaying && window.itemSystem && window.car) {
      const itemType = window.itemSystem.useItem();
      if (itemType) {
        const result = window.itemSystem.applyItemEffect(itemType, window.car);
        console.log(result.message);
      }
    }
  });

  initTelegram();

  const mobileControls = document.getElementById('mobile-controls');

  if (isMobileDevice()) {
    mobileControls.style.display = 'block';
    document.getElementById('item-indicator').classList.add('mobile-item');
    const btnIds = ['btn-left', 'btn-right', 'btn-gas', 'btn-brake', 'btn-reverse'];
    for (const id of btnIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('touchstart', () => el.classList.add('active'), { passive: false });
      el.addEventListener('touchend', () => el.classList.remove('active'), { passive: false });
    }
    flipBtn.style.display = 'block';
  } else {
    mobileControls.style.display = 'none';
  }

  flipBtn.addEventListener('click', () => {
    if (window.state.isPlaying) window.car.flipOver();
  });
  flipBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (window.state.isPlaying) window.car.flipOver();
  }, { passive: false });

  const itemIndicator = document.getElementById('item-indicator');
  itemIndicator.addEventListener('click', () => {
    if (window.state.isPlaying && window.itemSystem && window.car) {
      const itemType = window.itemSystem.useItem();
      if (itemType) {
        const result = window.itemSystem.applyItemEffect(itemType, window.car);
        console.log(result.message);
      }
    }
  });
  itemIndicator.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (window.state.isPlaying && window.itemSystem && window.car) {
      const itemType = window.itemSystem.useItem();
      if (itemType) {
        const result = window.itemSystem.applyItemEffect(itemType, window.car);
        console.log(result.message);
      }
    }
  }, { passive: false });
});

// ==================== КАМЕРА ====================

const camTarget = new THREE.Vector3();
const camLookAt = new THREE.Vector3();

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function updateCamera() {
  const isMobile = isMobileDevice();
  const camDistance = isMobile ? CONFIG.camera.distance * 0.65 : CONFIG.camera.distance;
  const camHeight   = isMobile ? CONFIG.camera.height   * 0.65 : CONFIG.camera.height;
  const speedZoom   = isMobile ? CONFIG.camera.speedZoomFactor * 0.5 : CONFIG.camera.speedZoomFactor;

  const back = new THREE.Vector3(0, 0, 1);
  back.applyQuaternion(window.car.mesh.quaternion);

  camTarget.copy(window.car.mesh.position);
  camTarget.add(back.multiplyScalar(camDistance));
  camTarget.y += camHeight;

  const speedFactor = Math.min(window.car.speed / 150, speedZoom);
  camTarget.add(back.clone().normalize().multiplyScalar(speedFactor * 6));
  camTarget.y += speedFactor * 2;

  camera.position.lerp(camTarget, CONFIG.camera.lerpSpeed);
  camLookAt.copy(window.car.mesh.position);
  camLookAt.y += 1;
  camera.lookAt(camLookAt);
}

// ==================== ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ПРИ ИСПОЛЬЗОВАНИИ ПРЕДМЕТОВ ====================
function createItemEffect(itemType, position) {
  if (!window.particleSystem || !window.effectsPool) return;

  const pos = position.clone();
  pos.y += 1;
  
  switch (itemType) {
    case 'boost':
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 0.5 + Math.random() * 0.5;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        window.particleSystem.emitExhaust(
          pos.clone().add(dir.multiplyScalar(distance)),
          dir,
          0.5 + Math.random() * 0.5
        );
      }
      break;
      
    case 'superboost':
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 0.5 + Math.random() * 1.0;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        window.particleSystem.emitExhaust(
          pos.clone().add(dir.multiplyScalar(distance)),
          dir,
          1.0 + Math.random() * 1.0
        );
      }
      window.effectsPool.createFlash(pos, 0xffff00, 0.2, 1.5);
      break;
      
    case 'shield':
      window.effectsPool.createRing(pos, 0x00ffff, 1.0);
      break;
      
    case 'rocket':
      window.effectsPool.createFlash(pos, 0xff4400, 0.3, 2);
      break;
      
    case 'mine':
      window.effectsPool.createFlash(pos, 0xff8800, 0.5, 1.2);
      break;
      
    case 'oil':
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        window.particleSystem.emitSmoke(pos.clone(), dir, 5);
      }
      break;

    case 'jump':
    case 'loop':
    case 'tunnel':
      window.effectsPool.createFlash(pos, 0x00ff88, 0.2, 1);
      break;
  }
}

// ==================== ПЕРЕВОРОТ МАШИНЫ ====================

const flipBtn = document.getElementById('flip-btn');

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && window.state.isPlaying) {
    window.car.flipOver();
  }
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    if (window.state.isPlaying && window.itemSystem && window.car) {
      const itemType = window.itemSystem.useItem();
      if (itemType) {
        const result = window.itemSystem.applyItemEffect(itemType, window.car);
        console.log(result.message);
      }
    }
  }

  if (window.state.isPlaying && (e.ctrlKey || e.metaKey)) {
    if (e.code === 'KeyD' || e.code === 'KeyS' || e.code === 'KeyA' || e.code === 'KeyW') {
      e.preventDefault();
      console.log(`Действие ${e.code} заблокировано во время игры.`);
    }
  }
});

// ==================== ПРОВЕРКА СТОЛКНОВЕНИЙ С ПРЕПЯТСТВИЯМИ ====================

const obstacleCheckDist = 3;
const sparkThreshold = 20;

function checkObstacleCollisions(carPos) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    const dist = carPos.distanceTo(obstacle.position);
    
    if (dist < obstacleCheckDist) {
      const impactDir = new THREE.Vector3()
        .subVectors(carPos, obstacle.position)
        .normalize();
      
      particleSystem.emitSparks(
        obstacle.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
        impactDir,
        10
      );
      
      obstacle.position.add(impactDir.multiplyScalar(0.5));
      obstacle.rotation.y += 0.2;
      
      if (window.car && window.car.chassisBody) {
        let pushForce = 8;
        const type = obstacle.userData && obstacle.userData.type;
        if (type === 'container') pushForce = 12;
        else if (type === 'barrel') pushForce = 6;
        else if (type === 'crate') pushForce = 10;
        
        window.car.chassisBody.velocity.x += impactDir.x * pushForce;
        window.car.chassisBody.velocity.z += impactDir.z * pushForce;
        window.car.chassisBody.velocity.y = Math.max(window.car.chassisBody.velocity.y, 2);
      }
      
      if (dist > 20) {
        scene.remove(obstacle);
        obstacles.splice(i, 1);
      }
    }
  }
}

// ==================== ПРОВЕРКА СТОЛКНОВЕНИЙ С ОСОБЫМИ ЭЛЕМЕНТАМИ ТРАССЫ ====================

function checkSpecialTrackCollisions(carPos, carBody) {
  if (!trackElements || trackElements.length === 0) return;
  
  for (const element of trackElements) {
    if (!element.physics || !element.visual) continue;
    
    try {
      const dist = carPos.distanceTo(element.visual.position);
      
      if (element.type === 'ramp' && dist < element.physics.collisionRadius) {
        const carDirection = new THREE.Vector3(0, 0, -1);
        carDirection.applyQuaternion(carBody.quaternion);
        carDirection.normalize();
        
        const toElement = new THREE.Vector3().subVectors(element.visual.position, carPos).normalize();
        
        if (carDirection.dot(toElement) > 0.7) {
          carBody.applyImpulse(
            new CANNON.Vec3(
              0, 
              element.physics.bounceFactor * 200, 
              0
            ),
            carBody.position
          );
          
          createItemEffect('jump', element.visual.position);
        }
      }
      
      if (element.type === 'loop' && dist < element.physics.collisionRadius) {
        carBody.applyImpulse(
          new CANNON.Vec3(0, element.physics.bounceFactor * 50, 0),
          carBody.position
        );
        
        createItemEffect('loop', element.visual.position);
      }
      
      if (element.type === 'tunnel' && dist < element.physics.collisionRadius) {
        const dragFactor = 0.5;
        const currentVelocity = carBody.velocity.clone();
        currentVelocity.scale(dragFactor, currentVelocity);
        carBody.velocity.copy(currentVelocity);
        
        createItemEffect('tunnel', element.visual.position);
      }
    } catch (err) {
      console.error('Error in track element collision:', err);
    }
  }
}
    
function onTrainHitPlayer() {
  console.log('🚂 Поезд ударил игрока!');
}

function onTrainHitBot(bot) {
  return () => {
    console.log('🚂 Поезд ударил бота!');
  };
}

// ==================== СТАРТ ====================

startBtn.addEventListener('click', () => {
  startScreen.style.display = 'none';
  window.state.isPlaying = true;
  window.state.startTime = Date.now();
  window.car.reset(track.spawnPos, track.spawnRot.y);
  window.botManager.reset();
  if (train) train.reset();
});

restartBtn.addEventListener('click', restartRace);
restartBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  restartRace();
});

menuBtn.addEventListener('click', returnToMenu);
menuBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  returnToMenu();
});

// ==================== ГЛАВНЫЙ ЦИКЛ ====================

const clock = new THREE.Clock();
let _frameCount = 0;

function onMineHitPlayer() {
  window.car.flipOver();
  window.car.chassisBody.velocity.set(0, 0, 0);
  window.car.chassisBody.angularVelocity.set(0, 0, 0);
}
function onMineHitBot(bot) {
  return () => {
    bot.controller.flipOver();
    bot.controller.chassisBody.velocity.set(0, 0, 0);
    bot.controller.chassisBody.angularVelocity.set(0, 0, 0);
  };
}
function onOilHitPlayer(oil) {
  window.car.oilSlick(3000);
}
function onOilHitBot(bot) {
  return (oil) => {
    bot.controller.oilSlick(3000);
  };
}
function onBallHitPlayer() {
  console.log('Ball hit player!');
}
function onBallHitBot() {
  console.log('Ball hit bot!');
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  _frameCount++;

  if (window.state.isPlaying && window.car && window.botManager && window.hud) {
    try {
      world.step(1 / 60, dt, CONFIG.physics.substeps);
    } catch (err) {
      console.error('Physics world.step error:', err.message);
    }
    
    try {
      window.car.update();
    } catch (err) {
      console.error('Car update error:', err.message);
    }

    try {
      window.botManager.update(dt);
    } catch (err) {
      console.error('BotManager update error:', err.message);
    }

    updateCamera();
    window.hud.update(window.car, window.state, window.lapCounter);

    const carPos = window.car.mesh.position;
    const teleportRadius = 120;
    if (carPos.x * carPos.x + carPos.z * carPos.z > teleportRadius * teleportRadius || carPos.y < -20) {
      window.car.reset(track.spawnPos, track.spawnRot.y);
      window.car.chassisBody.velocity.set(0, 0, 0);
      window.car.chassisBody.angularVelocity.set(0, 0, 0);
      console.log('🔄 Машина вышла за границы карты — телепорт в центр');
    }

    if (_frameCount % 2 === 0) {
      if (window.itemSystem) {
        for (const bot of window.botManager.bots) {
          window.itemSystem.checkMineCollisions(bot.controller, onMineHitBot(bot));
          window.itemSystem.checkOilCollisions(bot.controller, onOilHitBot(bot));
          window.itemSystem.checkBallCollisions(bot.controller, onBallHitBot);
        }
        
        window.itemSystem.checkMineCollisions(window.car, onMineHitPlayer);
        window.itemSystem.checkOilCollisions(window.car, onOilHitPlayer);
        window.itemSystem.checkBallCollisions(window.car, onBallHitPlayer);
      }

      checkObstacleCollisions(window.car.mesh.position);
      checkSpecialTrackCollisions(window.car.mesh.position.clone(), window.car.chassisBody);

      if (train) {
        if (train.checkCollision(window.car)) {
          onTrainHitPlayer();
        }
        for (const bot of window.botManager.bots) {
          if (train.checkCollision(bot.controller)) {
            onTrainHitBot(bot)();
          }
        }
      }
    }

    if (window.itemSystem) {
      const trackSegments = track && track.segments ? track.segments : [];
      window.itemSystem.update(dt, trackSegments);
      window.itemSystem.checkItemCollection(window.car.mesh.position);
    }

    particleSystem.update(dt);

    const carSpeed = window.car.speed;
    const exhaustPos = window.car.mesh.position.clone();
    exhaustPos.y += 0.5;
    
    if (carSpeed > 10) {
      const exhaustDir = new THREE.Vector3(0, 0.5, -1);
      exhaustDir.applyQuaternion(window.car.mesh.quaternion);
      particleSystem.emitExhaust(exhaustPos, exhaustDir, carSpeed / 100);
    }

    const sidewaysSpeed = window.car.getSidewaysSpeed();
    if (Math.abs(sidewaysSpeed) > 20 && carSpeed > 30) {
      const smokeDir = new THREE.Vector3(0, 0.5, 0);
      particleSystem.emitSmoke(exhaustPos, smokeDir, 3);
    }

    if (window.lapCounter) {
      window.lapCounter.update(window.car.mesh.position);
      window.car.mesh.userData.nextCheckpoint = window.lapCounter.getNextCheckpoint();
    }

    if (window.effectsPool && _frameCount % 2 === 0) {
      window.effectsPool.update(dt);
    }

    // Обновляем поезд (стрельба)
    if (train) {
      train.update(dt);
    }

    flipBtn.style.display = window.car.isFlipped() ? 'block' : 'none';
  }

  renderer.render(scene, camera);
}

// ==================== РЕСАЙЗ ====================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== ЗАПУСК АНИМАЦИИ ====================
animate();
