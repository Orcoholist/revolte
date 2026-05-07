import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

/**
 * Земля, деревья, ограждения — всё, что не трасса.
 * Каждый объект имеет И визуал (Three.js), И физику (Cannon.js).
 */
export function createEnvironment(scene, world) {
  createGround(scene);
  createTrees(scene, world);
  createBarriers(scene, world);
}

function createGround(scene) {
  const geo = new THREE.PlaneGeometry(CONFIG.world.size, CONFIG.world.size);
  const mat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.ground,
    roughness: 0.9
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

function createTrees(scene, world) {
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.tree.trunk });

  const leavesGeo = new THREE.ConeGeometry(3, 7, 8);
  const leavesMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.tree.leaves });

  const positions = [];
  
  // Генерируем деревья вокруг трассы
  for (let i = 0; i < 80; i++) {
    const x = -50 + Math.random() * 280;
    const z = -180 + Math.random() * 240;
    
    // Исключаем зоны трассы (приблизительно)
    const onTrack = (
      (x > -20 && x < 200 && z > -170 && z < 50) ||
      Math.abs(x - 150) < 30 && Math.abs(z + 100) < 50 ||
      Math.abs(x - 60) < 30 && Math.abs(z - 80) < 50
    );
    
    if (!onTrack) {
      positions.push({ x, z });
    }
  }

  for (const pos of positions) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, 2, pos.z);
    trunk.castShadow = true;
    scene.add(trunk);

    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(pos.x, 7, pos.z);
    leaves.castShadow = true;
    scene.add(leaves);

    const treeBody = new CANNON.Body({ mass: 0 });
    treeBody.addShape(new CANNON.Cylinder(0.6, 0.8, 4, 8));
    treeBody.position.set(pos.x, 2, pos.z);
    world.addBody(treeBody);
  }
  
  // Добавляем камни как декорации
  createRocks(scene, world);
}

function createRocks(scene, world) {
  const rockMat = new THREE.MeshStandardMaterial({ 
    color: 0x666666,
    roughness: 0.9
  });
  
  const rockPositions = [
    [-30, 0.5, -50], [-40, 0.7, -120], [200, 0.6, -80],
    [210, 0.8, -140], [-20, 0.5, 10], [180, 0.6, 20]
  ];

  for (const pos of rockPositions) {
    const size = 0.8 + Math.random() * 0.7;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(size, 0),
      rockMat
    );
    rock.position.set(pos[0], pos[1], pos[2]);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    
    const rockBody = new CANNON.Body({ mass: 0 });
    rockBody.addShape(new CANNON.Sphere(size * 0.7));
    rockBody.position.set(pos[0], pos[1], pos[2]);
    world.addBody(rockBody);
  }
}

function createBarriers(scene, world) {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
  const wallH = 1.5;
  const wallT = 0.5;

  // Внешние барьеры по периметру трассы
  const walls = [
    // Верхняя граница
    { pos: [90, wallH / 2, -180], size: [220, wallH, wallT] },
    // Нижняя граница
    { pos: [90, wallH / 2, 60], size: [220, wallH, wallT] },
    // Левая граница
    { pos: [-30, wallH / 2, -60], size: [wallT, wallH, 280] },
    // Правая граница
    { pos: [210, wallH / 2, -60], size: [wallT, wallH, 280] }
  ];

  for (const w of walls) {
    const geo = new THREE.BoxGeometry(...w.size);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(...w.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w.size[0] / 2, w.size[1] / 2, w.size[2] / 2)));
    body.position.set(...w.pos);
    world.addBody(body);
  }
  
  // Добавляем пропеллеры/ветряки как декорации
  createWindmills(scene, world);
  
  // Дополнительные декорации
  createFlags(scene);
  createBillboards(scene);
  createTires(scene, world);
  createBarrels(scene, world);
  createGravelTraps(scene);
}

function createWindmills(scene, world) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  
  const positions = [[-40, 15, -100], [200, 15, -120], [180, 12, 20]];
  
  for (const pos of positions) {
    // Столб
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.5, 15, 8),
      poleMat
    );
    pole.position.set(pos[0], 7.5, pos[2]);
    pole.castShadow = true;
    scene.add(pole);
    
    // Лопастная часть
    const blades = new THREE.Group();
    blades.position.set(pos[0], 15, pos[2]);
    
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 6, 0.1),
        bladeMat
      );
      blade.rotation.y = (i * Math.PI) / 2;
      blades.add(blade);
    }
    
    scene.add(blades);
    
    // Физика столба
    const poleBody = new CANNON.Body({ mass: 0 });
    poleBody.addShape(new CANNON.Cylinder(0.5, 0.7, 15, 8));
    poleBody.position.set(pos[0], 7.5, pos[2]);
    world.addBody(poleBody);
  }
}

/**
 * Создаёт флаги вдоль трассы
 */
function createFlags(scene) {
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
  const flagMat2 = new THREE.MeshStandardMaterial({ color: 0x4444ff });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  
  const flagPositions = [
    [-25, -60], [-20, -40], [205, -120], [195, -100],
    [100, -175], [80, -175], [160, 30], [140, 30]
  ];
  
  for (const pos of flagPositions) {
    // Шест
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 5, 6),
      poleMat
    );
    pole.position.set(pos[0], 2.5, pos[1]);
    scene.add(pole);
    
    // Флаг
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.7),
      Math.random() > 0.5 ? flagMat : flagMat2
    );
    flag.position.set(pos[0] + 0.6, 3.5, pos[1]);
    flag.rotation.y = -Math.PI / 6 + Math.random() * 0.3;
    scene.add(flag);
  }
}

