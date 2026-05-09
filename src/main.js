import * as THREE from 'three';
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

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

const { renderer, particleSystem } = createRenderer();
const scene = createScene();
const camera = createCamera();
createLighting(scene);

// Передаём scene в particleSystem
particleSystem.scene = scene;

const { world, groundMat, wheelMat } = createPhysicsWorld();

// Трасса и окружение
const track = createTrack(scene, world);
createEnvironment(scene, world);

// Храним препятствия для проверки столкновений
const obstacles = track.obstacles;

// Инициализация специальных элементов трассы
let trackElements = [];
if (track.elements && track.elements.length > 0) {
  trackElements = track.elements;
} else {
  // Резервная инициализация, если элементов нет
  trackElements = [];
}

// ==================== СОСТОЯНИЕ ИГРЫ ====================
window.state = {
  isPlaying: false,
  startTime: 0,
  bestTime: null,
  lap: 1,
  maxLaps: 3
};

// Система отсчёта кругов (создаём сразу, не зависит от модели)
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
  scene
);

// HUD (создаём сразу, не зависит от модели)
window.hud = new HUD();

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
  window.botManager.reset();
  if (window.itemSystem) {
    window.itemSystem.clear();
    // Spawn 18 items instead of maxTrackItems for more variety on the map
    for (let i = 0; i < 18; i++) {
      window.itemSystem.spawnItem(track.segments);
    }
  }
  if (window.effectsPool) {
    window.effectsPool.clear();
  }
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
  if (window.itemSystem) {
    window.itemSystem.clear();
  }
  if (window.effectsPool) {
    window.effectsPool.clear();
  }
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

  // Создаём машину игрока (колёса встроены в GLTF модель)
  const carMesh = createCarMesh();
  
  // Перекрашиваем машину игрока в синий цвет с белой кабиной
  recolorCarModel(carMesh, 0x2266ff, 0x333333);
  
  scene.add(carMesh);

  const wheelMeshes = []; // Пустой массив — колёса есть в модели

  const { chassisBody, vehicle } = createCarPhysics(world, wheelMat);
  window.car = new CarController(chassisBody, vehicle, carMesh, wheelMeshes);
  window.car.reset(track.spawnPos, track.spawnRot);

  // Создаём AI-ботов (случайные позиции на трассе, свои чекпоинты)
  window.botManager = new BotManager(scene, world, wheelMat, track.segments);
  window.botManager.spawnBots(7); // Increased from 5 to 7 bots

  // Создаём систему предметов (как в Revolt!)
  window.itemSystem = new ItemSystem(scene);
  // Создаём пул эффектов для оптимизации
  window.effectsPool = new EffectsPool(scene);
  // Спавним больше предметов (увеличено с 6 до 12)
  for (let i = 0; i < 12; i++) {
    window.itemSystem.spawnItem(track.segments);
  }

  // Ввод
  const input = new InputManager();
  input.onUpdate((state) => { window.car.input = state; });

  // Кнопка использования предмета на мобильных (бывшая reverse)
  input.onUseItem(() => {
    if (window.state.isPlaying && window.itemSystem && window.car) {
      const itemType = window.itemSystem.useItem();
      if (itemType) {
        const result = window.itemSystem.applyItemEffect(itemType, window.car);
        console.log(result.message);
      }
    }
  });

  // Telegram
  initTelegram();

  // ==================== ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ПРИ ИСПОЛЬЗОВАНИИ ПРЕДМЕТОВ ====================

  // ==================== ОПРЕДЕЛЕНИЕ МОБИЛЬНОГО УСТРОЙСТВА ====================
  function createItemEffect(itemType, carMesh) {
    if (!window.particleSystem || !window.effectsPool) return;

    const position = carMesh.position.clone();
    position.y += 1;
    
    switch (itemType) {
      case 'boost':
        // Эффект ускорения - светящиеся частицы
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 0.5 + Math.random() * 0.5;
          const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          window.particleSystem.emitExhaust(
            position.clone().add(dir.multiplyScalar(distance)),
            dir,
            0.5 + Math.random() * 0.5
          );
        }
        break;
        
      case 'superboost':
        // Мощный эффект ускорения
        for (let i = 0; i < 50; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 0.5 + Math.random() * 1.0;
          const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          window.particleSystem.emitExhaust(
            position.clone().add(dir.multiplyScalar(distance)),
            dir,
            1.0 + Math.random() * 1.0
          );
        }
        // Вспышка через пул эффектов
        window.effectsPool.createFlash(position, 0xffff00, 0.2, 1.5);
        break;
        
      case 'shield':
        // Эффект щита - светящееся кольцо
        window.effectsPool.createRing(position, 0x00ffff, 1.0);
        break;
        
      case 'rocket':
        // Эффект ракеты - вспышка через пул эффектов
        window.effectsPool.createFlash(position, 0xff4400, 0.3, 2);
        break;
        
      case 'mine':
        // Эффект мины - вспышка через пул эффектов
        window.effectsPool.createFlash(position, 0xff8800, 0.5, 1.2);
        break;
        
      case 'oil':
        // Эффект масла - облако частиц
        for (let i = 0; i < 25; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          window.particleSystem.emitSmoke(
            position.clone(),
            dir,
            5
          );
        }
        break;
    }
  }

  // Показать мобильные контролы, если это мобильное устройство
  const mobileControls = document.getElementById('mobile-controls');

  if (isMobileDevice()) {
    // Показываем мобильные контролы
    mobileControls.style.display = 'block';
    
    // Перемещаем индикатор предмета вниз по центру на мобильных
    document.getElementById('item-indicator').classList.add('mobile-item');
    
    // Визуальная обратная связь для кнопок (active-класс)
    const btnIds = ['btn-left', 'btn-right', 'btn-gas', 'btn-brake', 'btn-reverse'];
    for (const id of btnIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('touchstart', () => el.classList.add('active'), { passive: false });
      el.addEventListener('touchend', () => el.classList.remove('active'), { passive: false });
    }

    // Убедимся, что кнопка переворота отображается
    flipBtn.style.display = 'block';
  } else {
    // На десктопе скрываем мобильные контролы
    mobileControls.style.display = 'none';
  }

  // Добавляем обработчики для кнопки переворота
  flipBtn.addEventListener('click', () => {
    if (window.state.isPlaying) window.car.flipOver();
  });
  flipBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (window.state.isPlaying) window.car.flipOver();
  }, { passive: false });

  // Обработчик нажатия на индикатор предмета (использование итема на мобильных)
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
  // На мобильных уменьшаем дистанцию и высоту камеры
  const isMobile = isMobileDevice();
  const camDistance = isMobile ? CONFIG.camera.distance * 0.65 : CONFIG.camera.distance;
  const camHeight   = isMobile ? CONFIG.camera.height   * 0.65 : CONFIG.camera.height;
  const speedZoom   = isMobile ? CONFIG.camera.speedZoomFactor * 0.5 : CONFIG.camera.speedZoomFactor;

  // Направление "назад" от машины (учитываем поворот)
  const back = new THREE.Vector3(0, 0, 1); // "назад" в локальных координатах
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

