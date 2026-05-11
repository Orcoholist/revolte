import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

// Локальный физический материал (groundMaterial не экспортируется из physics.js)
const physGround = new CANNON.Material('groundLocal');

// ==================== ГЕНЕРАТОР ТЕКСТУР ====================
function makeCanvasTexture(drawFn, w = 512, h = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  // Убрать мерцание текстуры пола
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createEnvironment(scene, world) {
  const SIZE = CONFIG.world.size;

  // --- Земля (визуал) ---
  const groundTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#4a7c2e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const g = 70 + Math.random() * 90;
      ctx.fillStyle = `rgb(${30 + Math.random() * 30},${g},${20 + Math.random() * 30})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  });
  const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9 });
  groundMat.map.repeat.set(8, 8);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  // createSkyWithClouds(scene); // Купол неба убран по запросу
  createArenaWalls(scene, world, SIZE);
  // createMountains(scene); // Mountains removed as per request
  createBuildings(scene);
  // createTrees(scene, world); // Trees removed from map as per request
  createWindmills(scene, world);
  createFlags(scene);
  // createRocks(scene, world); // Removed small stones as per request
  // createTires(scene, world); // Tires removed as per request — they work poorly as obstacles
  
  // Создаём препятствия для ботов
  // Obstacles (barrels, crates, containers) removed as requested
  const obstacles = [];
  /*
  const obstacleTypes = ['barrel', 'crate', 'container'];
  
  for (let i = 0; i < 20; i++) {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 50;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    let obstacle;
    let physicsShape;
    let physicsBody;
    
    switch (type) {
      case 'barrel':
        const barrelGeometry = new THREE.CylinderGeometry(1.5, 1.5, 3, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({
          color: 0x8B4513,
          roughness: 0.7,
          metalness: 0.3
        });
        obstacle = new THREE.Mesh(barrelGeometry, barrelMaterial);
        obstacle.position.set(x, 1.5, z);
        obstacle.castShadow = true;
        obstacle.userData.type = 'barrel';
        
        physicsShape = new CANNON.Cylinder(1.5, 1.5, 3, 8);
        physicsBody = new CANNON.Body({
          mass: 5,
          shape: physicsShape,
          position: new CANNON.Vec3(x, 1.5, z)
        });
        break;
        
      case 'crate':
        const crateGeometry = new THREE.BoxGeometry(3, 3, 3);
        const crateMaterial = new THREE.MeshStandardMaterial({
          color: 0xDEB887,
          roughness: 0.8,
          metalness: 0.1
        });
        obstacle = new THREE.Mesh(crateGeometry, crateMaterial);
        obstacle.position.set(x, 1.5, z);
        obstacle.castShadow = true;
        obstacle.userData.type = 'crate';
        
        physicsShape = new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5));
        physicsBody = new CANNON.Body({
          mass: 8,
          shape: physicsShape,
          position: new CANNON.Vec3(x, 1.5, z)
        });
        break;
        
      case 'container':
        const containerGeometry = new THREE.BoxGeometry(4, 4, 6);
        const containerMaterial = new THREE.MeshStandardMaterial({
          color: 0x4682B4,
          roughness: 0.6,
          metalness: 0.4
        });
        obstacle = new THREE.Mesh(containerGeometry, containerMaterial);
        obstacle.position.set(x, 2, z);
        obstacle.castShadow = true;
        obstacle.userData.type = 'container';
        
        physicsShape = new CANNON.Box(new CANNON.Vec3(2, 2, 3));
        physicsBody = new CANNON.Body({
          mass: 20,
          shape: physicsShape,
          position: new CANNON.Vec3(x, 2, z)
        });
        break;
    }
    
    scene.add(obstacle);
    world.addBody(physicsBody);
    obstacles.push(obstacle);
  }
  */
  
  return { obstacles: obstacles };
}

function createSkyWithClouds(scene) {
  const skyGeo = new THREE.SphereGeometry(CONFIG.world.size / 2, 64, 32);
  const positions = skyGeo.attributes.position;
  const colors = [];
  const topColor = new THREE.Color(0x2266cc);
  const horizonColor = new THREE.Color(0xaaddff);
  const bottomColor = new THREE.Color(0xcccccc);
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const t = (y / (CONFIG.world.size / 2) + 1) / 2;
    const color = new THREE.Color();
    if (t > 0.5) color.lerpColors(horizonColor, topColor, (t - 0.5) * 2);
    else color.lerpColors(bottomColor, horizonColor, t * 2);
    colors.push(color.r, color.g, color.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  sky.position.y = -20;
  scene.add(sky);

  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.75, depthWrite: false });
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 60;
    const group = new THREE.Group();
    group.position.set(Math.cos(a) * d, 25 + Math.random() * 35, Math.sin(a) * d);
    for (let b = 0; b < 3 + Math.floor(Math.random() * 3); b++) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 4, 8, 8), cloudMat);
      blob.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 10);
      blob.scale.set(1, 0.5 + Math.random() * 0.3, 1);
      group.add(blob);
    }
    scene.add(group);
  }
}

function createArenaWalls(scene, world, arenaSize) {
  const half = arenaSize / 2 - 5;
  const wallH = 30;
  const wallT = 1;
  const fenceTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#666666'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#888888'; ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, roughness: 0.4, metalness: 0.7, transparent: true, opacity: 0.9 });
  const walls = [
    { pos: [0, wallH / 2, -half], size: [arenaSize, wallH, wallT] },
    { pos: [0, wallH / 2, half], size: [arenaSize, wallH, wallT] },
    { pos: [-half, wallH / 2, 0], size: [wallT, wallH, arenaSize] },
    { pos: [half, wallH / 2, 0], size: [wallT, wallH, arenaSize] },
  ];
  for (const w of walls) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(w.size[0], wallH * 0.4, w.size[2]), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 }));
    barrier.position.set(w.pos[0], wallH * 0.2, w.pos[2]);
    barrier.castShadow = true; barrier.receiveShadow = true; scene.add(barrier);
    const fence = new THREE.Mesh(new THREE.BoxGeometry(w.size[0], wallH * 0.6, w.size[2] * 0.3), fenceMat);
    fence.position.set(w.pos[0], wallH * 0.7, w.pos[2]); fence.castShadow = true; scene.add(fence);
    const body = new CANNON.Body({ mass: 0, material: physGround });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w.size[0] / 2, wallH / 2, w.size[2] / 2)));
    body.position.set(w.pos[0], wallH / 2, w.pos[2]);
    world.addBody(body);
  }
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.3, metalness: 0.8 });
  const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, wallH + 2, 8);
  for (let side = 0; side < 4; side++) {
    for (let i = -half; i <= half; i += 20) {
      let px, pz;
      if (side === 0) { px = i; pz = -half; }
      else if (side === 1) { px = i; pz = half; }
      else if (side === 2) { px = -half; pz = i; }
      else { px = half; pz = i; }
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, (wallH + 2) / 2, pz); pillar.castShadow = true; scene.add(pillar);
    }
  }
}

function createMountains(scene) {
  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x4a6b3a, roughness: 0.85, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x776655, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.2;
    const dist = 110 + Math.random() * 40;
    const height = 25 + Math.random() * 60;
    const x = Math.cos(angle) * dist, z = Math.sin(angle) * dist;
    const radius = 12 + Math.random() * 20;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8, 5), mountainMat);
    mountain.position.set(x, height / 2 - 3, z);
    mountain.castShadow = true; mountain.receiveShadow = true; scene.add(mountain);
    if (height > 45) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.35, height * 0.25, 8, 4), snowMat);
      cap.position.set(x, height - height * 0.125 - 3, z); cap.castShadow = true; scene.add(cap);
    }
    if (height > 35 && Math.random() > 0.5) {
      for (let r = 0; r < 3; r++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 2, 0), rockMat);
        const ra = angle + (Math.random() - 0.5) * 0.5;
        rock.position.set(x + Math.cos(ra) * radius * 0.7, 0.5 + Math.random(), z + Math.sin(ra) * radius * 0.7);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
      }
    }
  }
}

function createBuildings(scene) {
  const buildingMats = [
    new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.6 }),
  ];
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
  for (let cluster = 0; cluster < 8; cluster++) {
    const ca = (cluster / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const cd = 120 + Math.random() * 30;
    const cx = Math.cos(ca) * cd, cz = Math.sin(ca) * cd;
    for (let b = 0; b < 3 + Math.floor(Math.random() * 4); b++) {
      const bx = cx + (Math.random() - 0.5) * 25, bz = cz + (Math.random() - 0.5) * 25;
      const bw = 3 + Math.random() * 6, bd = 3 + Math.random() * 6, bh = 8 + Math.random() * 40;
      const building = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), buildingMats[Math.floor(Math.random() * buildingMats.length)]);
      building.position.set(bx, bh / 2, bz);
      building.castShadow = true; building.receiveShadow = true; scene.add(building);
      if (bh > 12 && Math.random() > 0.3) {
        const windows = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.65, bh * 0.6), windowMat);
        windows.position.set(bx, bh / 2, bz + bd / 2 + 0.1); scene.add(windows);
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, d = 70 + Math.random() * 40;
    const tx = Math.cos(a) * d, tz = Math.sin(a) * d, th = 35 + Math.random() * 35;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, th, 8), buildingMats[0]);
    tower.position.set(tx, th / 2, tz); tower.castShadow = true; tower.receiveShadow = true; scene.add(tower);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    antenna.position.set(tx, th + 4, tz); scene.add(antenna);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    beacon.position.set(tx, th + 8, tz); scene.add(beacon);
  }
}

// Trees have been removed from the map as per the request.

function createRocks(scene, world) {
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.85, flatShading: true });
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, d = 95 + Math.random() * 40;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, size = 0.6 + Math.random() * 1.5;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMat);
    rock.position.set(x, size * 0.4, z); rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
    const rockBody = new CANNON.Body({ mass: 0, material: physGround });
    rockBody.addShape(new CANNON.Box(new CANNON.Vec3(size * 0.5, size * 0.4, size * 0.5)));
    rockBody.position.set(x, size * 0.4, z); world.addBody(rockBody);
  }
}

function createWindmills(scene, world) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.3 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
  const positions = [[-90, 12, -90], [90, 12, -90], [-90, 12, 90], [90, 12, 90], [0, 15, -110], [0, 15, 110]];
  for (const [px, py, pz] of positions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, py, 8), poleMat);
    pole.position.set(px, py / 2, pz); pole.castShadow = true; scene.add(pole);
    const blades = new THREE.Group(); blades.position.set(px, py, pz);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 0.08), bladeMat);
      blade.position.y = 2.5; blade.rotation.y = (b / 4) * Math.PI * 2; blades.add(blade);
    }
    blades.userData = { speed: 0.3 + Math.random() * 0.5 }; scene.add(blades);
    const poleBody = new CANNON.Body({ mass: 0, material: physGround });
    poleBody.addShape(new CANNON.Box(new CANNON.Vec3(0.5, py / 2, 0.5)));
    poleBody.position.set(px, py / 2, pz); world.addBody(poleBody);
  }
}

function createFlags(scene) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.5 });
  const colors = [0xff3333, 0x33ff33, 0x3333ff, 0xffff33, 0xff33ff, 0x33ffff];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, d = 92;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 5, 6), poleMat);
    pole.position.set(x, 2.5, z + 2); scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
    flag.position.set(x + 0.5, 4.5, z + 2); scene.add(flag);
  }
}

function createTires(scene, world) {
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const x = (Math.random() - 0.5) * 180, z = (Math.random() - 0.5) * 180;
    if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
    const stack = new THREE.Group(); stack.position.set(x, 0, z);
    const count = 2 + Math.floor(Math.random() * 4);
    for (let t = 0; t < count; t++) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.18, 8, 12), tireMat);
      tire.position.y = 0.25 + t * 0.45; tire.rotation.x = Math.PI / 2; tire.rotation.z = Math.random() * 0.3;
      tire.castShadow = true; tire.receiveShadow = true; stack.add(tire);
    }
    scene.add(stack);
    const tireBody = new CANNON.Body({ mass: 0, material: physGround });
    tireBody.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.2 * count, 0.5)));
    tireBody.position.set(x, 1, z); world.addBody(tireBody);
  }
}