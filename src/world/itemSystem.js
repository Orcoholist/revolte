import * as THREE from 'three';
import { Rocket } from './rocket.js';
import { Mine } from './mine.js';

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
    const group = new THREE.Group();

    switch (this.type) {
      case ItemType.ROCKET:
        // Детализированная ракета
        const rocketBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.4, 2, 12),
          new THREE.MeshPhongMaterial({
            color: 0xcc3333,
            emissive: 0xff2200,
            emissiveIntensity: 0.8,
            shininess: 100
          })
        );
        rocketBody.rotation.x = Math.PI / 2;
        rocketBody.position.y = 0.5;
        group.add(rocketBody);

        // Нос ракеты
        const rocketNose = new THREE.Mesh(
          new THREE.ConeGeometry(0.4, 0.8, 12),
          new THREE.MeshPhongMaterial({
            color: 0xff6644,
            emissive: 0xff4400,
            emissiveIntensity: 0.8,
            shininess: 100
          })
        );
        rocketNose.rotation.x = -Math.PI / 2;
        rocketNose.position.z = -1.4;
        rocketNose.position.y = 0.5;
        group.add(rocketNose);

        // Хвостовое оперение
        for (let i = 0; i < 4; i++) {
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.5, 0.4),
            new THREE.MeshPhongMaterial({
              color: 0xff2222,
              emissive: 0xff0000,
              emissiveIntensity: 0.6
            })
          );
          const angle = (i / 4) * Math.PI * 2;
          fin.position.set(
            Math.cos(angle) * 0.3,
            0.5,
            1.3
          );
          fin.rotation.y = angle;
          group.add(fin);
        }

        // Огонь в хвосте
        const rocketFlame = new THREE.Mesh(
          new THREE.ConeGeometry(0.2, 0.6, 8),
          new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.8
          })
        );
        rocketFlame.rotation.x = -Math.PI / 2;
        rocketFlame.position.z = 1.5;
        rocketFlame.position.y = 0.5;
        group.add(rocketFlame);
        break;
        
      case ItemType.MINE:
        // Детализированная мина с шипами
        const mineCore = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 16, 16),
          new THREE.MeshPhongMaterial({
            color: 0xff6600,
            emissive: 0xff4400,
            emissiveIntensity: 0.6,
            shininess: 50
          })
        );
        group.add(mineCore);

        // Шипы
        for (let i = 0; i < 12; i++) {
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.5, 6),
            new THREE.MeshPhongMaterial({
              color: 0xff3300,
              emissive: 0xff2200,
              emissiveIntensity: 0.8
            })
          );
          const angle = (i / 12) * Math.PI * 2;
          spike.position.set(
            Math.cos(angle) * 0.8,
            0.3,
            Math.sin(angle) * 0.8
          );
          spike.rotation.x = Math.PI / 4;
          spike.rotation.z = angle;
          group.add(spike);
        }

        // Пульсирующее кольцо
        const mineRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.1, 0.08, 8, 24),
          new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.6
          })
        );
        mineRing.rotation.x = Math.PI / 2;
        mineRing.position.y = 0.3;
        group.add(mineRing);
        group.userData.mineRing = mineRing;
        break;
        
      case ItemType.SHIELD:
        // Красивый щит с кольцами
        const shieldCore = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.8, 0),
          new THREE.MeshPhongMaterial({
            color: 0x4488ff,
            emissive: 0x2266ff,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.7,
            shininess: 100
          })
        );
        group.add(shieldCore);

        // Внешнее кольцо
        const shieldOuterRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.2, 0.1, 8, 32),
          new THREE.MeshBasicMaterial({
            color: 0x66aaff,
            transparent: true,
            opacity: 0.8
          })
        );
        shieldOuterRing.rotation.x = Math.PI / 2;
        group.add(shieldOuterRing);

        // Внутреннее кольцо
        const shieldInnerRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.9, 0.08, 8, 24),
          new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.6
          })
        );
        shieldInnerRing.rotation.x = Math.PI / 2;
        group.add(shieldInnerRing);

        // Частицы вокруг щита
        for (let i = 0; i < 6; i++) {
          const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshBasicMaterial({
              color: 0xaaddff,
              transparent: true,
              opacity: 0.8
            })
          );
          const angle = (i / 6) * Math.PI * 2;
          particle.position.set(
            Math.cos(angle) * 1.4,
            0,
            Math.sin(angle) * 1.4
          );
          group.add(particle);
          group.userData.shieldParticles = group.userData.shieldParticles || [];
          group.userData.shieldParticles.push({ mesh: particle, angle });
        }
        break;
        
      case ItemType.SUPERBOOST:
        // Супер-ускорение - большая яркая звезда
        const superBoostCore = new THREE.Mesh(
          new THREE.OctahedronGeometry(1.0, 0),
          new THREE.MeshPhongMaterial({
            color: 0xffd700,
            emissive: 0xffaa00,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9,
            shininess: 100
          })
        );
        group.add(superBoostCore);

        // Дополнительные лучи
        for (let i = 0; i < 8; i++) {
          const ray = new THREE.Mesh(
            new THREE.ConeGeometry(0.15, 0.8, 4),
            new THREE.MeshBasicMaterial({
              color: 0xffcc00,
              transparent: true,
              opacity: 0.7
            })
          );
          const angle = (i / 8) * Math.PI * 2;
          ray.position.set(
            Math.cos(angle) * 1.0,
            0,
            Math.sin(angle) * 1.0
          );
          ray.rotation.x = Math.PI / 2;
          ray.rotation.z = angle;
          group.add(ray);
        }

        // Внешнее свечение
        const superBoostGlow = new THREE.Mesh(
          new THREE.SphereGeometry(1.3, 16, 16),
          new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.2
          })
        );
        group.add(superBoostGlow);
        break;
        
      case ItemType.BOOST:
        // Обычное ускорение - звезда
        const boostCore = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.7, 0),
          new THREE.MeshPhongMaterial({
            color: 0x44ff44,
            emissive: 0x22cc22,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8,
            shininess: 100
          })
        );
        group.add(boostCore);

        // Лучи
        for (let i = 0; i < 6; i++) {
          const ray = new THREE.Mesh(
            new THREE.ConeGeometry(0.1, 0.5, 4),
            new THREE.MeshBasicMaterial({
              color: 0x66ff66,
              transparent: true,
              opacity: 0.6
            })
          );
          const angle = (i / 6) * Math.PI * 2;
          ray.position.set(
            Math.cos(angle) * 0.7,
            0,
            Math.sin(angle) * 0.7
          );
          ray.rotation.x = Math.PI / 2;
          ray.rotation.z = angle;
          group.add(ray);
        }
        break;

      case ItemType.OIL:
        // Масляное пятно - лужа с блеском
        const oilBase = new THREE.Mesh(
          new THREE.CylinderGeometry(1.5, 1.8, 0.08, 24),
          new THREE.MeshPhongMaterial({
            color: 0x222222,
            emissive: 0x111111,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: 0.85,
            shininess: 150
          })
        );
        group.add(oilBase);

        // Блестящие капли
        for (let i = 0; i < 8; i++) {
          const droplet = new THREE.Mesh(
            new THREE.CircleGeometry(0.15 + Math.random() * 0.1, 8),
            new THREE.MeshBasicMaterial({
              color: 0x444444,
              transparent: true,
              opacity: 0.6
            })
          );
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 1.2;
          droplet.position.set(
            Math.cos(angle) * dist,
            0.05,
            Math.sin(angle) * dist
          );
          droplet.rotation.x = -Math.PI / 2;
          group.add(droplet);
        }
        break;

      default:
        // Заглушка
        const defaultMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshPhongMaterial({ color: color })
        );
        group.add(defaultMesh);
    }

    group.position.copy(this.position);
    group.position.y += 0.5;

    return group;
  }
  
  update(dt) {
    if (this.collected) {
      // Анимация исчезновения при сборе
      this.collectAnimTime = (this.collectAnimTime || 0) + dt;
      const progress = this.collectAnimTime / 0.3; // 0.3 секунды на исчезновение

      if (progress >= 1) {
        this.destroy();
        return true; // Нужно удалить из массива
      }

      // Масштаб уменьшается
      const scale = 1 - progress;
      this.mesh.scale.set(scale, scale, scale);
      // Поворот ускоряется
      this.mesh.rotation.y += dt * 10;
      // Прозрачность
      this.mesh.traverse((child) => {
        if (child.material) {
          child.material.opacity = (child.material.opacity || 1) * (1 - progress);
          child.material.transparent = true;
        }
      });
      return false;
    }

    // Вращение предмета
    this.mesh.rotation.y += dt * 2;
    this.mesh.rotation.z = Math.sin(Date.now() * 0.003) * 0.2;
    
    // Пульсация
    const scale = 1 + Math.sin(Date.now() * 0.005) * 0.15;
    this.mesh.scale.set(scale, scale, scale);
    
    // Дополнительная анимация для особых предметов
    if (this.type === ItemType.MINE && this.mesh.userData.mineRing) {
      this.mesh.userData.mineRing.rotation.z += dt * 3;
      this.mesh.userData.mineRing.scale.setScalar(1 + Math.sin(Date.now() * 0.008) * 0.1);
    }

    if (this.type === ItemType.SHIELD && this.mesh.userData.shieldParticles) {
      for (const p of this.mesh.userData.shieldParticles) {
        p.angle += dt * 2;
        p.mesh.position.x = Math.cos(p.angle) * 1.4;
        p.mesh.position.z = Math.sin(p.angle) * 1.4;
        p.mesh.position.y = Math.sin(Date.now() * 0.005 + p.angle) * 0.3;
      }
    }

    // Предметы исчезают через 30 секунд
    if (Date.now() - this.time > 30000) {
      this.destroy();
      return true; // Нужно удалить
    }
    return false;
  }
  
  destroy() {
    // Удаляем все части группы и их материалы
    this.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Удаляем саму группу из сцены
    this.scene.remove(this.mesh);
  }
  
  checkCollection(playerPos, threshold = 4.5) {
    if (this.collected) return false;
    const dist = playerPos.distanceTo(this.position);
    if (dist < threshold) {
      this.collected = true;
      this.collectAnimTime = 0; // Начинаем анимацию исчезновения
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
    this.spawnInterval = 5000; // Каждые 5 секунд
    this.lastSpawnTime = 0;
    this.maxTrackItems = 12; // Максимум 12 предметов на трассе
    
    // Активные ракеты
    this.activeRockets = [];

    // Активные мины
    this.activeMines = [];
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
    // Ракеты чаще, остальные равномерно
    const weights = [35, 15, 15, 20, 5, 10]; // rocket, mine, shield, boost, oil, superboost
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
    // Если у игрока уже есть неиспользованный предмет — новые не подбираем
    if (this.playerItems.length > 0) return;

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
        // Супер ускорение
        car.applyBoost(2.5, 2000);
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('superboost', car.mesh);
        }
        return { success: true, message: 'СУПЕР УСКОРЕНИЕ!' };
        
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
        // Масляное пятно
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
        // Супер ускорение
        bot.applyBoost(2.5, 2000);
        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('superboost', bot.mesh);
        }
        return { success: true, message: 'Бот получил супер-ускорение!' };
        
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
        if (window.car && bot.controller) {
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
        oilPos.y = 0.1;

        // Визуальный эффект
        if (window.createItemEffect) {
          window.createItemEffect('oil', bot.mesh);
        }
        
        // Масляное пятно влияет на других участников
        // Реализуется в основной логике игры
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
  }

  /**
   * Проверка столкновений с минами
   */
  checkMineCollisions(carPos, onHit = null) {
    for (let i = this.activeMines.length - 1; i >= 0; i--) {
      const mine = this.activeMines[i];
      if (mine.checkCollision(carPos)) {
        mine.explode();
        this.activeMines.splice(i, 1);
        if (onHit) onHit();
      }
    }
  }
}