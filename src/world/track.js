import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

/**
 * Создаёт препятствие (конус)
 */
function createCone(position, scene) {
  const group = new THREE.Group();
  
  // Основание конуса
  const baseGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xff4400 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.05;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  
  // Тело конуса
  const bodyGeo = new THREE.CylinderGeometry(0, 0.4, 0.8, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);
  
  // Белые полоски
  for (let i = 0; i < 2; i++) {
    const stripeGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 16);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.5 + (i - 0.5) * 0.25;
    stripe.castShadow = true;
    group.add(stripe);
  }
  
  group.position.copy(position);
  group.castShadow = true;
  scene.add(group);
  
  return group;
}

/**
 * Создаёт барьер (деревянный ящик)
 */
function createBarrier(position, scene) {
  const group = new THREE.Group();
  
  const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.y = 0.75;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  
  // Усиления
  const reinforcementGeo = new THREE.BoxGeometry(1.6, 0.1, 1.6);
  const reinforcementMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  
  const top = new THREE.Mesh(reinforcementGeo, reinforcementMat);
  top.position.y = 1.45;
  group.add(top);
  
  const bottom = new THREE.Mesh(reinforcementGeo, reinforcementMat);
  bottom.position.y = 0.05;
  group.add(bottom);
  
  group.position.copy(position);
  scene.add(group);
  
  return group;
}

/**
 * Создаёт трамплин для прыжков
 */
function createRamp(position, rotation, scene, world, type = 'standard') {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotation;
  
  // Параметры трамплина
  const width = 6;
  const length = 8;
  let height = 1.5;
  
  // Цвет в зависимости от типа
  let color = 0xff6600; // стандартный оранжевый
  let bounceFactor = 1.2; // коэффициент отскока
  
  if (type === 'super') {
    color = 0xff0000; // красный - мощный
    bounceFactor = 1.6;
    height = 2.5;
  } else if (type === 'triple') {
    color = 0xffd700; // золотой - тройной прыжок
    bounceFactor = 2.0;
    height = 3.0;
  }
  
  // Основа трамплина (треугольник)
  const rampGeo = new THREE.BoxGeometry(width, height, length);
  const rampMat = new THREE.MeshStandardMaterial({ 
    color: color,
    roughness: 0.7,
    metalness: 0.3
  });
  const ramp = new THREE.Mesh(rampGeo, rampMat);
  ramp.position.set(0, height / 2, 0);
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  group.add(ramp);
  
  // Поверхность трамплина (наклонная)
  const surfaceGeo = new THREE.PlaneGeometry(width, length);
  const surfaceMat = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.6
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.rotation.z = Math.atan2(height, length); // угол наклона
  surface.position.set(0, height, length / 2 * Math.cos(Math.atan2(height, length)));
  surface.receiveShadow = true;
  group.add(surface);
  
  // Полоски предупреждения по краям
  const stripeWidth = 0.3;
  const stripeGeo = new THREE.BoxGeometry(stripeWidth, height * 0.1, length);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  
  const leftStripe = new THREE.Mesh(stripeGeo, stripeMat);
  leftStripe.position.set(-width / 2 + stripeWidth / 2, height * 0.95, 0);
  group.add(leftStripe);
  
  const rightStripe = new THREE.Mesh(stripeGeo, stripeMat);
  rightStripe.position.set(width / 2 - stripeWidth / 2, height * 0.95, 0);
  group.add(rightStripe);
  
  // Надпись/символ на трамплине
  if (type === 'super') {
    // Красная стрелка
    const arrowGeo = new THREE.ConeGeometry(0.8, 2, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.y = Math.PI / 4;
    arrow.position.set(0, height * 1.1, -1);
    group.add(arrow);
  }
  
  group.castShadow = true;
  scene.add(group);
  
  // Физика трамплина
  const rampBody = new CANNON.Body({ 
    mass: 0, // статический объект
    type: CANNON.Body.STATIC
  });
  
  // Форма трамплина (наклонная плоскость)
  const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, length / 2));
  rampBody.addShape(shape, new CANNON.Vec3(0, height / 2, 0));
  
  // Поворот формы для наклона
  const quaternion = new CANNON.Quaternion();
  quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.atan2(height, length));
  rampBody.quaternion.copy(quaternion);
  
  rampBody.position.set(position.x, 0, position.z);
  world.addBody(rampBody);
  
  // Сохраняем тип трамплина для физики
  rampBody.userData = { type: 'ramp', bounceFactor };
  
  return group;
}

