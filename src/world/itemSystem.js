import * as THREE from 'three';

/**
 * Система предметов на трассе (как в Revolt!)
 * Предметы появляются в случайных местах, игрок собирает их и может использовать через Ctrl
 */

// Типы предметов
export const ItemType = {
  ROCKET: 'rocket',      // Ракета - стреляет впереди идущего
  MINE: 'mine',          // Мина - ставится на трассе
  SHIELD: 'shield',      // Щит - защита от атак
  BOOST: 'boost',        // Ускорение
  OIL: 'oil',            // Масляное пятно
  SUPERBOOST: 'superboost' // Супер ускорение
};

// Цвета для каждого типа предмета
const itemColors = {
  [ItemType.ROCKET]: 0xff4444,
  [ItemType.MINE]: 0xff8800,
  [ItemType.SHIELD]: 0x4488ff,
  [ItemType.BOOST]: 0x44ff44,
  [ItemType.OIL]: 0x333333,
  [ItemType.SUPERBOOST]: 0xffd700
};

// Названия предметов для UI
const itemNames = {
  [ItemType.ROCKET]: 'Ракета',
  [ItemType.MINE]: 'Мина',
  [ItemType.SHIELD]: 'Щит',
  [ItemType.BOOST]: 'Ускорение',
  [ItemType.OIL]: 'Масло',
  [ItemType.SUPERBOOST]: 'Супер-ускорение'
};

// Иконки для UI
const itemIcons = {
  [ItemType.ROCKET]: '🚀',
  [ItemType.MINE]: '💣',
  [ItemType.SHIELD]: '🛡️',
  [ItemType.BOOST]: '⚡',
  [ItemType.OIL]: '🛢️',
  [ItemType.SUPERBOOST]: '🔥'
};

/**
 * Класс предмета на трассе
 */
class TrackItem {
  constructor(type, position, scene) {
    this.type = type;
    // Берём только x/z от сегмента трассы; y = 0 — предмет всегда на земле
    this.position = new THREE.Vector3(position.x, 0, position.z);
    this.scene = scene;
    this.collected = false;
    this.time = Date.now();
    
    // Создаём визуальное представление
    this.mesh = this._createMesh();
    this.scene.add(this.mesh);
  }
  
