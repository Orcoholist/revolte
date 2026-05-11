import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

/**
 * Создаёт трассу с препятствиями и элементами окружения.
 */
export function createTrack(scene, world) {
  const trackGroup = new THREE.Group();
  const physicsGroup = new THREE.Group();
  scene.add(trackGroup);

  // Создаём основную поверхность трассы
  const trackGeometry = new THREE.PlaneGeometry(217, 217, 50, 50);
  const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2
  });
  const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
  trackMesh.rotation.x = -Math.PI / 2;
  trackMesh.receiveShadow = true;
  trackGroup.add(trackMesh);

  // Создаём физическое тело для трассы
  const trackShape = new CANNON.Box(new CANNON.Vec3(217 / 2, 0.1, 217 / 2));
  const trackBody = new CANNON.Body({
    mass: 0,
    shape: trackShape,
    position: new CANNON.Vec3(0, -0.1, 0)
  });
  world.addBody(trackBody);
  physicsGroup.add(trackMesh);

  // Создаём сегменты трассы (для навигации ботов)
  const segments = [];
  const segmentCount = 16;
  const radius = 100;
  
  for (let i = 0; i < segmentCount; i++) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    segments.push(new THREE.Vector3(x, 0, z));
  }

  // Создаём точки спавна по кругу вокруг центра (радиус 40)
  const spawnPoints = [];
  const spawnRadius = 40;
  
  for (let i = 0; i < segmentCount; i++) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;
    spawnPoints.push({
      position: new THREE.Vector3(x, 1.5, z),
      rotation: angle // смотрит в центр (к поезду)
    });
  }

  // Создаём препятствия
  const obstacles = [];

  // Создаём специальные элементы трассы
  const trackElements = [];
  
  // Трамплины удалены (квадратные лежачие панели)
  
  // Петли
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 30;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    const loopGeometry = new THREE.TorusGeometry(8, 2, 8, 20);
    const loopMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      roughness: 0.3,
      metalness: 0.7
    });
    const loop = new THREE.Mesh(loopGeometry, loopMaterial);
    loop.position.set(x, 8, z);
    loop.castShadow = true;
    loop.receiveShadow = true;
    
    trackGroup.add(loop);
    
    // Физика для петли
    const loopShape = new CANNON.Box(new CANNON.Vec3(8, 2, 8));
    const loopBody = new CANNON.Body({
      mass: 0,
      shape: loopShape,
      position: new CANNON.Vec3(x, 8, z)
    });
    world.addBody(loopBody);
    
    trackElements.push({
      type: 'loop',
      visual: loop,
      physics: loopBody,
      collisionRadius: 10,
      bounceFactor: 1.2
    });
  }
  
  // Создаём декоративные элементы
  for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 50;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    // Деревья
    const treeGeometry = new THREE.ConeGeometry(3, 8, 8);
    const treeMaterial = new THREE.MeshStandardMaterial({
      color: 0x228B22,
      roughness: 0.8,
      metalness: 0.1
    });
    const tree = new THREE.Mesh(treeGeometry, treeMaterial);
    tree.position.set(x, 4, z);
    tree.castShadow = true;
    tree.receiveShadow = true;
    trackGroup.add(tree);
    
    // Физика для деревьев
    const treeShape = new CANNON.Box(new CANNON.Vec3(1.5, 4, 1.5));
    const treeBody = new CANNON.Body({
      mass: 0,
      shape: treeShape,
      position: new CANNON.Vec3(x, 4, z)
    });
    world.addBody(treeBody);
  }

  // Создаём железную дорогу (кольцо из рельсов вокруг центра)
  const railRadius = 30;
  const railSegments = 32;
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.6,
    metalness: 0.8
  });
  const railGroup = new THREE.Group();
  
  for (let i = 0; i < railSegments; i++) {
    const angle = (i / railSegments) * Math.PI * 2;
    const nextAngle = ((i + 1) / railSegments) * Math.PI * 2;
    
    const x1 = Math.cos(angle) * railRadius;
    const z1 = Math.sin(angle) * railRadius;
    const x2 = Math.cos(nextAngle) * railRadius;
    const z2 = Math.sin(nextAngle) * railRadius;
    
    // Рельс — тонкий длинный прямоугольник между двумя точками
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const angleY = Math.atan2(z2 - z1, x2 - x1);
    
    const railPiece = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.1, 0.3),
      railMaterial
    );
    railPiece.position.set(midX, 0.05, midZ);
    railPiece.rotation.y = -angleY;
    railPiece.castShadow = true;
    railPiece.receiveShadow = true;
    railGroup.add(railPiece);
    
    // Шпалы (поперечные бруски)
    const sleeper = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.1, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 })
    );
    sleeper.position.set(midX, 0.05, midZ);
    sleeper.rotation.y = -angleY + Math.PI / 2;
    sleeper.castShadow = true;
    sleeper.receiveShadow = true;
    railGroup.add(sleeper);
  }
  
  trackGroup.add(railGroup);

  // Точка спавна игрока на круге радиусом 40, угол 0 (ось X+)
  const spawnRadiusPlayer = 40;
  const spawnAnglePlayer = 0;
  const spawnPosPlayer = new THREE.Vector3(
    Math.cos(spawnAnglePlayer) * spawnRadiusPlayer,
    1.5,
    Math.sin(spawnAnglePlayer) * spawnRadiusPlayer
  );
  const spawnRotPlayer = new THREE.Vector3(0, spawnAnglePlayer, 0); // смотрит в центр (к поезду)

  // Возвращаем все необходимые данные
  return {
    segments: segments,
    spawnPoints: spawnPoints,
    obstacles: obstacles,
    elements: trackElements,
    spawnPos: spawnPosPlayer,
    spawnRot: spawnRotPlayer
  };
}
