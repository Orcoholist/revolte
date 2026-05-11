import * as THREE from 'three';
import { CONFIG } from '../engine/config.js';

/**
 * Система отслеживания кругов на трассе.
 * Использует контрольные точки для определения прохождения круга.
 */
export class LapCounter {
  constructor(trackSegments, spawnPos, onLapComplete, scene = null, spawnRot = null) {
    this.segments = trackSegments;
    this.spawnPos = spawnPos;
    this.spawnRot = spawnRot || { y: 0 };
    this.onLapComplete = onLapComplete;
    this.scene = scene;
    
    // Состояние
    this.checkpointCount = 5;
    this.checkpoints = this._createCheckpoints();
    
    // Начинаем с 0 (первый чекпоинт — старт/финиш, зелёный)
    this.currentCheckpoint = 0;
    this.lastPosition = null;
    this.finishedLaps = 0;
    // Флаг, указывающий, что мы прошли все промежуточные чекпоинты и ждём прохождения стартового (зелёного) чекпоинта для завершения круга
    this.waitingForFinish = false;
    
    // Зона старта/финиша
    this.startFinishZone = new THREE.Box3();
    this._createStartFinishZone();
    
    // Стрелки-индикаторы
    this.arrowHelpers = [];
    this._createArrowIndicators();
  }
  
  /**
   * Создаёт зону старта/финиша
   */
  _createStartFinishZone() {
    const width = 16;  // Ширина зоны (увеличено с 10)
    const depth = 8;   // Глубина зоны (увеличено с 4)
    
    // Центр зоны — спавн машины
    const center = this.spawnPos.clone();
    
    this.startFinishZone.min.set(
      center.x - width / 2,
      -10,
      center.z - depth / 2
    );
    this.startFinishZone.max.set(
      center.x + width / 2,
      10,
      center.z + depth / 2
    );
  }
  _createCheckpoints() {
    const checkpoints = [];
    // Calculate maxRadius based on the world size to keep checkpoints within bounds
    const maxRadius = Math.min(80, CONFIG.world.size / 2.5); // Using 40% of half world size
    
    for (let i = 0; i < this.checkpointCount; i++) {
      // Случайная позиция в пределах круга радиусом maxRadius
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * (maxRadius - 30);
      const pos = new THREE.Vector3(
        Math.cos(angle) * dist,
        0,
        Math.sin(angle) * dist
      );
      
      // Проверка что не слишком близко к другим чекпоинтам
      let tooClose = false;
      for (const cp of checkpoints) {
        if (pos.distanceTo(cp) < 30) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        checkpoints.push(pos);
      } else {
        // Повторяем попытку
        i--;
      }
    }
    
    return checkpoints;
  }
  
  /**
   * Создаёт стрелки-индикаторы к контрольным точкам
   */
  _createArrowIndicators() {
    if (!this.scene) return;
    
    const arrowColor = 0xffff00;
    const arrowLength = 10;
    const arrowHeadSize = 2;
    
    for (let i = 0; i < this.checkpoints.length; i++) {
      // Стрелка для каждой контрольной точки
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0), // Направление (обновляется позже)
        this.checkpoints[i],        // Позиция (центр контрольной точки)
        arrowLength,
        arrowColor,
        arrowHeadSize,
        arrowHeadSize * 0.5
      );
      
      arrow.visible = false; // Скрыты по умолчанию
      this.scene.add(arrow);
      this.arrowHelpers.push(arrow);
      
      // Добавляем БОЛЬШОЕ кольцо вокруг контрольной точки (увеличено с 2.5-3 до 8-10)
      const ringGeo = new THREE.RingGeometry(8, 10, 32);
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: i === 0 ? 0x00ff00 : 0xff0000, // Старт — зелёный, остальные — красные
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(this.checkpoints[i]);
      ring.position.y = 0.3;
      this.scene.add(ring);
      this.arrowHelpers.push(ring); // Сохраняем для управления видимостью
      
