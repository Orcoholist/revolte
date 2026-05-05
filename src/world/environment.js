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
