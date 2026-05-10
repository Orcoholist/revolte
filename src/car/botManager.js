import * as THREE from 'three';
import { createWheelMeshes, createCarPhysics, createCarMesh } from './carFactory.js';
import { recolorCarModel } from './carModelLoader.js';
import { BotController } from './botController.js';

/**
 * Менеджер AI-ботов: создаёт ботов на случайных точках трассы,
 * каждый бот гонится по чекпоинтам.
 */
export class BotManager {
  constructor(scene, world, wheelMat, trackSegments) {
    this.scene = scene;
    this.world = world;
    this.wheelMat = wheelMat;
    this.trackSegments = trackSegments;
    this.bots = [];
    this.raceResults = []; // Результаты гонки

    // Генерируем ЕЩЁ БОЛЬШЕ чекпоинтов для плавного движения (20 вместо 10)
    this.checkpoints = this._createCheckpoints(20);

    // Отладочные маркеры чекпоинтов (красные сферы)
    this._createCheckpointMarkers();

    this.botColors = [
      0x4488ff, 0xff4444, 0x44ff44,
      0xffaa00, 0xff00ff, 0x00ffff,
    ];
    
    this.botNames = [
      'AI-Racer', 'Speed-Bot', 'Turbo-X',
      'Nitro-King', 'Drift-Master', 'Thunder',
      'Lightning', 'Storm-X' // Additional names for new bots
    ];
  }

  /**
   * Создаёт хаотичные чекпоинты по всей карте.
   */
  _createCheckpoints(count) {
    const cps = [];
    for (let i = 0; i < count; i++) {
      const cp = new THREE.Vector3(
        (Math.random() - 0.5) * 240,
        0,
        (Math.random() - 0.5) * 240
      );
      cps.push(cp);
    }
    return cps;
  }

  /**
   * Чекпоинты теперь невидимы - только круг на миникарте показывает направление.
   */
  _createCheckpointMarkers() {
    // Ничего не создаём - чекпоинты невидимы для игрока
    // Только боты знают где они (для навигации)
    console.log('Checkpoint markers hidden - bots navigate invisibly');
  }

  /**
   * Создаёт N ботов в случайных точках трассы.
   */
  spawnBots(count) {
    for (let i = 0; i < count; i++) {
      this._createBot(i, count);
    }
    // console.log('Created ' + count + ' bots with UNIQUE routes');
  }

  /**
   * Возвращает позицию спауна бота на краю арены, распределённую симметрично.
   * angle рассчитывается исходя из индекса бота и общего количества, радиус – фиксированный.
   */
  _getEdgeSpawnPosition(index, total) {
    const angle = (index / total) * Math.PI * 2; // равномерно по окружности
    const radius = 30; // расстояние от центра к краю арены (можно подстроить)
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // y берём из первой точки трассы + небольшая надбавка
    const baseY = this.trackSegments.length > 0 ? this.trackSegments[0].y : 0;
    return new THREE.Vector3(x, baseY + 1.5, z);
  }

