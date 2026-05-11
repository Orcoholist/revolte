import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

/**
 * AI-контроллер бота: автоматически ездит по waypoints трассы.
 */
export class BotController {
  constructor(chassisBody, vehicle, carMesh, wheelMeshes, checkpoints, startCheckpoint = 0, botIndex = 0) {
    this.chassisBody = chassisBody;
    this.vehicle = vehicle;
    this.mesh = carMesh;
    this.wheelMeshes = wheelMeshes;

    this.checkpoints = checkpoints;
    this.botIndex = botIndex;
    this.currentCheckpoint = startCheckpoint % this.checkpoints.length;
    this.lap = 0;
    this.speed = 0;

    this.maxSpeed = CONFIG.car.maxSpeed * 1.5;
    this.steerSmoothness = 0.15;
    this.currentSteer = 0;

    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    this.checkpointThreshold = 6;
    this._debugTimer = 0;

    this.aggression = 1.3 + (botIndex % 3) * 0.2;

    // Состояние оглушения (через dt, без Date.now)
    this.isStunned = false;
    this.stunDuration = 0;

    // Состояние буста (через dt, без setTimeout)
    this._boostMultiplier = 1.0;
    this._boostDuration = 0;

    // Использование предметов
    this.itemUsageTimer = 0;
    // Кэшируем ссылку на botObj (чтобы не делать find() каждый кадр)
    this._botObj = null;

    // Новые параметры для ИИ
    this.avoidanceDistance = 8; // дистанция обнаружения препятствий
    this.avoidanceAngle = Math.PI / 3; // угол обзора для обнаружения
    this.isAvoiding = false;
    this.avoidanceTimer = 0;
    this.lastAvoidanceDir = 0;
    this.stuckCheckDistance = 2; // минимальное расстояние для проверки застревания
    this.stuckCheckTime = 0.5; // время для проверки застревания
    this.lastCheckpointTime = 0;
    this.checkpointTimeout = 3; // время ожидания чекпоинта

    // Параметры для заднего хода при застревании
    this.reverseTimer = 0;
    this.reverseDuration = 0.8; // сколько секунд ехать назад
    this.reverseSteer = 0; // направление поворота при движении назад
    this.isReversing = false;
  }

  /**
   * Получить объект бота из BotManager (с кэшированием)
   */
  _getBotObj() {
    if (this._botObj) return this._botObj;
    if (!window.botManager || !window.botManager.bots) return null;
    this._botObj = window.botManager.bots.find(b => b.controller === this);
    return this._botObj;
  }

  /**
   * Проверка наличия препятствий впереди (включая других ботов)
   */
  _checkObstaclesAhead() {
    const pos = this.chassisBody.position;
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    forward.y = 0;
    forward.normalize();

    const obstacles = [];

    // Статические препятствия
    if (window.obstacles) {
      for (const obstacle of window.obstacles) {
        const toObstacle = new THREE.Vector3().subVectors(obstacle.position, pos);
        const distance = toObstacle.length();
        if (distance > this.avoidanceDistance) continue;
        const angle = Math.abs(Math.atan2(toObstacle.x, toObstacle.z) - Math.atan2(forward.x, forward.z));
        if (angle > this.avoidanceAngle) continue;
        obstacles.push({
          obstacle: obstacle,
          distance: distance,
          angle: angle,
          position: obstacle.position.clone()
        });
      }
    }

    // Другие боты
    if (window.botManager && window.botManager.bots) {
      for (const otherBot of window.botManager.bots) {
        if (otherBot.controller === this) continue;
        const otherPos = otherBot.controller.chassisBody.position;
        const toOther = new THREE.Vector3().subVectors(otherPos, pos);
        const distance = toOther.length();
        if (distance > this.avoidanceDistance) continue;
        const angle = Math.abs(Math.atan2(toOther.x, toOther.z) - Math.atan2(forward.x, forward.z));
        if (angle > this.avoidanceAngle) continue;
        obstacles.push({
          obstacle: { position: otherPos },
          distance: distance,
          angle: angle,
          position: otherPos.clone()
        });
      }
    }

    // Сортируем по расстоянию
    obstacles.sort((a, b) => a.distance - b.distance);
    return obstacles.length > 0 ? obstacles[0] : null;
  }