// ==================== ПЕРЕВОРОТ МАШИНЫ ====================

const flipBtn = document.getElementById('flip-btn');

// Клавиша R — перевернуть
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && window.state.isPlaying) {
    window.car.flipOver();
  }
  // Клавиша Ctrl — использовать предмет
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    if (window.state.isPlaying && window.itemSystem && window.car) {
      const itemType = window.itemSystem.useItem();
      if (itemType) {
        const result = window.itemSystem.applyItemEffect(itemType, window.car);
        console.log(result.message);
      }
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

// ==================== ПРОВЕРКА СТОЛКНОВЕНИЙ С ОСОБЫМИ ЭЛЕМЕНТАМИ ТРАССЫ ====================

function checkSpecialTrackCollisions(carPos, carBody) {
  // Проверка столкновений со всеми специальными элементами трассы
  if (trackElements && trackElements.length > 0) {
    for (const element of trackElements) {
      // Пропускаем элементы без физического тела
      if (!element.physics) continue;
      
      const dist = carPos.distanceTo(element.visual.position);
      
      // Проверяем тип элемента и обрабатываем столкновение
      if (element.type === 'ramp' && dist < element.physics.collisionRadius) {
        const carDirection = new THREE.Vector3();
        carBody.vectorToWorldFrame(new THREE.Vector3(0, 0, -1), carDirection);
        const toElement = new THREE.Vector3().subVectors(element.visual.position, carPos).normalize();
        
        // Если машина движется в направлении элемента
        if (carDirection.dot(toElement) > 0.7) {
          // Добавляем импульс прыжка
          carBody.applyImpulse(
            new CANNON.Vec3(
              0, 
              element.physics.bounceFactor * 200, 
              0
            ),
            carBody.position
          );
          
          // Создаем визуальный эффект при использовании трамплина
          createItemEffect('jump', element.visual.position);
        }
      }
      
      // Обработка столкновения с петлями
      if (element.type === 'loop' && dist < element.physics.collisionRadius) {
        // Добавляем небольшой импульс вверх при прохождении через петлю
        carBody.applyImpulse(
          new CANNON.Vec3(0, element.physics.bounceFactor * 50, 0),
          carBody.position
        );
        
        // Визуальный эффект при прохождении через петлю
        createItemEffect('loop', element.visual.position);
      }
      
      // Обработка столкновения с туннелями
      if (element.type === 'tunnel' && dist < element.physics.collisionRadius) {
        // Уменьшаем сопротивление воздуха при нахождении в туннеле
        const dragFactor = 0.5; // Коэффициент уменьшения сопротивления
        const currentVelocity = carBody.velocity.clone();
        currentVelocity.scale(dragFactor, currentVelocity);
        carBody.velocity.copy(currentVelocity);
        
        // Визуальный эффект при входе в туннель
        createItemEffect('tunnel', element.visual.position);
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
  window.botManager.reset();
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

  if (window.state.isPlaying && window.car && window.botManager && window.hud) {
    world.step(1 / 60, dt, CONFIG.physics.substeps);
    window.car.update();
    window.botManager.update(dt);

    // Проверка столкновений ботов с минами
    if (window.itemSystem) {
      for (const bot of window.botManager.bots) {
        const botPos = bot.controller.chassisBody.position;
        window.itemSystem.checkMineCollisions(bot.controller, () => {  // Pass bot controller instead of position
          // Бот попал на мину - переворачиваем
          bot.controller.flipOver();
          // Сбрасываем скорость
          bot.controller.chassisBody.velocity.set(0, 0, 0);
          bot.controller.chassisBody.angularVelocity.set(0, 0, 0);
        });
      }
    }
    updateCamera();
    window.hud.update(window.car, window.state, window.lapCounter);

    // Обновляем систему частиц
    particleSystem.update(dt);

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

    // Проверка столкновений с препятствиями
    checkObstacleCollisions(window.car.mesh.position);

    // Проверка столкновений со специальными элементами трассы
    checkSpecialTrackCollisions(carPos, window.car.chassisBody);

    // Обновление счётчика кругов
    if (window.lapCounter) {
      window.lapCounter.update(window.car.mesh.position);
      
      // Передаём следующую контрольную точку для стрелки направления
      window.car.mesh.userData.nextCheckpoint = window.lapCounter.getNextCheckpoint();
    }

    // Обновление системы предметов
    if (window.itemSystem) {
      window.itemSystem.update(dt, track.segments);
      // Проверка сбора предметов
      window.itemSystem.checkItemCollection(window.car.mesh.position);
      // Проверка столкновений с минами
      window.itemSystem.checkMineCollisions(window.car, () => {  // Pass car object instead of position
        // Игрок попал на мину - переворачиваем машину
        window.car.flipOver();
        // Сбрасываем скорость
        window.car.chassisBody.velocity.set(0, 0, 0);
        window.car.chassisBody.angularVelocity.set(0, 0, 0);
      });
    }

    // Обновляем пул эффектов
    if (window.effectsPool) {
      window.effectsPool.update(dt);
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