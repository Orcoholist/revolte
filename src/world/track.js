import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

// Локальные материалы для физики
const physGround = new CANNON.Material('groundLocal');
const physObstacle = new CANNON.Material('obstacleLocal');

// ==================== КЛАСС ЭЛЕМЕНТА ТРАССЫ ====================
export class TrackElement {
  constructor(type, position, visual, physics, physicsBody = null) {
    this.type = type;
    this.position = position;
    this.visual = visual;
    this.physics = physics;
    this.physicsBody = physicsBody;
  }
}

// ==================== ГЕНЕРАТОР ТЕКСТУР ====================
function makeCanvasTexture(drawFn, w = 512, h = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createAsphaltTexture() {
  const tex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, w, h);
    // мелкая зернистость
    for (let i = 0; i < 4000; i++) {
      const shade = 70 + Math.random() * 30;
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  }, 1024, 1024);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function createConcreteTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#c8c0b0';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      const shade = 180 + Math.random() * 40;
      ctx.fillStyle = `rgb(${shade},${shade - 10},${shade - 20})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 3;
    for (let x = 0; x < w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
}

function createGrassTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#3d6b2e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const g = 80 + Math.random() * 80;
      ctx.fillStyle = Math.random() > 0.5 ? `rgb(30,${g},20)` : `rgb(40,${g},30)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  });
}

function createGravelTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#a09080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      const shade = 130 + Math.random() * 60;
      ctx.fillStyle = `rgb(${shade},${shade - 10},${shade - 20})`;
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function createRampTexture(color1, color2) {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color2;
    const stripeW = w / 6;
    for (let i = 0; i < 6; i += 2) ctx.fillRect(i * stripeW, 0, stripeW, h);
  });
}

// ==================== МАТЕРИАЛЫ THREE.JS ====================
const asphaltTex = createAsphaltTexture();
const concreteTex = createConcreteTexture();
const grassTex = createGrassTexture();
const gravelTex = createGravelTexture();
const rampTexStandard = createRampTexture('#ff6600', '#ffffff');
const rampTexSuper = createRampTexture('#ff0000', '#ffff00');
const rampTexTriple = createRampTexture('#ffd700', '#ff4400');

const M = {
  asphalt: new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.65 }),
  grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
  gravel: new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1.0 }),
  rampStandard: new THREE.MeshStandardMaterial({ map: rampTexStandard, roughness: 0.5, metalness: 0.3 }),
  rampSuper: new THREE.MeshStandardMaterial({ map: rampTexSuper, roughness: 0.4, metalness: 0.4, emissive: 0x330000, emissiveIntensity: 0.2 }),
  rampTriple: new THREE.MeshStandardMaterial({ map: rampTexTriple, roughness: 0.3, metalness: 0.5, emissive: 0x332200, emissiveIntensity: 0.3 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.3, metalness: 0.95 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.35, metalness: 0.9 }),
  lightGlow: new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 }),
  redGlow: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  greenGlow: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
  curb: new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.5 }),
  curbWhite: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 }),
  halfPipe: new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.35, metalness: 0.7 }),
  loop: new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.3, metalness: 0.8, emissive: 0x330000, emissiveIntensity: 0.2 }),
  arch: new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.3, metalness: 0.7, emissive: 0x220000, emissiveIntensity: 0.4 }),
  container: new THREE.MeshStandardMaterial({ color: 0xdd8833, roughness: 0.6, metalness: 0.35 }),
  barrel: new THREE.MeshStandardMaterial({ color: 0x4477aa, roughness: 0.5, metalness: 0.6 }),
  crate: new THREE.MeshStandardMaterial({ color: 0xccaa66, roughness: 0.7 }),
  grandstand: new THREE.MeshStandardMaterial({ color: 0x4477cc, roughness: 0.7 }),
  grandstandStruct: new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.4, metalness: 0.7 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x2d7d2d, roughness: 0.8 }),
  leavesDark: new THREE.MeshStandardMaterial({ color: 0x1d5d1d, roughness: 0.85 }),
  boardBg: new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.5 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, transparent: true, opacity: 0.3 }),
};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function addSlab(scene, world, x, y, z, w, d, h, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  const body = new CANNON.Body({ mass: 0, material: physGround });
  body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
  body.position.set(x, y + h / 2, z);
  world.addBody(body);
  return { mesh, body };
}

