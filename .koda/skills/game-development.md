---
name: Game Development
description: Навыки для разработки игр на Three.js и Cannon.js
version: 1.0.0
---

# Game Development Skills

## 🎮 Three.js

### Создание 3D сцены
```javascript
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
```

### Загрузка моделей GLTF
```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('path/to/model.glb', (gltf) => {
  scene.add(gltf.scene);
});
```

### Освещение
- AmbientLight — фоновое освещение
- DirectionalLight — солнце/направленный свет
- HemisphereLight — небо/земля
- PointLight — точечный источник

## 🔨 Физика (Cannon.js)

### Создание мира
```javascript
import * as CANNON from 'cannon-es';

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
```

### Материалы и трение
```javascript
const groundMat = new CANNON.Material('ground');
const wheelMat = new CANNON.Material('wheel');

const contactMat = new CANNON.ContactMaterial(wheelMat, groundMat, {
  friction: 0.6,
  restitution: 0.1
});
world.addContactMaterial(contactMat);
```

## 🎯 Оптимизация игр

1. **Используйте InstancedMesh для повторяющихся объектов**
2. **Ограничьте количество света с тенями**
3. **Кэшируйте загруженные ассеты**
4. **Используйте LOD (Level of Detail)**
5. **Оптимизируйте геометрию (merge geometries)**

## 🎨 UI/UX в играх

- HUD поверх канваса (HTML/CSS)
- Анимации с GSAP или CSS transitions
- Адаптивность для мобильных устройств
- Touch controls

## 📦 Архитектура проекта

```
src/
├── engine/       # Ядро (рендерер, физика, конфиг)
├── world/        # Трасса, окружение, препятствия
├── car/          # Логика машины
├── controls/     # Управление (клавиатура, тач)
├── ui/           # HUD, меню
└── main.js       # Точка входа
```

## 🧪 Тестирование

1. Откройте DevTools → Performance
2. Проверяйте FPS (цель: 60 FPS)
3. Следите за памятью (нет утечек)
4. Тестируйте на разных устройствах

## 🚀 Развёртывание

```bash
# Сборка
npm run build

# Локальный просмотр
npm run preview

# Для Telegram Mini App
# Задеплойте dist/ на Vercel/Netlify
```
