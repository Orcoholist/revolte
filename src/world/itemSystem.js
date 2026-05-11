import * as THREE from 'three';
import { Rocket } from './rocket.js';
import { Mine } from './mine.js';
import { Oil } from './oil.js';
import { Ball } from './ball.js';

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
  [ItemType.SUPERBOOST]: 'Шар'
};

// Иконки для UI
const itemIcons = {
  [ItemType.ROCKET]: '🚀',
  [ItemType.MINE]: '💣',
  [ItemType.SHIELD]: '🛡️',
  [ItemType.BOOST]: '⚡',
  [ItemType.OIL]: '🛢️',
  [ItemType.SUPERBOOST]: '🔮'
};

/**
 * Кэшированные геометрии и материалы для TrackItem (переиспользуются всеми предметами)
 */
const _itemGeometries = {
  base: new THREE.SphereGeometry(0.7, 12, 12),
  ring: new THREE.TorusGeometry(0.9, 0.15, 8, 12),
  core: new THREE.IcosahedronGeometry(0.4, 1),
  indicator: new THREE.SphereGeometry(0.15, 6, 6)
};

const _itemMaterials = {
  base: new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0x222222,
    emissiveIntensity: 0.5,
    shininess: 80,
    transparent: true,
    opacity: 0.9
  }),
  ring: new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.7
  }),
  core: new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    emissive: 0x00aaaa,
    emissiveIntensity: 0.6,
    shininess: 100
  }),
  indicator: new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9
  })
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
    this._timeAccum = 0;
    
    // Создаём визуальное представление из кэшированных геометрий/материалов
    this.mesh = this._createMesh();
    this.scene.add(this.mesh);
  }
  
  _createMesh() {
    const group = new THREE.Group();
    
    // Клонируем материалы, чтобы анимация сбора не влияла на другие предметы
    const cloneMat = (mat) => mat.clone();
    
    // Base sphere
    const base = new THREE.Mesh(_itemGeometries.base, cloneMat(_itemMaterials.base));
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    
    // Rotating ring
    const ring = new THREE.Mesh(_itemGeometries.ring, cloneMat(_itemMaterials.ring));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    
    // Pulsating inner core
    const core = new THREE.Mesh(_itemGeometries.core, cloneMat(_itemMaterials.core));
    group.add(core);
    
    // Indicator
    const indicator = new THREE.Mesh(_itemGeometries.indicator, cloneMat(_itemMaterials.indicator));
    indicator.position.y = 0.8;
    group.add(indicator);
    
    group.position.copy(this.position);
    group.position.y += 0.5;

    return group;
  }
  
  update(dt, timeAccum) {
    if (this.collected) {
      this.collectAnimTime = (this.collectAnimTime || 0) + dt;
      const progress = this.collectAnimTime / 0.3;

      if (progress >= 1) {
        this.destroy();
        return true;
      }

      const scale = 1 - progress;
      this.mesh.scale.set(scale, scale, scale);
      this.mesh.rotation.y += dt * 10;
      this.mesh.traverse((child) => {
        if (child.material) {
          child.material.opacity = (child.material.opacity || 1) * (1 - progress);
          child.material.transparent = true;
        }
      });
      return false;
    }

    this._timeAccum += dt;
    
    // Вращение предмета
    this.mesh.rotation.y += dt * 2;
    this.mesh.rotation.z = Math.sin(this._timeAccum * 3) * 0.2;
    
    // Пульсация
    const scale = 1 + Math.sin(this._timeAccum * 5) * 0.15;
    this.mesh.scale.set(scale, scale, scale);
    
    // Предметы не исчезают — респавнятся при сборе
    return false;
  }
  
  destroy() {
    // Просто удаляем группу из сцены — геометрии и материалы кэшированы
    this.scene.remove(this.mesh);
  }
  
  checkCollection(playerPos, threshold = 4.5) {
    if (this.collected) return false;
    const dist = playerPos.distanceTo(this.position);
    if (dist < threshold) {
      this.collected = true;
      this.collectAnimTime = 0;
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
    this.spawnInterval = 500; // Каждые 0.5 секунды (было 800)
    this.lastSpawnTime = 0;
    this.maxTrackItems = 100; // Больше предметов на карте (было 60)
    
    // Активные ракеты
    this.activeRockets = [];

    // Активные мины
    this.activeMines = [];

    // Активные масляные пятна
    this.activeOils = [];

    // Активные шары
    this.activeBalls = [];
  }

  /**
   * Спавн случайного предмета в случайной позиции на всей карте
   */
  spawnItem(trackSegments) {
    if (this.trackItems.length >= this.maxTrackItems) return;
    
    // Случайная позиция по всей карте 600x600
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 280,
      0,
      (Math.random() - 0.5) * 280
    );
    
    // Случайный тип предмета
    const types = Object.values(ItemType);
    // Ракеты чаще, остальные равномерно
    const weights = [35, 15, 15, 20, 5, 10]; // rocket, mine, shield, boost, oil, superboost
    const type = this._weightedRandom(types, weights);
    
    const item = new TrackItem(type, pos, this.scene);
    this.trackItems.push(item);
    
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
    // Если у игрока уже макс предметов — новые не подбираем
    if (this.playerItems.length >= this.maxPlayerItems) return;

    for (let i = this.trackItems.length - 1; i >= 0; i--) {
      const item = this.trackItems[i];
      if (!item.collected && item.checkCollection(playerPos)) {
        // Игрок собрал предмет!
        this._collectItem(item);
        // НЕ удаляем из массива сразу - анимация исчезновения будет в update()
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
    // Уведомление убрано — предмет отображается в индикаторе
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
    // Спавн новых предметов — по 3 за раз, каждые 500мс (более стабильно)
    const now = Date.now();
    if (now - this.lastSpawnTime > 500) {
      const spawnCount = Math.max(3, this.maxTrackItems - this.trackItems.length);
      for (let i = 0; i < Math.min(spawnCount, 5); i++) {
        this.spawnItem(trackSegments);
      }
      this.lastSpawnTime = now;
    }
    
    // Обновление предметов на трассе
    for (let i = this.trackItems.length - 1; i >= 0; i--) {
      const shouldRemove = this.trackItems[i].update(dt);
      if (shouldRemove) {
        this.trackItems.splice(i, 1);
      }
    }
    
    // Обновление активных ракет
    for (let i = this.activeRockets.length - 1; i >= 0; i--) {
      const rocket = this.activeRockets[i];
      rocket.update(dt);
      if (!rocket.alive) {
        this.activeRockets.splice(i, 1);
      }
    }
    
    // Обновление активных мин
    for (let i = this.activeMines.length - 1; i >= 0; i--) {
      const mine = this.activeMines[i];
      const shouldRemove = mine.update(dt);
      if (shouldRemove) {
        this.activeMines.splice(i, 1);
      }
    }
    
    // Обновление масляных пятен
    for (let i = this.activeOils.length - 1; i >= 0; i--) {
      const oil = this.activeOils[i];
      const shouldRemove = oil.update(dt);
      if (shouldRemove) {
        this.activeOils.splice(i, 1);
      }
    }
    
    // Обновление шаров
    for (let i = this.activeBalls.length - 1; i >= 0; i--) {
      const ball = this.activeBalls[i];
      const shouldRemove = ball.update(dt);
      if (shouldRemove) {
        this.activeBalls.splice(i, 1);
      }
    }
    
    // Проверяем готовность предметов
    for (const item of this.playerItems) {
      if (!item.ready && now - item.time >= this.itemCooldown) {
        item.ready = true;
        this._showItemReadyNotification(item.type);
      }
    }
    
    // Проверка сбора предметов ботами
    if (window.botManager) {
      for (let i = this.trackItems.length - 1; i >= 0; i--) {
        const item = this.trackItems[i];
        if (!item.collected) {
          const bot = window.botManager.checkItemCollection(item.position, item.type);
          if (bot) {
            // Remove the item from the track
            item.destroy();
            this.trackItems.splice(i, 1);
            
            // Add the item to the bot's inventory
            if (bot.items && Array.isArray(bot.items)) {
              // Check if bot already has an item - if so, don't pick up a new one
              if (bot.items.length > 0) {
                // Bot already has an item, skip picking up this one
                continue;
              }
              
              // Add the item to bot's inventory
              bot.items.push({
                type: item.type,
                time: Date.now(),
                ready: false  // Item needs to cool down before use
              });
              
              // Visual effect
              if (window.createItemEffect) {
                window.createItemEffect('item-collect', item.mesh);
              }
            }
          }
        }
      }
    }
  }
  
  _showItemReadyNotification(type) {
    // Уведомление убрано — готовность отображается в индикаторе (подсветка)
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
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('boost', car.mesh);
        }
        return { success: true, message: 'Ускорение!' };
        
      case ItemType.SUPERBOOST:
        // Шар — появляется за машиной и катится в том же направлении
        const ballBackward = new THREE.Vector3(0, 0, 1);
        ballBackward.applyQuaternion(car.mesh.quaternion);
        const ballPos = car.mesh.position.clone().add(ballBackward.multiplyScalar(4));
        ballPos.y = 0;
        
        // Направление движения шара — туда же, куда едет игрок
        const ballDir = new THREE.Vector3(0, 0, -1);
        ballDir.applyQuaternion(car.mesh.quaternion);
        
        const ball = new Ball(ballPos, ballDir, this.scene);
        this.activeBalls.push(ball);
        
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('superboost', car.mesh);
        }
        return { success: true, message: 'Шар выпущен!' };
        
      case ItemType.SHIELD:
        // Щит на время
        car.hasShield = true;
        car.shieldTime = Date.now();
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('shield', car.mesh);
        }
        return { success: true, message: 'Щит активирован!' };
        
      case ItemType.ROCKET:
        // Создаем ракету
        if (window.car && window.botManager) {
          const rocket = new Rocket(window.car.mesh, this.scene, window.botManager);
          this.activeRockets.push(rocket);
          // Визуальный эффект
          if (window.createItemEffect) {
            window.createItemEffect('rocket', car.mesh);
          }
          return { success: true, message: 'Ракета выпущена!' };
        }
        return { success: false, message: 'Ошибка запуска ракеты!' };
        
      case ItemType.MINE:
        // Мина позади машины
        const backward = new THREE.Vector3(0, 0, 1);
        backward.applyQuaternion(car.mesh.quaternion);
        const minePos = car.mesh.position.clone().add(backward.multiplyScalar(3));
        minePos.y = 0;

        const mine = new Mine(minePos, this.scene);
        this.activeMines.push(mine);

        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('mine', car.mesh);
        }
        return { success: true, message: 'Мина установлена!' };
        
      case ItemType.OIL:
        // Масляное пятно позади машины
        const oilBackward = new THREE.Vector3(0, 0, 1);
        oilBackward.applyQuaternion(car.mesh.quaternion);
        const oilPos = car.mesh.position.clone().add(oilBackward.multiplyScalar(3));
        
        const oil = new Oil(oilPos, this.scene, car);
        this.activeOils.push(oil);
        
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('oil', car.mesh);
        }
        return { success: true, message: 'Масло разлито!' };
        
      default:
        return { success: false, message: 'Неизвестный предмет' };
    }
  }
  
  /**
   * Применить эффект предмета для бота
   */
  applyItemEffectToBot(type, bot) {
    switch (type) {
      case ItemType.BOOST:
        // Временное ускорение
        bot.applyBoost(1.5, 3000);
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('boost', bot.mesh);
        }
        return { success: true, message: 'Бот получил ускорение!' };
        
      case ItemType.SUPERBOOST:
        // Шар — появляется за ботом и катится в том же направлении
        const ballBackward = new THREE.Vector3(0, 0, 1);
        ballBackward.applyQuaternion(bot.mesh.quaternion);
        const ballPos = bot.mesh.position.clone().add(ballBackward.multiplyScalar(4));
        ballPos.y = 0;
        
        const ballDir = new THREE.Vector3(0, 0, -1);
        ballDir.applyQuaternion(bot.mesh.quaternion);
        
        const ball = new Ball(ballPos, ballDir, this.scene);
        this.activeBalls.push(ball);
        
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('superboost', bot.mesh);
        }
        return { success: true, message: 'Бот выпустил шар!' };
        
      case ItemType.SHIELD:
        // Щит на время
        bot.hasShield = true;
        bot.shieldTime = Date.now();
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('shield', bot.mesh);
        }
        return { success: true, message: 'Бот получил щит!' };
        
      case ItemType.ROCKET:
        // Создаем ракету, направленную на игрока
        if (window.car && window.botManager) {
          // Направляем ракету от позиции бота к позиции игрока
          const rocket = new Rocket(bot.mesh, this.scene, window.botManager);
          this.activeRockets.push(rocket);
          // Визуальный эффект
          if (window.createItemEffect) {
            window.createItemEffect('rocket', bot.mesh);
          }
          return { success: true, message: 'Бот выпустил ракету!' };
        }
        return { success: false, message: 'Ошибка запуска ракеты!' };
        
      case ItemType.MINE:
        // Мина позади бота
        const backward = new THREE.Vector3(0, 0, 1);
        backward.applyQuaternion(bot.mesh.quaternion);
        const minePos = bot.mesh.position.clone().add(backward.multiplyScalar(3));
        minePos.y = 0;

        const mine = new Mine(minePos, this.scene);
        this.activeMines.push(mine);

        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('mine', bot.mesh);
        }
        return { success: true, message: 'Бот установил мину!' };
        
      case ItemType.OIL:
        // Масляное пятно позади бота
        const oilBackward = new THREE.Vector3(0, 0, 1);
        oilBackward.applyQuaternion(bot.mesh.quaternion);
        const oilPos = bot.mesh.position.clone().add(oilBackward.multiplyScalar(2));
        
        const oil = new Oil(oilPos, this.scene);
        this.activeOils.push(oil);
        
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('oil', bot.mesh);
        }
        return { success: true, message: 'Бот оставил масляное пятно!' };
        
      default:
        return { success: false, message: 'Неизвестный предмет' };
    }
  }
  
  clear() {
    this.trackItems.forEach(item => item.destroy());
    this.trackItems = [];
    this.playerItems = [];
    this.activeItem = null;
    
    // Удаляем все активные ракеты
    this.activeRockets.forEach(rocket => rocket.destroy());
    this.activeRockets = [];

    // Удаляем все активные мины
    this.activeMines.forEach(mine => mine.destroy());
    this.activeMines = [];

    // Удаляем все масляные пятна
    this.activeOils.forEach(oil => oil.destroy());
    this.activeOils = [];

    // Удаляем все шары
    this.activeBalls.forEach(ball => ball.destroy());
    this.activeBalls = [];
  }

  /**
   * Проверка столкновений с минами
   */
  checkMineCollisions(car, onHit = null) {
    for (let i = this.activeMines.length - 1; i >= 0; i--) {
      const mine = this.activeMines[i];
      if (mine.checkCollision(car)) {
        mine.explode();
        this.activeMines.splice(i, 1);
        if (onHit) onHit();
      }
    }
  }

  /**
   * Проверка столкновений с масляными пятнами
   */
  checkOilCollisions(car, onHit = null) {
    for (let i = this.activeOils.length - 1; i >= 0; i--) {
      const oil = this.activeOils[i];
      // Пропускаем владельца масла — он не должен пострадать от своего же масла
      if (oil.owner === car) continue;
      if (oil.checkCollision(car)) {
        if (onHit) onHit(oil);
      }
    }
  }

  /**
   * Проверка столкновений с шарами
   */
  checkBallCollisions(car, onHit = null) {
    for (let i = this.activeBalls.length - 1; i >= 0; i--) {
      const ball = this.activeBalls[i];
      if (ball.checkCollision(car)) {
        ball.hitCar(car);
        ball.destroy();
        this.activeBalls.splice(i, 1);
        if (onHit) onHit();
      }
    }
  }
}
