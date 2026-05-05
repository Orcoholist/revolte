import * as THREE from 'three';
import { CONFIG } from './engine/config.js';
import { createRenderer, createScene, createCamera, createLighting } from './engine/renderer.js';
import { createPhysicsWorld } from './engine/physics.js';
import { createTrack } from './world/track.js';
import { createEnvironment } from './world/environment.js';
import { preloadCarModel, createCarMesh, createWheelMeshes, createCarPhysics } from './car/carFactory.js';
import { CarController } from './car/carController.js';
import { InputManager } from './controls/input.js';
import { HUD } from './ui/hud.js';
import { initTelegram } from './ui/telegram.js';
import { NitroSystem } from './engine/nitroSystem.js';
import { LapCounter } from './world/lapCounter.js';

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

const { renderer, particleSystem } = createRenderer();
const scene = createScene();
const camera = createCamera();
createLighting(scene);

// Передаём scene в particleSystem
particleSystem.scene = scene;

// Создаём систему нитро
const nitroSystem = new NitroSystem(scene);

const { world, groundMat, wheelMat } = createPhysicsWorld();

// Трасса и окружение
const track = createTrack(scene, world);
createEnvironment(scene, world);

// Храним препятствия для проверки столкновений
const obstacles = track.obstacles;

// ==================== СОСТОЯНИЕ ИГРЫ ====================
window.state = {
  isPlaying: false,
  startTime: 0,
  bestTime: null,
  lap: 1,
  maxLaps: 3
};

// Загружаем модель машины
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const loadingProgress = document.getElementById('loading-progress');
const loadingText = document.getElementById('loading-text');
const resultScreen = document.getElementById('result-screen');
const finalTime = document.getElementById('final-time');
const finalLaps = document.getElementById('final-laps');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');

// Функция показа результатов
function showResults() {
  const time = (Date.now() - window.state.startTime) / 1000;
  finalTime.textContent = time.toFixed(2) + 's';
  finalLaps.textContent = window.state.maxLaps;
  
  window.state.isPlaying = false;
  resultScreen.style.display = 'flex';
}

// Функция перезапуска
function restartRace() {
  resultScreen.style.display = 'none';
  window.state.lap = 1;
  window.state.startTime = Date.now();
  window.lapCounter.reset();
  window.car.reset(track.spawnPos, track.spawnRot);
  window.state.isPlaying = true;
}

// Функция возврата в меню
function returnToMenu() {
  resultScreen.style.display = 'none';
  startScreen.style.display = 'flex';
  startBtn.style.display = 'block';
  loadingText.style.display = 'none';
  loadingProgress.style.width = '100%';
  window.state.isPlaying = false;
}

preloadCarModel('models/cars/subaru_impreza_rally_car_99_gt4.glb', (model) => {
  loadingText.textContent = '✅ Модель загружена!';
  loadingProgress.style.width = '100%';
  loadingText.style.color = '#4ade80';

  // Показываем кнопку через секунду
  setTimeout(() => {
    startBtn.style.display = 'block';
    loadingText.style.display = 'none';
    document.getElementById('loading-bar').style.display = 'none';
  }, 800);

  // Создаём машину
  const carMesh = createCarMesh();
  scene.add(carMesh);

  const wheelMeshes = []; // Пустой массив — колеса есть в модели

  const { chassisBody, vehicle } = createCarPhysics(world, wheelMat);
  window.car = new CarController(chassisBody, vehicle, carMesh, wheelMeshes);
  window.car.reset(track.spawnPos, track.spawnRot);

  // Система отслеживания кругов
  window.lapCounter = new LapCounter(
    track.segments,
    track.spawnPos,
    (lapNumber) => {
      console.log(`🏁 Круг ${lapNumber} завершен!`);
      window.state.lap = lapNumber;
      
      // Проверка на конец игры
      if (lapNumber >= window.state.maxLaps) {
        showResults();
      }
    },
    scene // Передаём сцену для отрисовки стрелок
  );

  // Ввод
  const input = new InputManager();
  input.onUpdate((state) => { window.car.input = state; });

  // HUD
  window.hud = new HUD();

  // Telegram
  initTelegram();
});

// ==================== КАМЕРА ====================

const camTarget = new THREE.Vector3();
const camLookAt = new THREE.Vector3();

function updateCamera() {
  // Направление "назад" от машины (учитываем поворот)
  const back = new THREE.Vector3(0, 0, 1); // "назад" в локальных координатах
  back.applyQuaternion(window.car.mesh.quaternion);

  camTarget.copy(window.car.mesh.position);
  camTarget.add(back.multiplyScalar(CONFIG.camera.distance));
  camTarget.y += CONFIG.camera.height;

  const speedFactor = Math.min(window.car.speed / 150, CONFIG.camera.speedZoomFactor);
  camTarget.add(back.clone().normalize().multiplyScalar(speedFactor * 6));
  camTarget.y += speedFactor * 2;

  camera.position.lerp(camTarget, CONFIG.camera.lerpSpeed);
  camLookAt.copy(window.car.mesh.position);
  camLookAt.y += 1;
  camera.lookAt(camLookAt);
}

