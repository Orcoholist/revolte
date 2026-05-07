import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CONFIG } from '../engine/config.js';

/**
 * Загружает 3D модель машины из GLB файла.
 * @param {string} path - Путь к .glb файлу (относительно public/)
 * @param {function} onLoaded - Callback(model: THREE.Group)
 * @param {function} onProgress - Callback(progress: number)
 */
export function loadCarModel(path, onLoaded, onProgress = null) {
  const loader = new GLTFLoader();

  // Опционально: Draco декодер (если модель сжата)
  // Раскомментируй, если используешь сжатые модели:
  /*
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(dracoLoader);
  */

  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;

      // Настройки модели
      model.scale.set(1, 1, 1); // Масштаб (подстрой если нужно)

      // Примечание: поворот модели на 180° не задаём здесь —
      // он затирается каждый кадр в CarController.update().
      // Вместо этого поворот применяется там через rotateY(Math.PI).

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Можно улучшить материалы
          if (child.material) {
            child.material.castShadow = true;
            child.material.receiveShadow = true;
          }
        }
      });

      // Центрируем модель
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      onLoaded(model);
    },
    (progress) => {
      if (onProgress && progress.lengthComputable) {
        const percent = (progress.loaded / progress.total) * 100;
        onProgress(percent);
      }
    },
    (error) => {
      console.error('❌ Ошибка загрузки модели:', error);
    }
  );
}

/**
 * Создаёт упрощённую модель (fallback если не загрузилась)
 * @param {number} color - Цвет машины (hex)
 */
export function createFallbackCarModel(color = CONFIG.colors.car) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(2, 0.5, 4);
  const bodyMat = new THREE.MeshStandardMaterial({ 
    color: color,
    metalness: 0.3,
    roughness: 0.7
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  const cabGeo = new THREE.BoxGeometry(1.6, 0.5, 2);
  const cabMat = new THREE.MeshStandardMaterial({ 
    color: CONFIG.colors.cabin,
    metalness: 0.5,
    roughness: 0.5
  });
  const cabin = new THREE.Mesh(cabGeo, cabMat);
  cabin.position.set(0, 0.5, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  return group;
}

/**
 * Перекрашивает модель машины в указанный цвет
 * @param {THREE.Group} model - Модель машины
 * @param {number} bodyColor - Цвет кузова (hex)
 * @param {number} cabinColor - Цвет кабины (hex, опционально)
 */
export function recolorCarModel(model, bodyColor, cabinColor = null) {
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      // Клонируем материал чтобы не влиять на другие экземпляры
      child.material = child.material.clone();
      
      // Определяем тип материала по имени или текущему цвету
      const currentColor = child.material.color.getHex();
      
      if (cabinColor && currentColor === CONFIG.colors.cabin) {
        child.material.color.setHex(cabinColor);
      } else if (bodyColor) {
        // Красим кузов
        child.material.color.setHex(bodyColor);
        child.material.metalness = 0.4;
        child.material.roughness = 0.6;
      }
    }
  });
}