/**
 * Трасса в стиле Revolt с серпантином, резкими поворотами и длинными прямыми.
 * Спавн машины — на стартовой прямой, смотрит вдоль +X.
 */
export function createTrack(scene, world) {
  const W = CONFIG.world.trackWidth;
  const halfW = W / 2;

  // --- Контрольные точки трассы (центр дороги) ---
  // Сложная трасса с мостами, тоннелями и крутыми виражами
  const points = [
    // Стартовая прямая
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(80, 0, 0),
    
    // Большой круговой поворот направо
    new THREE.Vector3(130, 0, -40),
    new THREE.Vector3(160, 0, -90),
    
    // Длинная прямая вниз с трамплином
    new THREE.Vector3(160, 0, -140),
    
    // Резкий поворот влево (180 градусов)
    new THREE.Vector3(140, 0, -160),
    new THREE.Vector3(100, 0, -170),
    new THREE.Vector3(60, 0, -160),
    
    // Змейка вверх (S-образные повороты)
    new THREE.Vector3(40, 0, -130),
    new THREE.Vector3(70, 0, -100),
    new THREE.Vector3(40, 0, -70),
    new THREE.Vector3(80, 0, -40),
    
    // Мост с подъемом
    new THREE.Vector3(120, 5, -30),
    new THREE.Vector3(160, 10, -40),
    
    // Пирамида (круговой вираж с наклоном)
    new THREE.Vector3(190, 8, -80),
    new THREE.Vector3(180, 5, -120),
    
    // Тоннель (спуск вниз)
    new THREE.Vector3(150, 0, -140),
    new THREE.Vector3(120, -5, -150),
    
    // Нижняя прямая
    new THREE.Vector3(80, -5, -150),
    
    // Крутой подъем (горка)
    new THREE.Vector3(40, 0, -140),
    new THREE.Vector3(20, 8, -100),
    
    // Верхняя петля (частичная)
    new THREE.Vector3(40, 12, -60),
    new THREE.Vector3(80, 8, -40),
    
    // Возврат к старту
    new THREE.Vector3(120, 4, -30),
    new THREE.Vector3(60, 2, -20),
  ];

  // Строим плавные сегменты между точками
  const segments = [];
  const stepsPerSegment = 15;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    
    for (let j = 0; j <= stepsPerSegment; j++) {
      const t = j / stepsPerSegment;
      // Cubic interpolation для плавности
      const t2 = t * t;
      const t3 = t2 * t;
      const pos = new THREE.Vector3()
        .lerpVectors(a, b, t)
        .add(new THREE.Vector3(0, Math.sin(t * Math.PI) * 2, 0));
      segments.push(pos);
    }
  }

  // --- Рисуем дорогу ---
  const roadMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.road,
    roughness: 0.85
  });

  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    addRoadSegment(scene, a, b, W, roadMat);
  }

  // --- Бордюры (красно-белые) ---
  const curbMatRed = new THREE.MeshStandardMaterial({ color: CONFIG.colors.curb });
  const curbMatWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    const mat = (i % 2 === 0) ? curbMatRed : curbMatWhite;
    addCurbSegment(scene, a, b, W, mat);
  }

  // --- Стартовая линия ---
  const startGeo = new THREE.PlaneGeometry(W, 3);
  const startMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const startLine = new THREE.Mesh(startGeo, startMat);
  startLine.rotation.x = -Math.PI / 2;
  startLine.position.set(halfW, 0.02, 0);
  scene.add(startLine);

  // Checkered паттерн
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) continue;
      const sq = new THREE.Mesh(
        new THREE.PlaneGeometry(W / 8, 1.5),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      sq.rotation.x = -Math.PI / 2;
      sq.position.set(col * (W / 8), 0.03, (row - 0.5) * 1.5);
      scene.add(sq);
    }
  }

  // --- Препятствия на трассе ---
  const obstacles = [];
  
  // Конусы на стартовой прямой
  for (let i = 1; i < 5; i++) {
    const offset = (i % 2 === 0) ? 6 : -6;
    const cone = createCone(new THREE.Vector3(i * 18, 0, offset), scene);
    obstacles.push(cone);
  }
  
  // Барьеры на первом повороте
  obstacles.push(createBarrier(new THREE.Vector3(145, 0, -60), scene));
  obstacles.push(createBarrier(new THREE.Vector3(155, 0, -100), scene));
  
  // Конусы на змейке
  obstacles.push(createCone(new THREE.Vector3(55, 0, -100), scene));
  obstacles.push(createCone(new THREE.Vector3(65, 0, -70), scene));
  
  // Барьеры на мосту
  obstacles.push(createBarrier(new THREE.Vector3(140, 7, -35), scene));
  obstacles.push(createBarrier(new THREE.Vector3(150, 9, -40), scene));
  
  // Конусы на верхней секции
  obstacles.push(createCone(new THREE.Vector3(175, 6, -95), scene));
  obstacles.push(createCone(new THREE.Vector3(165, 4, -110), scene));
  
  // --- Зоны ускорения (бустеры) на трассе ---
  const boosters = createBoostZones(scene, segments, W);
  
  // --- Декорации ---
  createTrackDecorations(scene);
  
  return { segments, spawnPos: new THREE.Vector3(halfW, 0, 0), spawnRot: 0, obstacles };
}