function addRoadSegment(scene, a, b, width, world, yOffset = 0.01) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.01) return;
  dir.normalize();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mid.y = yOffset;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, len), M.asphalt);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -Math.atan2(dir.z, dir.x);
  mesh.position.copy(mid);
  mesh.receiveShadow = true;
  scene.add(mesh);
  // Добавляем физическую «плоскость» для дорожной поверхности
  const groundBody = new CANNON.Body({
    mass: 0,
    material: physGround
  });
  const groundShape = new CANNON.Box(new CANNON.Vec3(width / 2, 0.05, len / 2));
  groundBody.addShape(groundShape, new CANNON.Vec3(0, 0.05, 0));
  if (world) {
    groundBody.position.set(mid.x, mid.y + 0.05, mid.z);
    world.addBody(groundBody);
  }
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.PlaneGeometry(0.8, len), M.curb);
    curb.rotation.x = -Math.PI / 2;
    curb.rotation.z = -Math.atan2(dir.z, dir.x);
    curb.position.copy(mid).add(perp.clone().multiplyScalar(side * (width / 2 + 0.4)));
    curb.position.y = 0.015;
    scene.add(curb);
  }
}

function addRoad(scene, points, width, world, yOffset = 0.01) {
  for (let i = 0; i < points.length - 1; i++) addRoadSegment(scene, points[i], points[i + 1], width, world, yOffset);
}

// Разметка — белые прерывистые полосы по центру дороги
function addRoadMarkings(scene, points, width = 1.2) {
  if (points.length < 2) return;
  
  const markingGroup = new THREE.Group();
  
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    
    const dir = new THREE.Vector3().subVectors(b, a);
    const totalLen = dir.length();
    if (totalLen < 0.01) continue;
    dir.normalize();
    const mid = new THREE.Vector3().lerpVectors(a, b, 0.5);
    
    const canvas = document.createElement('canvas');
    const canvasSize = 512;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    const dashLength = canvasSize / 8;
    const gapLength = canvasSize / 8;
    for (let y = 0; y < canvasSize; y += dashLength + gapLength) {
      ctx.fillRect(0, y, canvasSize, dashLength);
    }
    
    const markingTexture = new THREE.CanvasTexture(canvas);
    markingTexture.wrapS = THREE.RepeatWrapping;
    markingTexture.wrapT = THREE.RepeatWrapping;
    const verticalRepeat = totalLen / 4;
    markingTexture.repeat.set(1, verticalRepeat);
    
    const stripeMat = new THREE.MeshBasicMaterial({ 
      map: markingTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide
    });
    
    const stripeGeo = new THREE.PlaneGeometry(width, totalLen);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = -Math.atan2(dir.z, dir.x);
    stripe.position.copy(mid).add(new THREE.Vector3(0, 0.03, 0));
    markingGroup.add(stripe);
  }
  
  scene.add(markingGroup);
}

function addJumpRamp(scene, world, x, y, z, rotY, type, elements) {
  let w, llen, h, mat;
  if (type === 'standard') { w = 8; llen = 6; h = 1.5; mat = M.rampStandard; }
  else if (type === 'super') { w = 10; llen = 8; h = 2.5; mat = M.rampSuper; }
  else { w = 12; llen = 10; h = 3.5; mat = M.rampTriple; }
  const group = new THREE.Group();
  group.position.set(x, y, z); group.rotation.y = rotY;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, llen), mat);
  base.position.y = h / 2; base.castShadow = true; base.receiveShadow = true;
  group.add(base);
  const slopeGeo = new THREE.PlaneGeometry(w, Math.sqrt(llen * llen + h * h));
  const slope = new THREE.Mesh(slopeGeo, mat);
  slope.rotation.x = -Math.atan2(h, llen);
  slope.position.set(0, h * 0.75, llen * 0.35);
  group.add(slope);
  const arrowGeo = new THREE.ConeGeometry(0.4, 1.0, 4);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  for (let j = 0; j < 3; j++) {
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set((j - 1) * 2.5, h + 0.5, 1); arrow.rotation.x = Math.PI;
    group.add(arrow);
  }
  const neonGeo = new THREE.BoxGeometry(0.15, 0.05, llen);
  const neonMat = new THREE.MeshBasicMaterial({ color: type === 'triple' ? 0xff00ff : 0x00ffff });
  for (const s of [-1, 1]) {
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.set(s * (w / 2 - 0.2), h * 0.1, 0);
    group.add(neon);
  }
  scene.add(group);
  const rampBody = new CANNON.Body({ mass: 0, material: physGround });
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    rampBody.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, 0.2, llen / steps / 2)), new CANNON.Vec3(0, h * t, -llen / 2 + llen * t));
  }
  rampBody.position.set(x, y, z); rampBody.quaternion.setFromEuler(0, rotY, 0);
  world.addBody(rampBody);
  elements.push(new TrackElement('ramp', new THREE.Vector3(x, y, z), group, { bounceFactor: type === 'triple' ? 2.5 : type === 'super' ? 2.0 : 1.5, collisionRadius: 12 }, rampBody));
}

