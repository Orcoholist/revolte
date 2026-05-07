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
      'Nitro-King', 'Drift-Master', 'Thunder'
    ];
  }

  /**
   * Создаёт равномерно распределённые чекпоинты по трассе.
   */
  _createCheckpoints(count) {
    if (!this.trackSegments || this.trackSegments.length === 0) {
      console.error('trackSegments пуст! Боты не будут работать.');
      console.log('trackSegments:', this.trackSegments);
      return [];
    }
    const cps = [];
    const step = Math.floor(this.trackSegments.length / count);
    for (let i = 0; i < count; i++) {
      const idx = (i * step) % this.trackSegments.length;
      const cp = this.trackSegments[idx].clone();
      cps.push(cp);
      console.log('Checkpoint ' + i + ': (' + cp.x.toFixed(0) + ', ' + cp.z.toFixed(0) + ')');
    }
    console.log('Created ' + cps.length + ' checkpoints for bots');
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
      this._createBot(i);
    }
    console.log('Created ' + count + ' bots with UNIQUE routes');
  }

  _createBot(index) {
    // Визуал: реколор модели игрока с уникальным цветом
    const botColor = this.botColors[index % this.botColors.length];
    const carMesh = createCarMesh();
    // Перекрашиваем модель бота в свой цвет
    recolorCarModel(carMesh, botColor, 0x222222);
    this.scene.add(carMesh);
    
    console.log('Bot ' + index + ': color 0x' + botColor.toString(16).padStart(6, '0'));

    const wheelMeshes = createWheelMeshes();
    wheelMeshes.forEach(w => this.scene.add(w));

    // Физика
    const { chassisBody, vehicle } = createCarPhysics(this.world, this.wheelMat);

    // Случайная стартовая позиция на трассе
    const segIdx = Math.floor(Math.random() * this.trackSegments.length);
    const seg = this.trackSegments[segIdx];
    const nextSeg = this.trackSegments[(segIdx + 1) % this.trackSegments.length];

    // Позиция между двумя сегментами + случайный отступ в сторону
    const dir = new THREE.Vector3().subVectors(nextSeg, seg).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const laneOffset = (Math.random() - 0.5) * 6; // случайная полоса

    const startPos = new THREE.Vector3()
      .addVectors(seg, nextSeg)
      .multiplyScalar(0.5)
      .add(perp.clone().multiplyScalar(laneOffset));
    startPos.y = seg.y + 1.5; // ВЫСОТА ТРАССЫ + 1.5

    // Поворот вдоль трассы
    const rotY = Math.atan2(dir.x, dir.z);

    chassisBody.position.set(startPos.x, startPos.y, startPos.z);
    chassisBody.quaternion.setFromEuler(0, rotY, 0);

    // AI контроллер с УНИКАЛЬНЫМ маршрутом
    const startCp = Math.floor(Math.random() * this.checkpoints.length);
    
    // Создаём уникальный маршрут для каждого бота
    const uniqueRoute = this._createBotRoute(index);
    
    console.log('Bot ' + index + ': spawn (' + startPos.x.toFixed(1) + ', ' + startPos.y.toFixed(1) + ', ' + startPos.z.toFixed(1) + '), target checkpoint ' + startCp);
    const bot = new BotController(
      chassisBody,
      vehicle,
      carMesh,
      wheelMeshes,
      uniqueRoute,
      startCp,
      index
    );

    this.bots.push({ controller: bot, spawnPos: startPos, spawnRot: rotY, startCp, name: this.botNames[index % this.botNames.length] });
  }

  /**
   * Создаёт УНИКАЛЬНЫЙ хаотичный маршрут для каждого бота!
   * Каждый бот получает случайные чекпоинты из общего набора
   */
  _createBotRoute(botIndex) {
    const uniqueRoute = [];
    const numPoints = this.checkpoints.length;
    
    // Генерируем случайные индексы для хаотичного маршрута
    const indices = [];
    const seed = botIndex * 7 + 13; // Разное зерно для каждого бота
    
    for (let i = 0; i < numPoints; i++) {
      // Псевдослучайный индекс с разным шагом для каждого бота
      const step = 3 + (botIndex * 2) % 7; // Шаг 3-9 между точками
      const idx = (i * step + seed) % numPoints;
      indices.push(idx);
    }
    
    // Создаём маршрут с хаотичными точками
    for (let i = 0; i < numPoints; i++) {
      const baseCp = this.checkpoints[indices[i]];
      
      // Каждый бот имеет своё предпочтение полосы
      const lanePreference = (botIndex % 3) - 1;
      const laneOffset = lanePreference * 2.0;
      
      // Случайное смещение для хаотичности
      const randomOffset = Math.sin(i * 0.7 + botIndex * 2.3) * 1.5;
      
      // Вычисляем направление трассы
      const nextIdx = indices[(i + 1) % numPoints];
      const nextCp = this.checkpoints[nextIdx];
      const dir = new THREE.Vector3().subVectors(nextCp, baseCp).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);
      
      uniqueRoute.push(new THREE.Vector3(
        baseCp.x + perp.x * (laneOffset + randomOffset),
        baseCp.y,
        baseCp.z + perp.z * (laneOffset + randomOffset)
      ));
    }
    
    console.log('Bot ' + botIndex + ': created CHAOTIC route with ' + uniqueRoute.length + ' points');
    return uniqueRoute;
  }

  update(dt) {
    for (const bot of this.bots) {
      bot.controller.update(dt);
    }
  }

  reset() {
    this.raceResults = []; // Сбрасываем результаты
    for (const bot of this.bots) {
      bot.controller.reset(bot.spawnPos, bot.spawnRot, bot.startCp);
    }
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