/**
 * Создаёт декорации на трассе
 */
function createTrackDecorations(scene) {
  // Световые столбы вдоль трассы
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.3 });
  
  const polePositions = [
    [100, 0, -20], [120, 0, -40], [140, 0, -60], [150, 0, -90],
    [155, 0, -120], [130, 0, -150], [100, 0, -160], [70, 0, -150],
    [50, 0, -120], [60, 0, -90], [70, 0, -60], [90, 0, -40],
    [110, 4, -30], [140, 8, -40], [170, 7, -70], [175, 5, -100]
  ];
  
  for (const pos of polePositions) {
    // Столб
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 8, 8),
      poleMat
    );
    pole.position.set(pos[0], 4, pos[2]);
    pole.castShadow = true;
    scene.add(pole);
    
    // Свет
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      lightMat
    );
    light.position.set(pos[0] + 1, 8, pos[2]);
    scene.add(light);
  }
}

/**
 * Создаёт зоны ускорения (бустеры) на прямых участках трассы
 * Визуально: светящиеся полосы на дороге
 */
function createBoostZones(scene, segments, roadWidth) {
  const boosters = [];
  const halfW = roadWidth / 2;
  
  // Позиции бустеров: на длинных прямых участках трассы
  const boosterPositions = [
    // Стартовая прямая - зона ускорения после старта
    { segmentIdx: 50, length: 30 },
    // Прямая вниз после поворота
    { segmentIdx: 150, length: 25 },
    // Прямая после змейки
    { segmentIdx: 280, length: 20 },
    // Прямая на мосту
    { segmentIdx: 350, length: 15 },
  ];
  
  for (const bp of boosterPositions) {
    if (bp.segmentIdx >= segments.length) continue;
    
    // Создаём цепочку бустерных полос
    const count = Math.floor(bp.length / 3);
    for (let j = 0; j < count; j++) {
      const idx = Math.min(bp.segmentIdx + j * 3, segments.length - 1);
      const pos = segments[idx];
      
      // Светящаяся полоса
      const boosterGeo = new THREE.PlaneGeometry(halfW * 0.8, 1.2);
      const boosterMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.4 + Math.sin(j * 1.5) * 0.3,
        side: THREE.DoubleSide
      });
      const booster = new THREE.Mesh(boosterGeo, boosterMat);
      booster.rotation.x = -Math.PI / 2;
      booster.position.set(pos.x, 0.03, pos.z);
      
      // Определяем направление дороги в этой точке
      const nextIdx = Math.min(idx + 3, segments.length - 1);
      if (nextIdx < segments.length) {
        const dir = new THREE.Vector3().subVectors(segments[nextIdx], pos).normalize();
        booster.rotation.z = -Math.atan2(dir.z, dir.x);
      }
      
      scene.add(booster);
      boosters.push(booster);
      
      // Дополнительные боковые индикаторы (стрелки)
      if (j % 2 === 0) {
        for (const side of [-1, 1]) {
          const arrowGeo = new THREE.ConeGeometry(0.3, 0.8, 4);
          const arrowMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6
          });
          const arrow = new THREE.Mesh(arrowGeo, arrowMat);
          arrow.rotation.x = Math.PI / 2;
          arrow.position.set(pos.x + side * halfW * 0.5, 0.05, pos.z);
          scene.add(arrow);
          boosters.push(arrow);
        }
      }
    }
    
    // Добавляем большие порталы/арки в начале и конце зоны бустера
    const startIdx = bp.segmentIdx;
    const endIdx = Math.min(bp.segmentIdx + bp.length, segments.length - 1);
    
    // Арка входа
    createBoosterPortal(scene, segments[startIdx], halfW, 0x00ffff);
    // Арка выхода
    createBoosterPortal(scene, segments[endIdx], halfW, 0xff00ff);
  }
  
  return boosters;
}