  /**
   * Вычисление направления для объезда препятствия
   */
  _calculateAvoidanceDirection(obstacleInfo) {
    const pos = this.chassisBody.position;
    const toObstacle = new THREE.Vector3().subVectors(obstacleInfo.position, pos);
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    forward.y = 0;
    forward.normalize();

    // Определяем сторону для объезда
    const cross = new THREE.Vector3().crossVectors(forward, toObstacle);
    const side = cross.y > 0 ? 1 : -1;

    // Вычисляем целевое направление
    const avoidanceDir = new THREE.Vector3();
    
    // Базовое направление - вперед
    avoidanceDir.copy(forward);
    
    // Добавляем компоненту для объезда
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    avoidanceDir.add(right.multiplyScalar(side * 0.5));
    
    // Добавляем немного случайности для более естественного движения
    avoidanceDir.x += (Math.random() - 0.5) * 0.2;
    avoidanceDir.z += (Math.random() - 0.5) * 0.2;
    
    avoidanceDir.normalize();
    return { direction: avoidanceDir, side: side };
  }

  /**
   * Проверка застревания
   */
  _checkStuck(dt) {
    const pos = this.chassisBody.position;
    const posDelta = new THREE.Vector3().subVectors(pos, this.lastPos);
    const moveDistance = posDelta.length();
    this.lastPos.copy(pos);

    // Проверяем, двигается ли машина
    if (moveDistance < this.stuckCheckDistance && this.speed < 10) {
      this.stuckTimer += dt;
      return this.stuckTimer > this.stuckCheckTime;
    } else {
      this.stuckTimer = 0;
      return false;
    }
  }

  /**
   * Действия при застревании – отъезд назад с поворотом
   */
  _handleStuck() {
    if (!this.isReversing) {
      // Начинаем отъезд назад
      this.isReversing = true;
      this.reverseTimer = 0;
      // Выбираем случайное направление поворота
      this.reverseSteer = (Math.random() > 0.5 ? 1 : -1) * CONFIG.car.maxSteer * 0.8;
    }

    this.reverseTimer += 0.016; // приблизительно dt (вызывается из update)

    // Применяем задний ход
    this.vehicle.applyEngineForce(-CONFIG.car.reverseForce * 0.8, 2);
    this.vehicle.applyEngineForce(-CONFIG.car.reverseForce * 0.8, 3);
    this.vehicle.setBrake(0, 0);
    this.vehicle.setBrake(0, 1);
    this.vehicle.setBrake(0, 2);
    this.vehicle.setBrake(0, 3);

    // Поворачиваем в выбранную сторону
    this.currentSteer = this.reverseSteer;
    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    // Если отъехали достаточно долго, выходим из режима реверса
    if (this.reverseTimer > this.reverseDuration) {
      this.isReversing = false;
      this.stuckTimer = 0;
      this.reverseTimer = 0;
    }
  }