function addHalfPipe(scene, world, x, y, z, length, radius, rotY, elements) {
  const group = new THREE.Group();
  group.position.set(x, y, z); group.rotation.y = rotY;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16, 1, true, 0, Math.PI), M.halfPipe);
  pipe.rotation.z = Math.PI / 2; pipe.position.y = radius;
  pipe.castShadow = true; pipe.receiveShadow = true;
  group.add(pipe);
  const stripeGeo = new THREE.TorusGeometry(radius, 0.05, 8, 32, Math.PI);
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let s = 0; s < 3; s++) {
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, radius, (s - 1) * length / 4); stripe.rotation.y = Math.PI / 2;
    group.add(stripe);
  }
  scene.add(group);
  elements.push(new TrackElement('halfpipe', new THREE.Vector3(x, y, z), group, { bounceFactor: 1.2, collisionRadius: radius + 2 }, null));
}

function addLoop(scene, world, x, y, z, radius, rotY, elements) {
  const group = new THREE.Group();
  group.position.set(x, y, z); group.rotation.y = rotY;
  const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.4, 16, 32), M.loop);
  torus.position.y = radius; torus.castShadow = true; torus.receiveShadow = true;
  group.add(torus);
  for (let s = 0; s < 2; s++) {
    const support = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, radius, 8), M.metalDark);
    support.position.set((s === 0 ? -1 : 1) * radius * 0.75, radius / 2, 0);
    support.castShadow = true; group.add(support);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 16), M.lightGlow);
    glow.position.set((s === 0 ? -1 : 1) * radius * 0.75, radius * 0.2, 0);
    group.add(glow);
  }
  scene.add(group);
  elements.push(new TrackElement('loop', new THREE.Vector3(x, y, z), group, { bounceFactor: 0.5, collisionRadius: radius + 2 }, null));
}

function addGrandstand(scene, world, x, y, z, rotY) {
  const group = new THREE.Group();
  group.position.set(x, y, z); group.rotation.y = rotY;
  for (let row = 0; row < 6; row++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 1.5), M.grandstand);
    step.position.set(0, row * 0.75 + 0.5, -row * 1.2); step.castShadow = true; step.receiveShadow = true;
    group.add(step);
    for (let s = 0; s < 5; s++) {
      const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff];
      const person = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), new THREE.MeshStandardMaterial({ color: colors[s], roughness: 0.6 }));
      person.position.set((s - 2) * 1.7, row * 0.75 + 0.9, -row * 1.2); person.castShadow = true;
      group.add(person);
    }
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 9), M.grandstandStruct);
  roof.position.set(0, 5.2, -3); roof.castShadow = true;
  group.add(roof);
  for (const px of [-7, 7]) for (const pz of [-6, 0]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 5, 8), M.grandstandStruct);
    p.position.set(px, 2.5, pz); p.castShadow = true; group.add(p);
  }
  scene.add(group);
  const body = new CANNON.Body({ mass: 0, material: physGround });
  body.addShape(new CANNON.Box(new CANNON.Vec3(9, 2.6, 5)));
  body.position.set(x, y + 2.6, z - 3); body.quaternion.setFromEuler(0, rotY, 0);
  world.addBody(body);
}