/**
 * Создаёт портал/арку для зоны ускорения
 */
function createBoosterPortal(scene, pos, halfW, color) {
  const portalMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  });
  const portalMatBright = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.4
  });
  
  // Вертикальные стойки
  const pillarHeight = 5;
  const pillarGeo = new THREE.BoxGeometry(0.3, pillarHeight, 0.3);
  
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, portalMatBright);
    pillar.position.set(
      pos.x + side * halfW * 0.6,
      pillarHeight / 2,
      pos.z
    );
    scene.add(pillar);
    
    // Свечение вокруг стоек
    const glowGeo = new THREE.BoxGeometry(0.6, pillarHeight, 0.6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.08
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(pillar.position);
    scene.add(glow);
  }
  
  // Верхняя перекладина
  const topGeo = new THREE.BoxGeometry(halfW * 1.2, 0.3, 0.3);
  const top = new THREE.Mesh(topGeo, portalMatBright);
  top.position.set(pos.x, pillarHeight, pos.z);
  scene.add(top);
  
  // Свечение портала (полупрозрачная плоскость)
  const portalGeo = new THREE.PlaneGeometry(halfW * 1.4, pillarHeight * 1.2);
  const portal = new THREE.Mesh(portalGeo, portalMat);
  portal.position.set(pos.x, pillarHeight / 2, pos.z);
  scene.add(portal);
}

function addRoadSegment(scene, a, b, width, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.01) return;
  dir.normalize();

  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mid.y = 0.01;

  const geo = new THREE.PlaneGeometry(width, len);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -Math.atan2(dir.z, dir.x);
  mesh.position.copy(mid);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addCurbSegment(scene, a, b, roadW, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.01) return;
  dir.normalize();

  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const halfW = roadW / 2;
  const curbW = 1.2;

  // Два бордюра: левый и правый
  for (const side of [-1, 1]) {
    const offset = perp.clone().multiplyScalar(side * (halfW + curbW / 2));
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5).add(offset);
    mid.y = 0.015;

    const geo = new THREE.PlaneGeometry(curbW, len);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -Math.atan2(dir.z, dir.x);
    mesh.position.copy(mid);
    scene.add(mesh);
  }
}
