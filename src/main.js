import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // Импортируем GLTFLoader
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

// Передаём scene в particleSystem
particleSystem.setScene(scene);

// ==================== ИНИЦИАЛИЗАЦИЯ КАМЕРЫ ====================
// Устанавливаем начальную позицию камеры, чтобы избежать черного экрана
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const { world, groundMat, wheelMat } = createPhysicsWorld();

// Трасса и окружение
const track = createTrack(scene, world);
const environment = createEnvironment(scene, world);

// Храним препятствия для проверки столкновений
const obstacles = [...track.obstacles, ...environment.obstacles];
// Делаем препятствия доступными для ботов
window.obstacles = obstacles;

// Инициализация специальных элементов трассы
let trackElements = [];
if (track.elements && track.elements.length > 0) {
  trackElements = track.elements;
} else {
  // Резервная инициализация, если элементов нет
  trackElements = [];
}

// Создаем путь для поезда (из центра на периметр и обратно)
const trainPath = [
  new THREE.Vector3(0, 0, 0), // Центр карты
  new THREE.Vector3(-100, 0, -100),
  new THREE.Vector3(100, 0, -100),
  new THREE.Vector3(100, 0, 100),
  new THREE.Vector3(-100, 0, 100),
  new THREE.Vector3(0, 0, 0) // Возвращаемся в центр
];