      // Добавляем вертикальный столбик для лучшей видимости
      const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 3, 16);
      const pillarMat = new THREE.MeshBasicMaterial({ 
        color: i === 0 ? 0x00ff00 : 0xff6600,
        transparent: true,
        opacity: 0.6
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.copy(this.checkpoints[i]);
      pillar.position.y = 1.5;
      this.scene.add(pillar);
      this.arrowHelpers.push(pillar);
      pillar.userData.checkpointIndex = i;
      pillar.userData.isPillar = true;
      
      // Сохраняем индекс контрольной точки в объекте
      ring.userData.checkpointIndex = i;
      ring.userData.isRing = true;
    }
  }
  
  /**
   * Проверяет, находится ли точка в зоне
   */
  _isInZone(position, zone) {
    return position.x >= zone.min.x && position.x <= zone.max.x &&
           position.y >= zone.min.y && position.y <= zone.max.y &&
           position.z >= zone.min.z && position.z <= zone.max.z;
  }
  
  /**
   * Вычисляет расстояние до контрольной точки
   */
  _distanceToCheckpoint(position, checkpointIndex) {
    const checkpoint = this.checkpoints[checkpointIndex];
    return position.distanceTo(checkpoint);
  }
  
  /**
   * Проверяет, прошла ли машина контрольную точку
   */
  _hasPassedCheckpoint(position) {
    const threshold = 25;
    const checkpoint = this.checkpoints[this.currentCheckpoint];
    return position.distanceTo(checkpoint) < threshold;
  }
  
  /**
   * Обновляет систему — вызывается каждый кадр
   */
  update(carPosition) {
    if (!this.lastPosition) {
      this.lastPosition = carPosition.clone();
      this._updateArrowIndicators(carPosition);
      return false;
    }
    
    // Проверяем прохождение контрольной точки (если ещё не завершили круг)
    if (this.currentCheckpoint >= 0 && this.currentCheckpoint < this.checkpointCount) {
      if (this._hasPassedCheckpoint(carPosition)) {
        // Переходим к следующей точке
        this.currentCheckpoint++;
      }
    }
    
    // Проверка финиша: если пройдены все промежуточные чекпоинты, ждём прохождения стартового (зелёного) чекпоинта
    if (this.currentCheckpoint >= this.checkpointCount) {
      // Стартовый чекпоинт находится в this.checkpoints[0]
      const startCheckpoint = this.checkpoints[0];
      const distanceToStart = carPosition.distanceTo(startCheckpoint);
      const finishThreshold = 25; // тот же порог, что и для обычных чекпоинтов
      if (distanceToStart < finishThreshold) {
        this.finishedLaps++;
        const lapNum = this.finishedLaps;
        if (this.onLapComplete) {
          this.onLapComplete(lapNum);
        }
        // Сброс для следующего круга
        this.currentCheckpoint = 0;
        this.lastPosition = null;
      }
    }
    
    this.lastPosition = carPosition.clone();
    this._updateArrowIndicators(carPosition);
    
    return false;
  }
  
  /**
   * Обновляет стрелки-индикаторы
   */
  _updateArrowIndicators(carPosition) {
    if (!this.scene || this.arrowHelpers.length === 0) return;
    
    // Определяем целевую точку (если прошли все, показываем финиш)
    let targetCheckpointIndex;
    if (this.currentCheckpoint >= this.checkpointCount) {
      // Все точки пройдены, показываем старт как финиш
      targetCheckpointIndex = 0;
    } else {
      targetCheckpointIndex = this.currentCheckpoint;
    }
    
    const targetCheckpoint = this.checkpoints[targetCheckpointIndex];
    
    // Направление от машины к целевой контрольной точке
    const direction = targetCheckpoint.clone().sub(carPosition).normalize();
    const distance = carPosition.distanceTo(targetCheckpoint);
    
    // Обновляем стрелку
    if (this.arrowHelpers[0]) {
      this.arrowHelpers[0].setDirection(direction);
      this.arrowHelpers[0].position.copy(carPosition);
      this.arrowHelpers[0].position.y = 2;
      this.arrowHelpers[0].visible = true;
      
      // Цвет стрелки
      if (distance < 15) {
        this.arrowHelpers[0].setColor(0x00ff00);
      } else if (distance < 40) {
        this.arrowHelpers[0].setColor(0xffff00);
      } else {
        this.arrowHelpers[0].setColor(0xff6600);
      }
    }
    
    // Показываем ТОЛЬКО целевую контрольную точку
    for (let i = 0; i < this.checkpoints.length; i++) {
      const ring = this.arrowHelpers.find(obj => 
        obj.userData && obj.userData.isRing && obj.userData.checkpointIndex === i
      );
      
      const pillar = this.arrowHelpers.find(obj => 
        obj.userData && obj.userData.isPillar && obj.userData.checkpointIndex === i
      );
      
      if (ring) {
        const isTarget = i === targetCheckpointIndex;
        ring.visible = isTarget;
        
        if (isTarget) {
          const scale = 1 + Math.sin(Date.now() * 0.005) * 0.2;
          ring.scale.set(scale, scale, 1);
          ring.material.opacity = 1.0;
        } else {
          ring.scale.set(1, 1, 1);
          ring.material.opacity = 0.3;
        }
      }
      
      if (pillar) {
        const isTarget = i === targetCheckpointIndex;
        pillar.visible = isTarget;
        pillar.material.opacity = isTarget ? 1.0 : 0.1;
      }
    }
  }
  
  /**
   * Сбрасывает счётчик кругов
   */
  reset() {
    this.currentCheckpoint = 0;
    this.finishedLaps = 0;
    this.waitingForFinish = false;
    this.lastPosition = null;
    
    // Скрываем стрелки
    if (this.arrowHelpers.length > 0) {
      this.arrowHelpers.forEach(obj => {
        if (obj.visible !== undefined) {
          obj.visible = false;
        }
      });
    }
    
    // Обнуляем счётчик кругов в глобальном состоянии
    if (window.state) {
      window.state.lap = 1;
    }
  }
  
  /**
   * Получает текущий круг (начинается с 1)
   */
  getCurrentLap() {
    return this.finishedLaps + 1;
  }
  
  /**
   * Получает позицию следующей контрольной точки
   */
  getNextCheckpoint() {
    if (this.currentCheckpoint >= this.checkpointCount) {
      return this.checkpoints[0].clone();
    }
    return this.checkpoints[this.currentCheckpoint].clone();
  }
  
  /**
   * Отрисовка отладочной информации (опционально)
   */
  drawDebug(ctx, carPosition) {
    // Рисуем контрольные точки на миникарте
    const scale = 0.85;
    const cx = ctx.canvas.width / 2;
    const cy = ctx.canvas.height / 2;
    
    // Контрольные точки
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      const x = cx + cp.x * scale * 0.6 - 50 * scale * 0.6;
      const y = cy + cp.z * scale * 0.6;
      
      ctx.fillStyle = i === this.currentCheckpoint ? '#00ff00' : '#ff0000';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Зона старта/финиша
    const sfCenter = this.spawnPos;
    const sfX = cx + sfCenter.x * scale * 0.6 - 50 * scale * 0.6;
    const sfY = cy + sfCenter.z * scale * 0.6;
    
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      sfX - 5,
      sfY - 2,
      10,
      4
    );
  }
}
