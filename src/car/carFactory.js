import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { loadCarModel, createFallbackCarModel } from './carModelLoader.js';
import { CONFIG } from '../engine/config.js';

let carModelCache = null; // Кэш загруженной модели
let modelLoadCallback = null; // Callback когда модель загрузится

/**
 * Асинхронная загрузка модели машины.
 * Вызывается ОДНОКратно при старте игры.
 */
export function preloadCarModel(path, onLoaded) {
  if (carModelCache) {
    onLoaded(carModelCache);
    return;
  }

  modelLoadCallback = onLoaded;

  loadCarModel(
    path,
    (model) => {
      carModelCache = model;
      if (modelLoadCallback) modelLoadCallback(model);
    },
    (progress) => {
      console.log(`🚗 Загрузка модели: ${Math.round(progress)}%`);
    }
  );
}

/**
 * Создаёт визуальную модель машины (из загруженной или fallback).
 */
export function createCarMesh() {
  // Контейнер: его position/quaternion синхронизируется с физикой.
  // Внутренняя модель повёрнута на 180° — капотом вперёд по ходу движения.
  const container = new THREE.Group();

  let model;
  if (carModelCache) {
    model = carModelCache.clone();
  } else {
    model = createFallbackCarModel();
  }

  model.rotation.y = Math.PI; // Разворачиваем модель: капот вперёд
  container.add(model);

  return container;
}

/**
 * Создаёт визуальные колёса.
 */
export function createWheelMeshes() {
  const geo = new THREE.CylinderGeometry(
    CONFIG.car.wheelRadius,
    CONFIG.car.wheelRadius,
    0.3,
    16
  );
  const mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.wheel });
  const meshes = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    meshes.push(mesh);
  }
  return meshes;
}

/**
 * Создаёт физическое тело машины (Cannon.js RaycastVehicle).
 */
export function createCarPhysics(world, wheelMat) {
  const cfg = CONFIG.car;

  // Шасси
  const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.25, 2));
  const chassisBody = new CANNON.Body({ mass: cfg.mass });
  // Сдвиг центра масс: ниже и чуть назад для стабильности
  chassisBody.addShape(chassisShape, new CANNON.Vec3(0, -0.3, -0.2));
  chassisBody.angularDamping = 0.8;  // значительно увеличено

  // Автомобиль
  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2
  });

  const wheelOptions = {
    radius: cfg.wheelRadius,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: cfg.suspensionStiffness * 1.5,  // увеличено для жёсткости
    suspensionRestLength: 0.3,
    frictionSlip: cfg.wheelFriction,
    dampingRelaxation: cfg.dampingRelaxation * 1.5,  // увеличено для стабильности
    dampingCompression: cfg.dampingCompression * 2.0,  // значительно увеличено
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,  // минимальное для стабильности
    axleLocal: new CANNON.Vec3(1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
    maxSuspensionTravel: 0.2,  // уменьшен ход подвески
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  };

  const axleW = 0.8;
  const frontZ = 1.6;   // передняя ось дальше от центра → больше колёсная база
  const rearZ = -1.2;   // задняя ось чуть ближе к центру
  const connY = -0.1;

  // Передние колёса (индексы 0, 1) — поворотные
  wheelOptions.chassisConnectionPointLocal.set(axleW, connY, frontZ);
  vehicle.addWheel(wheelOptions);

  wheelOptions.chassisConnectionPointLocal.set(-axleW, connY, frontZ);
  vehicle.addWheel(wheelOptions);

  // Задние колёса (индексы 2, 3) — ведущие
  wheelOptions.chassisConnectionPointLocal.set(axleW, connY, rearZ);
  vehicle.addWheel(wheelOptions);

  wheelOptions.chassisConnectionPointLocal.set(-axleW, connY, rearZ);
  vehicle.addWheel(wheelOptions);

  // В cannon-es v0.20.0 RaycastVehicle сам добавляет listener
  // `preStep` при `addWheel`, но в нашей версии не удаляется при
  // удалении тела. Вместо того чтобы использовать внутренний `_update`
  // (который может отсутствовать в некоторых сборках) просто
  // добавляем саму транспортную машину в world, а обработчик будет
  // управляться библиотекой.
  vehicle.addToWorld(world);

  return { chassisBody, vehicle };
}