let train = null; // Инициализируем поезд после загрузки модели

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
  scene,
  track.spawnRot
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
  window.car.reset(track.spawnPos, track.spawnRot.y);
  window.botManager.reset();
  if (train) train.reset();
  if (window.itemSystem) {
    window.itemSystem.clear();
    // Spawn 60 items on the expanded map
    for (let i = 0; i < 60; i++) {
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

// Загружаем модель поезда
const trainLoader = new GLTFLoader();
trainLoader.load(
  '/models/train/train.glb',
  (gltf) => {
    console.log('Модель поезда загружена');
    loadingText.textContent = '✅ Модель поезда загружена!';
    loadingProgress.style.width = '100%';
    loadingText.style.color = '#4ade80';

    // Создаем поезд после загрузки модели
    train = new MovingTrain(scene, world, trainPath, gltf.scene);

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

  // Показываем кнопку, если поезд тоже загружен
  if (train) {
    setTimeout(() => {
      startBtn.style.display = 'block';
      loadingText.style.display = 'none';
      document.getElementById('loading-bar').style.display = 'none';
    }, 800);
  }

  // Создаём машину игрока (колёса встроены в GLTF модель)
  const carMesh = createCarMesh();
  
  // Перекрашиваем машину игрока в синий цвет с белой кабиной
  recolorCarModel(carMesh, 0x2266ff, 0x333333);
  
  scene.add(carMesh);

  const wheelMeshes = []; // Пустой массив — колёса есть в модели

  const { chassisBody, vehicle } = createCarPhysics(world, wheelMat);
  window.car = new CarController(chassisBody, vehicle, carMesh, wheelMeshes);
  window.car.reset(track.spawnPos, track.spawnRot.y);

  // Создаём AI-ботов (позиции по кругу, свои чекпоинты)
  window.botManager = new BotManager(scene, world, wheelMat, track.segments, track.spawnPoints);
  window.botManager.spawnBots(7); // Increased from 5 to 7 bots

  // Создаём систему предметов (как в Revolt!)
  window.itemSystem = new ItemSystem(scene);
  // Создаём пул эффектов для оптимизации
  window.effectsPool = new EffectsPool(scene);
  // Спавним максимальное количество предметов сразу
  for (let i = 0; i < 60; i++) {
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
      // Простой эффект для элементов трассы
      window.effectsPool.createFlash(pos, 0x00ff88, 0.2, 1);
      break;
  }
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

  // Блокировка Ctrl+D (добавить в избранное), Ctrl+S (сохранить страницу), Ctrl+A (выделить всё) и Ctrl+W (закрыть окно) во время игры
  if (window.state.isPlaying && (e.ctrlKey || e.metaKey)) { // e.metaKey для Cmd на Mac
    if (e.code === 'KeyD' || e.code === 'KeyS' || e.code === 'KeyA' || e.code === 'KeyW') {
      e.preventDefault(); // Отменяем действие браузера
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
      
      // Отталкивающий импульс для машины — разная сила для разных препятствий
      if (window.car && window.car.chassisBody) {
        let pushForce = 8; // по умолчанию слабый толчок
        const type = obstacle.userData && obstacle.userData.type;
        if (type === 'container') pushForce = 12; // контейнеры — средний толчок
        else if (type === 'barrel') pushForce = 6;  // бочки — слабый толчок
        else if (type === 'crate') pushForce = 10;  // ящики — чуть сильнее бочек
        
        window.car.chassisBody.velocity.x += impactDir.x * pushForce;
        window.car.chassisBody.velocity.z += impactDir.z * pushForce;
        // Небольшой подброс вверх
        window.car.chassisBody.velocity.y = Math.max(window.car.chassisBody.velocity.y, 2);
      }
      
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
  if (!trackElements || trackElements.length === 0) return;
  
  for (const element of trackElements) {
    // Пропускаем элементы без физического тела или визуала
    if (!element.physics || !element.visual) continue;
    
    try {
      const dist = carPos.distanceTo(element.visual.position);
      
      // Проверяем тип элемента и обрабатываем столкновение
      if (element.type === 'ramp' && dist < element.physics.collisionRadius) {
        // Получаем направление машины через THREE.js кватернион
        const carDirection = new THREE.Vector3(0, 0, -1);
        carDirection.applyQuaternion(carBody.quaternion);
        carDirection.normalize();
        
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
        const dragFactor = 0.5;
        const currentVelocity = carBody.velocity.clone();
        currentVelocity.scale(dragFactor, currentVelocity);
        carBody.velocity.copy(currentVelocity);
        
        // Визуальный эффект при входе в туннель
        createItemEffect('tunnel', element.visual.position);
      }
    } catch (err) {
      console.error('Error in track element collision:', err);
    }
  }
}
    
// Коллбэк для столкновения с поездом
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
  // reset with rotation angle only
  window.car.reset(track.spawnPos, track.spawnRot.y);
  window.botManager.reset();
  if (train) train.reset();
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
// Разделяем логику на обязательную (каждый кадр) и фоновую (не каждый кадр)
// чтобы избежать Violation: handler took 155ms

const clock = new THREE.Clock();
let _frameCount = 0;

// Колл-бэки для коллизий (создаём один раз, не засоряем стек)
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
    // === КАЖДЫЙ КАДР (обязательно) ===
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

    // === Проверка выхода за границы карты (каждый кадр) ===
    const carPos = window.car.mesh.position;
    const teleportRadius = 120; // чуть больше половины размера арены (217/2 ≈ 108.5)
    if (carPos.x * carPos.x + carPos.z * carPos.z > teleportRadius * teleportRadius || carPos.y < -20) {
      // Телепорт обратно в центр
      window.car.reset(track.spawnPos, track.spawnRot.y);
      window.car.chassisBody.velocity.set(0, 0, 0);
      window.car.chassisBody.angularVelocity.set(0, 0, 0);
      console.log('🔄 Машина вышла за границы карты — телепорт в центр');
    }

    // === ЧЕРЕЗ КАДР (проверки коллизий) ===
    if (_frameCount % 2 === 0) {
      if (window.itemSystem) {
        // Проверка столкновений ботов (только каждый 2й кадр)
        for (const bot of window.botManager.bots) {
          window.itemSystem.checkMineCollisions(bot.controller, onMineHitBot(bot));
          window.itemSystem.checkOilCollisions(bot.controller, onOilHitBot(bot));
          window.itemSystem.checkBallCollisions(bot.controller, onBallHitBot);
        }
        
        // Проверка столкновений игрока
        window.itemSystem.checkMineCollisions(window.car, onMineHitPlayer);
        window.itemSystem.checkOilCollisions(window.car, onOilHitPlayer);
        window.itemSystem.checkBallCollisions(window.car, onBallHitPlayer);
      }

      // Проверка столкновений с препятствиями — редко, только рядом с игроком
      checkObstacleCollisions(window.car.mesh.position);
      checkSpecialTrackCollisions(window.car.mesh.position.clone(), window.car.chassisBody);

      // Проверка столкновений с поездом
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

    // === КАЖДЫЙ КАДР (предметы) ===
    if (window.itemSystem) {
      const trackSegments = track && track.segments ? track.segments : [];
      window.itemSystem.update(dt, trackSegments);
      window.itemSystem.checkItemCollection(window.car.mesh.position);
    }

    // === КАЖДЫЙ КАДР (визуал) ===
    particleSystem.update(dt);

    // Эффекты выхлопа
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

    // LapCounter каждый кадр
    if (window.lapCounter) {
      window.lapCounter.update(window.car.mesh.position);
      window.car.mesh.userData.nextCheckpoint = window.lapCounter.getNextCheckpoint();
    }

    // EffectsPool каждый 2й кадр
    if (window.effectsPool && _frameCount % 2 === 0) {
      window.effectsPool.update(dt);
    }

    // Обновление поезда
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