  _createMesh() {
    const color = itemColors[this.type];
    let geometry, material, mesh;
    
    switch (this.type) {
      case ItemType.ROCKET:
        // Конус для ракеты
        geometry = new THREE.ConeGeometry(0.8, 2, 8);
        material = new THREE.MeshPhongMaterial({ 
          color: color, 
          emissive: color,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.8
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2; // Лежит горизонтально
        break;
        
      case ItemType.MINE:
        // Сфера для мины
        geometry = new THREE.SphereGeometry(0.8, 8, 8);
        material = new THREE.MeshPhongMaterial({ 
          color: color,
          emissive: color,
          emissiveIntensity: 0.3
        });
        mesh = new THREE.Mesh(geometry, material);
        break;
        
      case ItemType.SHIELD:
        // Икосаэдр for щита
        geometry = new THREE.IcosahedronGeometry(1, 0);
        material = new THREE.MeshPhongMaterial({ 
          color: color,
          emissive: color,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.6,
          wireframe: true
        });
        mesh = new THREE.Mesh(geometry, material);
        break;
        
      case ItemType.BOOST:
      case ItemType.SUPERBOOST:
        // Звезда для ускорения
        geometry = new THREE.OctahedronGeometry(0.8, 0);
        material = new THREE.MeshPhongMaterial({ 
          color: color,
          emissive: color,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.8
        });
        mesh = new THREE.Mesh(geometry, material);
        break;
        
      case ItemType.OIL:
        // Плоский цилиндр для масла
        geometry = new THREE.CylinderGeometry(1, 1, 0.1, 12);
        material = new THREE.MeshPhongMaterial({ 
          color: color,
          transparent: true,
          opacity: 0.7
        });
        mesh = new THREE.Mesh(geometry, material);
        break;
        
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
        material = new THREE.MeshPhongMaterial({ color: color });
        mesh = new THREE.Mesh(geometry, material);
    }
    
    mesh.position.copy(this.position);
    mesh.position.y += 0.5; // Лежит на земле (чуть выше поверхности)
    
    // Добавляем свечение (точечный свет)
    const light = new THREE.PointLight(color, 0.3, 6);
    light.position.copy(this.position);
    light.position.y += 1;
    this.scene.add(light);
    mesh.userData.light = light;
    
    return mesh;
  }
  
  update(dt) {
    if (this.collected) return;
    
    // Вращение предмета
    this.mesh.rotation.y += dt * 2;
    this.mesh.rotation.z = Math.sin(Date.now() * 0.003) * 0.2;
    
    // Пульсация
    const scale = 1 + Math.sin(Date.now() * 0.005) * 0.15;
    this.mesh.scale.set(scale, scale, scale);
    
    // Свет тоже пульсирует
    if (this.mesh.userData.light) {
      this.mesh.userData.light.intensity = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
    }
    
    // Предметы исчезают через 30 секунд
    if (Date.now() - this.time > 30000) {
      this.destroy();
      return true; // Нужно удалить
    }
    return false;
  }
  
  destroy() {
    this.scene.remove(this.mesh);
    if (this.mesh.userData.light) {
      this.scene.remove(this.mesh.userData.light);
    }
  }
  
  checkCollection(playerPos, threshold = 3) {
    if (this.collected) return false;
    const dist = playerPos.distanceTo(this.position);
    if (dist < threshold) {
      this.collected = true;
      return true;
    }
    return false;
  }
}

/**
 * Основная система предметов
 */
export class ItemSystem {
  constructor(scene) {
    this.scene = scene;
    this.trackItems = [];
    this.playerItems = []; // Предметы у игрока
    this.activeItem = null; // Активный предмет (готов к использованию)
    this.itemCooldown = 2000; // 2 секунды задержки перед использованием
    this.maxPlayerItems = 2; // Максимум 2 предмета у игрока
    
    // Спавн предметов на трассе
    this.spawnInterval = 8000; // Каждые 8 секунд
    this.lastSpawnTime = 0;
    this.maxTrackItems = 6; // Максимум 6 предметов на трассе
  }
  
  /**
   * Спавн случайного предмета в случайной позиции
   */
  spawnItem(trackSegments) {
    if (this.trackItems.length >= this.maxTrackItems) return;
    if (!trackSegments || trackSegments.length === 0) return;
    
    // Случайная позиция на трассе
    const idx = Math.floor(Math.random() * trackSegments.length);
    const pos = trackSegments[idx].clone();
    
    // Случайное смещение по ширине трассы
    const nextIdx = (idx + 1) % trackSegments.length;
    const dir = new THREE.Vector3().subVectors(trackSegments[nextIdx], pos).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const offset = (Math.random() - 0.5) * 5;
    pos.add(perp.multiplyScalar(offset));
    
    // Случайный тип предмета
    const types = Object.values(ItemType);
    // Более редкие предметы
    const weights = [25, 20, 15, 20, 10, 10]; // rocket, mine, shield, boost, oil, superboost
    const type = this._weightedRandom(types, weights);
    
    const item = new TrackItem(type, pos, this.scene);
    this.trackItems.push(item);
    
    console.log('Item spawned: ' + itemNames[type] + ' at (' + pos.x.toFixed(0) + ', ' + pos.z.toFixed(0) + ')');
  }
  
  _weightedRandom(items, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    return items[items.length - 1];
  }
  
  /**
   * Проверка сбора предметов игроком
   */
  checkItemCollection(playerPos) {
    for (let i = this.trackItems.length - 1; i >= 0; i--) {
      const item = this.trackItems[i];
      if (item.checkCollection(playerPos)) {
        // Игрок собрал предмет!
        this._collectItem(item);
        this.trackItems.splice(i, 1);
      }
    }
  }
  
  _collectItem(item) {
    console.log('Collected: ' + itemNames[item.type]);
    
    if (this.playerItems.length < this.maxPlayerItems) {
      this.playerItems.push({
        type: item.type,
        time: Date.now(),
        ready: false
      });
      
      // Показываем уведомление
      this._showCollectNotification(item.type);
    } else {
      console.log('Inventory full!');
    }
  }
  
  _showCollectNotification(type) {
    // Создаём временное уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      font-size: 24px;
      font-weight: bold;
      z-index: 1000;
      pointer-events: none;
      animation: fadeInOut 1.5s ease-out;
      border: 2px solid #${itemColors[type].toString(16).padStart(6, '0')};
    `;
    notification.textContent = itemIcons[type] + ' ' + itemNames[type];
    document.body.appendChild(notification);
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        30% { transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 1500);
  }
  
  /**
   * Использование предмета (Ctrl)
   */
  useItem() {
    // Ищем готовый предмет (прошло 2 секунды)
    const now = Date.now();
    const readyItem = this.playerItems.find(item => {
      if (!item.ready && now - item.time >= this.itemCooldown) {
        item.ready = true;
      }
      return item.ready;
    });
    
    if (!readyItem) {
      console.log('No item ready! Wait 2 seconds after collecting.');
      return null;
    }
    
    // Удаляем предмет из инвентаря
    const idx = this.playerItems.indexOf(readyItem);
    this.playerItems.splice(idx, 1);
    
    console.log('Using item: ' + itemNames[readyItem.type]);
    return readyItem.type;
  }
  
  /**
   * Обновление системы
   */
  update(dt, trackSegments) {
    // Спавн новых предметов
    const now = Date.now();
    if (now - this.lastSpawnTime > this.spawnInterval) {
      this.spawnItem(trackSegments);
      this.lastSpawnTime = now;
    }
    
    // Обновление предметов на трассе
    for (let i = this.trackItems.length - 1; i >= 0; i--) {
      const shouldRemove = this.trackItems[i].update(dt);
      if (shouldRemove) {
        this.trackItems.splice(i, 1);
      }
    }
    
    // Проверяем готовность предметов
    const readyItem = this.playerItems.find(item => 
      !item.ready && now - item.time >= this.itemCooldown
    );
    if (readyItem) {
      readyItem.ready = true;
      this._showItemReadyNotification(readyItem.type);
    }
  }
  
  _showItemReadyNotification(type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 150px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 255, 0, 0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 1000;
      pointer-events: none;
      animation: slideUp 2s ease-out;
    `;
    notification.textContent = itemIcons[type] + ' ' + itemNames[type] + ' готов! Нажми Ctrl';
    document.body.appendChild(notification);
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 2000);
  }
  
  /**
   * Получить текущий предмет для отображения в UI
   */
  getCurrentItem() {
    const readyItem = this.playerItems.find(item => item.ready);
    if (readyItem) {
      return {
        type: readyItem.type,
        icon: itemIcons[readyItem.type],
        name: itemNames[readyItem.type]
      };
    }
    
    // Показываем первый предмет с таймером
    if (this.playerItems.length > 0) {
      const item = this.playerItems[0];
      const elapsed = Date.now() - item.time;
      const remaining = Math.max(0, (this.itemCooldown - elapsed) / 1000);
      return {
        type: item.type,
        icon: itemIcons[item.type],
        name: itemNames[item.type],
        cooldown: remaining
      };
    }
    
    return null;
  }
  
  /**
   * Применить эффект предмета
   */
  applyItemEffect(type, car) {
    switch (type) {
      case ItemType.BOOST:
        // Временное ускорение
        car.applyBoost(1.5, 3000);
        return { success: true, message: 'Ускорение!' };
        
      case ItemType.SUPERBOOST:
        // Супер ускорение
        car.applyBoost(2.5, 2000);
        return { success: true, message: 'СУПЕР УСКОРЕНИЕ!' };
        
      case ItemType.SHIELD:
        // Щит на время
        car.hasShield = true;
        car.shieldTime = Date.now();
        return { success: true, message: 'Щит активирован!' };
        
      case ItemType.ROCKET:
        // Ракета впереди (визуальный эффект)
        return { success: true, message: 'Ракета выпущена!' };
        
      case ItemType.MINE:
        // Мина позади
        return { success: true, message: 'Мина установлена!' };
        
      case ItemType.OIL:
        // Масляное пятно
        return { success: true, message: 'Масло разлито!' };
        
      default:
        return { success: false, message: 'Неизвестный предмет' };
    }
  }
  
  clear() {
    this.trackItems.forEach(item => item.destroy());
    this.trackItems = [];
    this.playerItems = [];
    this.activeItem = null;
  }
}