  update(dt) {
    const pos = this.chassisBody.position;
    const cfg = CONFIG.car;

    if (!this.checkpoints || this.checkpoints.length === 0) {
      return;
    }

    // Обновляем состояния через dt (без Date.now)
    if (this.isStunned) {
      this.stunDuration -= dt;
      if (this.stunDuration <= 0) {
        this.isStunned = false;
        this.stunDuration = 0;
      }
    }

    if (this._boostDuration > 0) {
      this._boostDuration -= dt;
      if (this._boostDuration <= 0) {
        this._boostMultiplier = 1.0;
        this._boostDuration = 0;
      }
    }

    if (this.isStunned) {
      this.vehicle.applyEngineForce(0, 2);
      this.vehicle.applyEngineForce(0, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
      
      this.mesh.position.copy(this.chassisBody.position);
      this.mesh.quaternion.copy(this.chassisBody.quaternion);
      if (this.wheelMeshes && this.wheelMeshes.length > 0) {
        for (let i = 0; i < 4; i++) {
          this.vehicle.updateWheelTransform(i);
          const t = this.vehicle.wheelInfos[i].worldTransform;
          this.wheelMeshes[i].position.copy(t.position);
          this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }
      }
      const v = this.chassisBody.velocity;
      this.speed = Math.sqrt(v.x * v.x + v.z * v.z) * 3.6;
      return;
    }

    // Если бот в режиме отъезда назад, продолжаем его
    if (this.isReversing) {
      this._handleStuck();
      this.mesh.position.copy(this.chassisBody.position);
      this.mesh.quaternion.copy(this.chassisBody.quaternion);
      if (this.wheelMeshes && this.wheelMeshes.length > 0) {
        for (let i = 0; i < 4; i++) {
          this.vehicle.updateWheelTransform(i);
          const t = this.vehicle.wheelInfos[i].worldTransform;
          this.wheelMeshes[i].position.copy(t.position);
          this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }
      }
      const v = this.chassisBody.velocity;
      this.speed = Math.sqrt(v.x * v.x + v.z * v.z) * 3.6;
      return;
    }

    // Проверка на застревание
    if (this._checkStuck(dt)) {
      this._handleStuck();
      return; // выходим, чтобы не перезаписывать управление
    }

    // Проверка препятствий впереди
    const obstacleInfo = this._checkObstaclesAhead();
    let targetSteer = 0;
    let gasFactor = 1.2;

    if (obstacleInfo) {
      // Обнаружено препятствие - начинаем объезд
      this.isAvoiding = true;
      this.avoidanceTimer = 0;
      
      const avoidance = this._calculateAvoidanceDirection(obstacleInfo);
      const toTarget = avoidance.direction;
      
      // Вычисляем угол для поворота
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.mesh.quaternion);
      forward.y = 0;
      forward.normalize();
      
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const angle = Math.atan2(toTarget.dot(right), toTarget.dot(forward));
      
      targetSteer = Math.sign(angle) * cfg.maxSteer * Math.min(Math.abs(angle) / 0.3, 1.0);
      this.lastAvoidanceDir = avoidance.side;
      
      // Если препятствие очень близко и скорость мала – включаем задний ход
      if (obstacleInfo.distance < this.avoidanceDistance * 0.5 && this.speed < 5) {
        this._handleStuck();
        return;
      }
      
      // Замедляемся при объезде препятствия
      gasFactor = 0.7;
      
      // Сбрасываем таймер застревания при успешном объезде
      this.stuckTimer = 0;
    } else {
      // Препятствий нет - возвращаемся к нормальной навигации
      this.isAvoiding = false;
      this.avoidanceTimer += dt;
      
      // Если успешно объехали препятствие, возвращаемся к чекпоинтам
      if (this.avoidanceTimer > 0.5) {
        this.avoidanceTimer = 0;
      }
      
      const target = this.checkpoints[this.currentCheckpoint];
      const distToCp = Math.sqrt((target.x - pos.x) ** 2 + (target.z - pos.z) ** 2);
      const checkpointThreshold = 20;
      
      // Проверяем, не застряли ли мы на чекпоинте
      if (distToCp < checkpointThreshold) {
        if (this.lastCheckpointTime === 0) {
          this.lastCheckpointTime = Date.now();
        } else if (Date.now() - this.lastCheckpointTime > this.checkpointTimeout * 1000) {
          // Чекпоинт не достигнут за отведенное время - пробуем другой
          this.currentCheckpoint = (this.currentCheckpoint + 1) % this.checkpoints.length;
          this.lastCheckpointTime = Date.now();
        }
      } else {
        this.lastCheckpointTime = 0;
      }
      
      if (distToCp < checkpointThreshold) {
        this.currentCheckpoint++;
        if (this.currentCheckpoint >= this.checkpoints.length) {
          this.currentCheckpoint = 0;
          this.lap++;
        }
      }

      const toTarget = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
      toTarget.normalize();

      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.mesh.quaternion);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const angle = Math.atan2(toTarget.dot(right), toTarget.dot(forward));

      targetSteer = Math.sign(angle) * cfg.maxSteer * Math.min(Math.abs(angle) / 0.3, 1.0);
    }

