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

  // Создаём точки спавна по кругу
  const spawnPoints = [];
  const spawnRadius = 80;
  
  for (let i = 0; i < segmentCount; i++) {
    const angle = (i / segmentCount) * Math.PI * 2;
    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;
    spawnPoints.push({
      position: new THREE.Vector3(x, 1.5, z),
      rotation: angle
    });
  }

  // Создаём препятствия
  const obstacles = []; // Initialize empty obstacles array since obstacles were removed
  // Removed obstacles (barrels, crates, containers) as requested

  // Создаём специальные элементы трассы
  const trackElements = [];
  
  // Трамплины
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 40;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    const rampGeometry = new THREE.BoxGeometry(8, 1, 12);
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.7,
      metalness: 0.3
    });
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.set(x, 0.5, z);
    ramp.rotation.y = Math.random() * Math.PI * 2;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    
    trackGroup.add(ramp);
    
    // Физика для трамплина
    const rampShape = new CANNON.Box(new CANNON.Vec3(4, 0.5, 6));
    const rampBody = new CANNON.Body({
      mass: 0,
      shape: rampShape,
      position: new CANNON.Vec3(x, 0.5, z)
    });
    world.addBody(rampBody);
    
    trackElements.push({
      type: 'ramp',
      visual: ramp,
      physics: rampBody,
      collisionRadius: 6,
      bounceFactor: 1.5
    });
  }
  
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
  
  // Туннели
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 20;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    const tunnelGeometry = new THREE.CylinderGeometry(6, 6, 15, 16);
    const tunnelMaterial = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      roughness: 0.2,
      metalness: 0.8,
      side: THREE.DoubleSide
    });
    const tunnel = new THREE.Mesh(tunnelGeometry, tunnelMaterial);
    tunnel.position.set(x, 7.5, z);
    tunnel.rotation.y = Math.random() * Math.PI * 2;
    tunnel.castShadow = true;
    tunnel.receiveShadow = true;
    
    trackGroup.add(tunnel);
    
    // Физика для туннеля
    const tunnelShape = new CANNON.Box(new CANNON.Vec3(6, 7.5, 7.5));
    const tunnelBody = new CANNON.Body({
      mass: 0,
      shape: tunnelShape,
      position: new CANNON.Vec3(x, 7.5, z)
    });
    world.addBody(tunnelBody);
    
    trackElements.push({
      type: 'tunnel',
      visual: tunnel,
      physics: tunnelBody,
      collisionRadius: 8,
      bounceFactor: 0.8
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

  // Возвращаем все необходимые данные
  return {
    segments: segments,
    spawnPoints: spawnPoints,
    obstacles: obstacles,
    elements: trackElements,
    spawnPos: new THREE.Vector3(0, 1.5, 0),
    spawnRot: new THREE.Vector3(0, 0, 0)
  };
}