function addLightTower(scene, x, y, z) {
  const group = new THREE.Group(); group.position.set(x, y, z);
  for (let leg = 0; leg < 4; leg++) {
    const angle = (leg / 4) * Math.PI * 2;
    const lx = Math.cos(angle) * 0.5, lz = Math.sin(angle) * 0.5;
    const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 20, 8), M.metalDark);
    legMesh.position.set(lx, 10, lz); legMesh.castShadow = true; group.add(legMesh);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), M.metal);
  platform.position.y = 19; group.add(platform);
  for (let s = 0; s < 4; s++) {
    const angle = (s / 4) * Math.PI * 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), M.lightGlow);
    light.position.set(Math.cos(angle) * 1.2, 19.2, Math.sin(angle) * 1.2); group.add(light);
    const spotLight = new THREE.SpotLight(0xffffcc, 3, 60, Math.PI / 6, 0.3, 0.5);
    spotLight.position.copy(light.position);
    spotLight.target.position.set(Math.cos(angle) * 30, 0, Math.sin(angle) * 30);
    group.add(spotLight); group.add(spotLight.target);
  }
  scene.add(group);
}

function addLampPost(scene, x, y, z) {
  const group = new THREE.Group(); group.position.set(x, y, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 6, 8), M.metalDark);
  pole.position.y = 3; pole.castShadow = true; group.add(pole);
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), M.lightGlow)).position.y = 6;
  scene.add(group);
}

function addTree(scene, x, y, z) {
  const group = new THREE.Group(); group.position.set(x, y, z);
  const h = 4 + Math.random() * 4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 8), M.trunk);
  trunk.position.y = h / 2; trunk.castShadow = true; group.add(trunk);
  const crownCount = 2 + Math.floor(Math.random() * 3);
  for (let c = 0; c < crownCount; c++) {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 1.5, 8, 8), Math.random() > 0.5 ? M.leaves : M.leavesDark);
    crown.position.set((Math.random() - 0.5) * 2, h * 0.7 + Math.random() * 2, (Math.random() - 0.5) * 2);
    crown.castShadow = true; crown.receiveShadow = true; group.add(crown);
  }
  scene.add(group);
}

function addContainer(scene, world, x, y, z, obstacles) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = Math.random() * Math.PI;
  group.userData.type = 'container';
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), M.container);
  box.position.y = 1; box.castShadow = true; box.receiveShadow = true; group.add(box);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xbb7722, roughness: 0.5, metalness: 0.5 });
  for (const ey of [0, 2]) { const e = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 4.1), edgeMat); e.position.y = ey; group.add(e); }
  scene.add(group);
  // Физическое тело
  const body = new CANNON.Body({ mass: 0, material: physGround });
  body.addShape(new CANNON.Box(new CANNON.Vec3(1, 1, 2)));
  body.position.set(x, y + 1, z);
  body.quaternion.copy(group.quaternion);
  world.addBody(body);
  obstacles.push(group);
}

function addBarrel(scene, world, x, y, z, obstacles) {
  const group = new THREE.Group(); group.position.set(x, y, z);
  group.userData.type = 'barrel';
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 12), M.barrel);
  barrel.position.y = 0.65; barrel.castShadow = true; barrel.receiveShadow = true; group.add(barrel);
  const ringGeo = new THREE.TorusGeometry(0.62, 0.04, 8, 16);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.8 });
  for (let r = 0; r < 2; r++) { const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = 0.3 + r * 0.7; group.add(ring); }
  scene.add(group);
  // Физическое тело
  const body = new CANNON.Body({ mass: 0, material: physGround });
  body.addShape(new CANNON.Cylinder(0.6, 0.6, 1.3, 8));
  body.position.set(x, y + 0.65, z);
  world.addBody(body);
  obstacles.push(group);
}

function addCrate(scene, world, x, y, z, obstacles) {
  const group = new THREE.Group(); group.position.set(x, y, z);
  group.userData.type = 'crate';
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), M.crate);
  crate.position.y = 0.65; crate.castShadow = true; crate.receiveShadow = true; group.add(crate);
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x886633, roughness: 0.6 });
  const cx = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), crossMat); cx.position.y = 0.65; group.add(cx);
  const cz = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4), crossMat); cz.position.y = 0.65; group.add(cz);
  scene.add(group);
  // Физическое тело
  const body = new CANNON.Body({ mass: 0, material: physGround });
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.65, 0.65, 0.65)));
  body.position.set(x, y + 0.65, z);
  world.addBody(body);
  obstacles.push(group);
}