/**
 * Создаёт рекламные щиты
 */
function createBillboards(scene) {
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x222244 });
  const boardFrame = new THREE.MeshStandardMaterial({ color: 0x888888 });
  
  // Разные цвета для рекламы
  const adColors = [0xff4444, 0x44ff44, 0xffff44, 0xff44ff, 0x44ffff];
  
  const billboardPositions = [
    { pos: [-10, 0, -160], rot: 0, color: adColors[0] },
    { pos: [190, 0, -160], rot: Math.PI, color: adColors[1] },
    { pos: [-10, 0, 40], rot: 0, color: adColors[2] },
    { pos: [190, 0, 40], rot: Math.PI, color: adColors[3] },
    { pos: [100, 0, -185], rot: Math.PI / 2, color: adColors[4] },
    { pos: [100, 0, 65], rot: -Math.PI / 2, color: adColors[0] }
  ];
  
  for (const bp of billboardPositions) {
    const group = new THREE.Group();
    group.position.set(bp.pos[0], 0, bp.pos[2]);
    group.rotation.y = bp.rot;
    
    // Стойки
    const pillarGeo = new THREE.CylinderGeometry(0.1, 0.15, 3, 6);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    
    const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
    pillarL.position.set(-2, 1.5, 0);
    group.add(pillarL);
    
    const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
    pillarR.position.set(2, 1.5, 0);
    group.add(pillarR);
    
    // Рекламная панель
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 2, 0.3),
      boardMat
    );
    panel.position.y = 3;
    group.add(panel);
    
    // Яркая вставка (реклама)
    const adMat = new THREE.MeshBasicMaterial({
      color: bp.color,
      transparent: true,
      opacity: 0.6
    });
    const ad = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 1.2),
      adMat
    );
    ad.position.set(0, 3, 0.16);
    group.add(ad);
    
    scene.add(group);
  }
}

/**
 * Создаёт стопки шин
 */
function createTires(scene, world) {
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9
  });
  
  const tirePositions = [
    [-35, 0, -70], [210, 0, -50], [220, 0, -60],
    [-20, 0, -130], [200, 0, -10]
  ];
  
  for (const pos of tirePositions) {
    const stack = new THREE.Group();
    stack.position.set(pos[0], 0, pos[2]);
    
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.2, 8, 12),
        tireMat
      );
      tire.position.y = 0.3 + i * 0.5;
      tire.rotation.x = Math.PI / 2;
      tire.rotation.z = Math.random() * 0.2;
      stack.add(tire);
    }
    
    scene.add(stack);
    
    // Физика
    const tireBody = new CANNON.Body({ mass: 0 });
    tireBody.addShape(new CANNON.Cylinder(0.6, 0.6, 0.4 * count, 8));
    tireBody.position.set(pos[0], 1, pos[2]);
    world.addBody(tireBody);
  }
}

/**
 * Создаёт бочки
 */
function createBarrels(scene, world) {
  const barrelColors = [0xcc3333, 0x33cc33, 0x3333cc, 0xcccc33, 0xcc33cc];
  
  const barrelPositions = [
    [-15, 0, -90], [195, 0, -90], [-10, 0, -10],
    [190, 0, -10], [50, 0, 20], [130, 0, 20]
  ];
  
  for (let i = 0; i < barrelPositions.length; i++) {
    const pos = barrelPositions[i];
    const color = barrelColors[i % barrelColors.length];
    
    const barrelMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.3
    });
    
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1.2, 10),
      barrelMat
    );
    barrel.position.set(pos[0], 0.6, pos[2]);
    barrel.rotation.y = Math.random() * Math.PI;
    barrel.castShadow = true;
    scene.add(barrel);
    
    // Обручи на бочке
    const hoopMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
    for (let j = 0; j < 2; j++) {
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.05, 6, 10),
        hoopMat
      );
      hoop.position.set(pos[0], 0.15 + j * 0.5, pos[2]);
      hoop.rotation.x = Math.PI / 2;
      scene.add(hoop);
    }
    
    // Физика
    const barrelBody = new CANNON.Body({ mass: 0 });
    barrelBody.addShape(new CANNON.Cylinder(0.6, 0.6, 1.2, 8));
    barrelBody.position.set(pos[0], 0.6, pos[2]);
    world.addBody(barrelBody);
  }
}

/**
 * Создаёт гравийные ловушки (участки с камнями)
 */
function createGravelTraps(scene) {
  const gravelMat = new THREE.MeshStandardMaterial({
    color: 0x888877,
    roughness: 1
  });
  
  const gravelPositions = [
    { x: 55, z: -115, w: 8, h: 4 },
    { x: 50, z: -45, w: 6, h: 5 },
    { x: 175, z: -150, w: 7, h: 4 }
  ];
  
  for (const gp of gravelPositions) {
    const gravel = new THREE.Mesh(
      new THREE.PlaneGeometry(gp.w, gp.h),
      gravelMat
    );
    gravel.rotation.x = -Math.PI / 2;
    gravel.position.set(gp.x, 0.005, gp.z);
    gravel.receiveShadow = true;
    scene.add(gravel);
    
    // Мелкие камни на гравии
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x999988,
      roughness: 1
    });
    
    for (let i = 0; i < 5; i++) {
      const stone = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 + Math.random() * 0.15, 4, 4),
        stoneMat
      );
      stone.position.set(
        gp.x + (Math.random() - 0.5) * gp.w,
        0.05,
        gp.z + (Math.random() - 0.5) * gp.h
      );
      scene.add(stone);
    }
  }
}