// ==================== ПЕРЕВОРОТ МАШИНЫ ====================

const flipBtn = document.getElementById('flip-btn');

// Клавиша R — перевернуть
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && window.state.isPlaying) {
    window.car.flipOver();
  }
  // Клавиша Shift — нитро
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (window.state.isPlaying && window.car) {
      window.car.activateNitro();
    }
  }
});

// Клавиши отпускаются
document.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (window.car) {
      window.car.deactivateNitro();
    }
  }
});

// Кнопка на экране
flipBtn.addEventListener('click', () => {
  if (window.state.isPlaying) window.car.flipOver();
});
flipBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (window.state.isPlaying) window.car.flipOver();
}, { passive: false });

// Кнопка нитро на экране
const nitroBtn = document.getElementById('nitro-btn');
if (nitroBtn) {
  nitroBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (window.state.isPlaying && window.car) {
      window.car.activateNitro();
    }
  });
  nitroBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (window.car) {
      window.car.deactivateNitro();
    }
  });
}

// ==================== ПРОВЕРКА СТОЛКНОВЕНИЙ С ПРЕПЯТСТВИЯМИ ====================

const obstacleCheckDist = 3;
const sparkThreshold = 20;

function checkObstacleCollisions(carPos) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    const dist = carPos.distanceTo(obstacle.position);
    
    if (dist < obstacleCheckDist) {
      // Испускаем искры при столкновении
      const impactDir = new THREE.Vector3()
        .subVectors(carPos, obstacle.position)
        .normalize();
      
      particleSystem.emitSparks(
        obstacle.position.clone().add(new THREE.Vector3(0, 0.75, 0)),
        impactDir,
        10
      );
      
      // Сдвигаем препятствие
      obstacle.position.add(impactDir.multiplyScalar(0.5));
      obstacle.rotation.y += 0.2;
      
      // Если препятствие слишком далеко, удаляем его
      if (dist > 20) {
        scene.remove(obstacle);
        obstacles.splice(i, 1);
      }
    }
  }
}

// ==================== СТАРТ ====================

startBtn.addEventListener('click', () => {
  startScreen.style.display = 'none';
  window.state.isPlaying = true;
  window.state.startTime = Date.now();
  window.car.reset(track.spawnPos, track.spawnRot);
});

// Кнопка "Ещё раз"
restartBtn.addEventListener('click', restartRace);
restartBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  restartRace();
});

// Кнопка "Меню"
menuBtn.addEventListener('click', returnToMenu);
menuBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  returnToMenu();
});

// ==================== ГЛАВНЫЙ ЦИКЛ ====================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (window.state.isPlaying) {
    world.step(1 / 60, dt, CONFIG.physics.substeps);
    window.car.update();
    updateCamera();
    window.hud.update(window.car, window.state, nitroSystem, window.lapCounter);

    // Обновляем систему частиц
    particleSystem.update(dt);

    // Обновляем систему нитро
    nitroSystem.update(dt);

    // Эффекты выхлопа и дыма при дрифте
    const carSpeed = window.car.speed;
    const carPos = window.car.mesh.position.clone();
    carPos.y += 0.5;
    
    // Выхлоп при движении
    if (carSpeed > 10) {
      const exhaustDir = new THREE.Vector3(0, 0.5, -1);
      exhaustDir.applyQuaternion(window.car.mesh.quaternion);
      particleSystem.emitExhaust(carPos, exhaustDir, carSpeed / 100);
    }

    // Дым при дрифте (боковое скольжение)
    const sidewaysSpeed = window.car.getSidewaysSpeed();
    if (Math.abs(sidewaysSpeed) > 20 && carSpeed > 30) {
      const smokeDir = new THREE.Vector3(0, 0.5, 0);
      particleSystem.emitSmoke(carPos, smokeDir, 3);
    }

    // Эффекты нитро
    if (window.car.isNitroActive() && nitroSystem.isNitroActive()) {
      const nitroDir = new THREE.Vector3(0, 0.5, -1);
      nitroDir.applyQuaternion(window.car.mesh.quaternion);
      
      // Частицы нитро из выхлопных труб
      nitroSystem.emitNitroFlame(carPos, nitroDir);
      nitroSystem.emitNitroTrail(carPos, nitroDir);
    }

    // Проверка столкновений с препятствиями
    checkObstacleCollisions(window.car.mesh.position);

    // Обновление счётчика кругов
    if (window.lapCounter) {
      window.lapCounter.update(window.car.mesh.position);
      
      // Передаём следующую контрольную точку для миникарты
      window.car.mesh.userData.nextCheckpoint = window.lapCounter.getNextCheckpoint();
    }

    // Показываем кнопку переворота, если машина вверх дном
    flipBtn.style.display = window.car.isFlipped() ? 'block' : 'none';
  }

  renderer.render(scene, camera);
}

animate();

// ==================== РЕСАЙЗ ====================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