function addBillboard(scene, x, y, z) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = Math.atan2(-x, -z);
  for (const px of [-2, 2]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 6, 8), M.metalDark);
    p.position.set(px, 3, 0); p.castShadow = true; group.add(p);
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), M.boardBg);
  board.position.y = 5.5; board.castShadow = true; group.add(board);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(4, 2.5)), new THREE.LineBasicMaterial({ color: 0x00ffff }));
  frame.position.y = 5.5; group.add(frame);
  scene.add(group);
}

function addStartArch(scene, x, y, z, rotY) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotY;
  for (const sx of [-6, 6]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 1), M.arch);
    p.position.set(sx, 3.5, 0); p.castShadow = true; group.add(p);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 1), M.arch);
  topBar.position.set(0, 7, 0); topBar.castShadow = true; group.add(topBar);
  for (let l = 0; l < 7; l++) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), l % 2 === 0 ? M.greenGlow : M.redGlow);
    light.position.set((l - 3) * 2, 7.5, 0); group.add(light);
  }
  scene.add(group);
}

function addRampPlatform(scene, world, x, y, z, w, d, rotY, height, mat) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotY;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), mat);
  ramp.position.set(0, height, -d / 2); ramp.rotation.x = -Math.atan2(height, d);
  ramp.castShadow = true; ramp.receiveShadow = true; group.add(ramp);
  scene.add(group);
  const body = new CANNON.Body({ mass: 0, material: physGround });
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, 0.2, d / steps / 2)), new CANNON.Vec3(0, height * (1 - t), -d * t + d / 2));
  }
  body.position.set(x, y, z); body.quaternion.setFromEuler(0, rotY, 0);
  world.addBody(body);
}

// Стены по периметру арены
function addWalls(scene, world, size) {
  const half = size / 2;
  const wallHeight = 5;
  const wallThickness = 1;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7, transparent: true, opacity: 0.25 });
  
  const wallPositions = [
    { x: 0, z: -half, w: size + wallThickness * 2, d: wallThickness }, // север
    { x: 0, z: half, w: size + wallThickness * 2, d: wallThickness },  // юг
    { x: -half, z: 0, w: wallThickness, d: size },                     // запад
    { x: half, z: 0, w: wallThickness, d: size },                      // восток
  ];
  
  for (const wp of wallPositions) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wp.w, wallHeight, wp.d), wallMat);
    mesh.position.set(wp.x, wallHeight / 2, wp.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    
    const body = new CANNON.Body({ mass: 0, material: physGround });
    body.addShape(new CANNON.Box(new CANNON.Vec3(wp.w / 2, wallHeight / 2, wp.d / 2)));
    body.position.set(wp.x, wallHeight / 2, wp.z);
    world.addBody(body);
  }
}

// ==================== ГЛАВНАЯ ФУНКЦИЯ ====================