  _createBot(index, total) {
    // Визуал: реколор модели игрока с уникальным цветом
    const botColor = this.botColors[index % this.botColors.length];
    const carMesh = createCarMesh();
    // Перекрашиваем модель бота в свой цвет
    recolorCarModel(carMesh, botColor, 0x222222);
    this.scene.add(carMesh);
    
    // console.log('Bot ' + index + ': color 0x' + botColor.toString(16).padStart(6, '0'));

    const wheelMeshes = createWheelMeshes();
    wheelMeshes.forEach(w => this.scene.add(w));

    // Физика
    const { chassisBody, vehicle } = createCarPhysics(this.world, this.wheelMat);

    // Позиция спауна бота на краю арены (симметрично)
    const startPos = this._getEdgeSpawnPosition(index, total);

    // Поворот бота – направлен к центру арены
    const dirToCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), startPos).normalize();
    const rotY = Math.atan2(dirToCenter.x, dirToCenter.z);

    chassisBody.position.set(startPos.x, startPos.y, startPos.z);
    chassisBody.quaternion.setFromEuler(0, rotY, 0);

    // AI контроллер с УНИКАЛЬНЫМ маршрутом
    const startCp = 0; // Уникальный маршрут уже начинается с нужной точки
    
    // Создаём УНИКАЛЬНЫЙ маршрут для каждого бота
    const uniqueRoute = this._createUniqueRouteForBot(index);
    
    // console.log('Bot ' + index + ': spawn (' + startPos.x.toFixed(1) + ', ' + startPos.y.toFixed(1) + ', ' + startPos.z.toFixed(1) + '), target checkpoint ' + startCp);
    const bot = new BotController(
      chassisBody,
      vehicle,
      carMesh,
      wheelMeshes,
      uniqueRoute,
      startCp,
      index
    );

    this.bots.push({ 
      controller: bot, 
      spawnPos: startPos, 
      spawnRot: rotY, 
      startCp, 
      name: this.botNames[index % this.botNames.length],
      items: [] // Initialize items array
    });
  }

  /**
   * Создаёт УНИКАЛЬНЫЙ маршрут для каждого бота!
   * Бот следует по перемешанным чекпоинтам трассы с уникальной случайной последовательностью для каждого бота.
   */
  _createUniqueRouteForBot(botIndex) {
    // Копируем оригинальные чекпоинты
    const originalCheckpoints = [...this.checkpoints];
    
    // Перемешиваем чекпоинты с уникальным сидом для каждого бота
    const shuffledCheckpoints = this._shuffleArray(originalCheckpoints, botIndex);
    
    // Добавляем немного случайности в позициях чекпоинтов для большего разнообразия
    const randomizedCheckpoints = shuffledCheckpoints.map(cp => {
      const newCp = cp.clone();
      // Небольшое смещение для создания разных путей
      newCp.x += (Math.random() - 0.5) * 4;
      newCp.z += (Math.random() - 0.5) * 4;
      return newCp;
    });
    
    return randomizedCheckpoints;
  }
  
  /**
   * Алгоритм Фишера-Йетса с сидом для перемешивания массива
   */
  _shuffleArray(array, seed) {
    // Простой генератор псевдослучайных чисел с сидом
    let randomSeed = seed * 9301 + 49297;
    const pseudoRandom = () => {
      randomSeed = (randomSeed * 1664525 + 1013904223) & 0x7fffffff;
      return randomSeed / 0x7fffffff;
    };
    
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  update(dt) {
    for (const bot of this.bots) {
      if (bot.controller && bot.controller.chassisBody && bot.controller.vehicle) {
        bot.controller.update(dt);
      } else {
        console.warn('Invalid bot controller detected');
      }
    }
  }
      
  reset() {
    this.raceResults = []; // Сбрасываем результаты
    for (const bot of this.bots) {
      bot.controller.reset(bot.spawnPos, bot.spawnRot, bot.startCp);
      // Clear bot's items when resetting
      bot.items = [];
    }
  }

  /**
   * Проверяет, собрал ли какой-то бот предмет
   */
  checkItemCollection(itemPosition, itemType) {
    for (const bot of this.bots) {
      const botPos = bot.controller.chassisBody.position;
      const distance = botPos.distanceTo(itemPosition);
      
      if (distance < 4.5) { // Same threshold as player
        console.log(`${bot.name} detected item collection!`);
        return bot; // Return the bot that is close to the item
      }
    }
    return null;
  }
  
  /**
   * Получить текущие результаты гонки для таблицы лидеров
   * @param {number} playerTime - время игрока (0 если не финишировал)
   * @param {number} playerLaps - круги игрока
   * @returns {Array} массив результатов [{position, name, time, laps, isPlayer}]
   */
  getLeaderboard(playerTime, playerLaps) {
    const results = [];
    const maxLaps = window.state ? window.state.maxLaps : 3;
    
    // Собираем результаты ботов
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const controller = bot.controller;
      const laps = controller.lap;
      
      // Время для ботов - примерное, на основе пройденных кругов
      let time = 0;
      if (laps >= maxLaps) {
        // Бот финишировал - вычисляем примерное время
        time = controller._finishTime || (laps * 45 + Math.random() * 10);
      } else {
        // Бот ещё едет - примерное время на основе прогресса
        const progress = laps + (controller.currentCheckpoint / this.checkpoints.length);
        time = progress * 45; // ~45 секунд на круг
      }
      
      results.push({
        position: 0, // будет вычислено после сортировки
        name: bot.name || ('Bot ' + (i + 1)),
        time: time,
        laps: laps,
        isPlayer: false
      });
    }
    
    // Добавляем результат игрока
    results.push({
      position: 0,
      name: 'Вы',
      time: playerTime > 0 ? playerTime : 0,
      laps: playerLaps,
      isPlayer: true
    });
    
    // Сортируем: сначала по кругам (убывание), потом по времени (возрастание)
    results.sort((a, b) => {
      if (b.laps !== a.laps) return b.laps - a.laps;
      if (a.time === 0) return 1;
      if (b.time === 0) return -1;
      return a.time - b.time;
    });
    
    // Присваиваем позиции
    results.forEach((r, i) => {
      r.position = i + 1;
    });
    
    return results;
  }

  /**
   * Зафиксировать время финиша для бота
   */
  recordBotFinish(botIndex) {
    if (this.bots[botIndex]) {
      this.bots[botIndex].controller._finishTime = (this.bots[botIndex].controller.lap * 45) + Math.random() * 5;
    }
  }

  clear() {
    for (const bot of this.bots) {
      this.scene.remove(bot.controller.mesh);
      if (bot.controller.wheelMeshes) {
        bot.controller.wheelMeshes.forEach(w => this.scene.remove(w));
      }
      this.world.removeBody(bot.controller.chassisBody);
      bot.controller.vehicle.removeFromWorld(this.world);
    }
    this.bots = [];
    this.raceResults = [];
  }
}