    // Плавное изменение рулевого управления
    const steerDelta = targetSteer - this.currentSteer;
    this.currentSteer += steerDelta * this.steerSmoothness;

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    const velocity = this.chassisBody.velocity;
    this.speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) * 3.6;

    // Применяем множитель буста к силе двигателя
    const effectiveAggression = this.aggression * this._boostMultiplier;

    const sharpTurn = Math.abs(this.currentSteer) > cfg.maxSteer * 0.7;
    const verySharpTurn = Math.abs(this.currentSteer) > cfg.maxSteer * 0.9;
    
    if (verySharpTurn) {
      gasFactor = Math.min(gasFactor, 0.6);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 2);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    } else if (sharpTurn) {
      gasFactor = Math.min(gasFactor, 0.8);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 2);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    } else {
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 2);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    this.chassisBody.angularVelocity.x *= 0.95;
    this.chassisBody.angularVelocity.z *= 0.95;

    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(this.mesh.quaternion);
    if (up.y < 0.2) {
      this._flipOver();
    }

    this.mesh.position.copy(this.chassisBody.position);
    this.mesh.quaternion.copy(this.chassisBody.quaternion);

    if (this.wheelMeshes && this.wheelMeshes.length > 0) {
      for (let i = 0; i < 4; i++) {
        this.vehicle.updateWheelTransform(i);
        const t = this.vehicle.wheelInfos[i].worldTransform;
        this.wheelMeshes[i].position.copy(t.position);
        this.wheelMeshes[i].quaternion.copy(t.quaternion);
      }
    }

    this._debugTimer += dt;
    if (this._debugTimer > 2) {
      this._debugTimer = 0;
    }
    
    this._handleItemUsage(dt);
  }

  _handleItemUsage(dt) {
    this.itemUsageTimer += dt;
    
    if (this.itemUsageTimer > (8 + Math.random() * 7)) {
      this._useItemStrategically();
      this.itemUsageTimer = 0;
    }
  }

  _useItemStrategically() {
    if (!window.itemSystem || !window.botManager || !window.botManager.bots) return;

    // Используем кэшированную ссылку на botObj
    const botObj = this._getBotObj();
    if (!botObj || !botObj.items || botObj.items.length === 0) return;

    const now = Date.now();
    const readyItem = botObj.items.find(item => {
      if (!item.ready && now - item.time >= 2000) {
        item.ready = true;
      }
      return item.ready;
    });

    if (!readyItem) return;

    const idx = botObj.items.indexOf(readyItem);
    if (idx !== -1) {
      botObj.items.splice(idx, 1);
    }

    window.itemSystem.applyItemEffectToBot(readyItem.type, this);
  }

  _unstuck() {
    const pos = this.chassisBody.position;
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    pos.x += forward.x * 2;
    pos.z += forward.z * 2;
    pos.y = Math.max(pos.y, 1.5);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
  }

  _flipOver() {
    const pos = this.chassisBody.position;
    const vel = this.chassisBody.velocity;
    const angVel = this.chassisBody.angularVelocity;
    pos.y = Math.max(pos.y, 2);
    vel.set(vel.x * 0.3, 0, vel.z * 0.3);
    angVel.set(0, 0, 0);
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    this.chassisBody.quaternion.setFromEuler(0, euler.y, 0);
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    this.chassisBody.applyImpulse(
      new CANNON.Vec3(forward.x * 100, 0, forward.z * 100),
      this.chassisBody.position
    );
  }

  flipOver() {
    this._flipOver();
  }

  reset(pos, rotY = 0, startCheckpoint = 0) {
    this.chassisBody.position.set(pos.x, 1.5, pos.z);
    this.chassisBody.quaternion.setFromEuler(0, rotY, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.currentCheckpoint = startCheckpoint % this.checkpoints.length;
    this.stuckTimer = 0;
    this.speed = 0;
    this._boostMultiplier = 1.0;
    this._boostDuration = 0;
    this._botObj = null; // сброс кэша
    this.isAvoiding = false;
    this.avoidanceTimer = 0;
    this.lastCheckpointTime = 0;
    this.isReversing = false;
    this.reverseTimer = 0;
    
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    this.chassisBody.applyImpulse(
      new CANNON.Vec3(forward.x * 50, 0, forward.z * 50),
      this.chassisBody.position
    );
  }
  
  hasActiveShield() {
    return this.shieldTime && (Date.now() - this.shieldTime < 5000);
  }
  
  stun(duration) {
    this.isStunned = true;
    this.stunDuration = duration / 1000; // конвертируем мс в секунды
  }

  applyBoost(multiplier, duration) {
    // Вместо setTimeout используем аккумулятор времени
    this._boostMultiplier = multiplier;
    this._boostDuration = duration / 1000; // конвертируем мс в секунды
  }
}