export function createTrack(scene, world) {
  const W = CONFIG.world.trackWidth;
  const obstacles = [];
  const elements = [];

  console.log('🏟️  Строим расширенную арену...');

  // 1. Основная площадка — уменьшаем до 200x200
  const arenaSize = 200;
  const arenaGeo = new THREE.PlaneGeometry(arenaSize, arenaSize);
  const arenaMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 });
  arenaMat.map.repeat.set(3, 3);
  const arena = new THREE.Mesh(arenaGeo, arenaMat);
  arena.rotation.x = -Math.PI / 2; arena.position.y = -0.05; arena.receiveShadow = true;
  scene.add(arena);

  // Физический слой для поля
  const arenaBody = new CANNON.Body({ mass: 0, material: physGround });
  arenaBody.addShape(new CANNON.Box(new CANNON.Vec3(arenaSize / 2, 0.1, arenaSize / 2)));
  arenaBody.position.set(0, 0, 0);
  world.addBody(arenaBody);

  // Стены по периметру
  addWalls(scene, world, arenaSize);

  // 2. Дорожная сеть — расширенная
  const outerRing = [
    new THREE.Vector3(-30, 0, -30), new THREE.Vector3(30, 0, -30),
    new THREE.Vector3(30, 0, 30), new THREE.Vector3(-30, 0, 30), new THREE.Vector3(-30, 0, -30),
  ];
  addRoad(scene, outerRing, W, world, 0.01);
  
  const innerCircle = [];
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; innerCircle.push(new THREE.Vector3(Math.cos(a) * 30, 0, Math.sin(a) * 30)); }
  addRoad(scene, innerCircle, W, world, 0.015);
  
  addRoad(scene, [new THREE.Vector3(-30, 0, -30), new THREE.Vector3(0, 0, 0), new THREE.Vector3(30, 0, 30)], W * 0.8, world, 0.02);
  addRoad(scene, [new THREE.Vector3(30, 0, -30), new THREE.Vector3(0, 0, 0), new THREE.Vector3(-30, 0, 30)], W * 0.8, world, 0.025);
  
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addRoad(scene, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 40, 0, Math.sin(a) * 40)], W * 0.6, world, 0.03 + i * 0.001);
  }

  // Разметка на внешнем кольце
  const outerRingMarkings = [
    new THREE.Vector3(-115, 0, -115), 
    new THREE.Vector3(115, 0, -115), 
    new THREE.Vector3(115, 0, 115), 
    new THREE.Vector3(-115, 0, 115), 
    new THREE.Vector3(-115, 0, -115)
  ];
  addRoadMarkings(scene, outerRingMarkings, 1.2);

  // Разметка на внутреннем кольце
  const innerMarkings = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; innerMarkings.push(new THREE.Vector3(Math.cos(a) * 75, 0, Math.sin(a) * 75)); }
  addRoadMarkings(scene, innerMarkings, 1.0);
  for (let i = 0; i < 10; i++) {
    const gx = (Math.random() - 0.5) * 80, gz = (Math.random() - 0.5) * 80;
    if (Math.abs(gx) < 20 && Math.abs(gz) < 20) continue;
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(6 + Math.random() * 4, 4 + Math.random() * 3), M.gravel);
    gp.rotation.x = -Math.PI / 2; gp.position.set(gx, 0.005, gz); gp.receiveShadow = true; scene.add(gp);
  }

  // 4. Петли
  addLoop(scene, world, -30, 0, 45, 3, 0, elements);
  addLoop(scene, world, 30, 0, -45, 3, Math.PI, elements);

    // 6. Декорации (деревья и трибуны удалены)
    // addGrandstand(scene, world, -35, 0, 35, 0);
    // addGrandstand(scene, world, 35, 0, 35, Math.PI);
    
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; addLampPost(scene, Math.cos(a) * 50, 0, Math.sin(a) * 50); }
    // for (let i = 0; i < 80; i++) { const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 20; addTree(scene, Math.cos(a) * d, 0, Math.sin(a) * d); }
  
  // Переместим "горы" (billboard) дальше от центра, чтобы не закрывали чекпоинты
  // Увеличиваем радиус расположения с 30-70 до 45-105
  // Переместим "горы" (billboard) ещё дальше от центра, чтобы они не закрывали чекпоинты
  // Увеличиваем радиус до ~150 м
  // Увеличим радиус расположения гор до ~200 м, чтобы они точно не закрывали чекпоинты
  // Увеличим радиус до ~300 м, чтобы горы полностью не мешали чекпоинтам
  // Увеличим радиус до ~400 м, чтобы горы полностью не мешали чекпоинтам
  const bb = [
    [-160, 0, 320], [160, 0, 320],
    [-320, 0, 160], [320, 0, -160],
    [-320, 0, -160], [320, 0, 160],
    [0, 0, 400], [0, 0, -400]
  ];
  for (const [bx, by, bz] of bb) addBillboard(scene, bx, by, bz);
  addStartArch(scene, 0, 0, -85, Math.PI);

  // 7. Сегменты для lapCounter
  const trackPoints = [];
  // Уменьшаем радиус чекпоинтов, чтобы они не попадали в деревья
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    // Теперь 15 для ещё более компактного поля чекпоинтов
    trackPoints.push(new THREE.Vector3(Math.cos(a) * 15, 0, Math.sin(a) * 15));
  }

  console.log('✅ Расширенная арена готова!');
  // Задаём стартовую позицию в центре маленькой арены
  return { segments: trackPoints, spawnPos: new THREE.Vector3(0, 0.5, -15), spawnRot: { y: Math.PI }, obstacles, elements };
}