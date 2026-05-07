import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

/**
 * AI-контроллер бота: автоматически ездит по waypoints трассы.
 * БОТЫ ЕДУТ НА МАКСИМАЛЬНОЙ СКОРОСТИ К СВОИМ ТОЧКАМ ИНТЕРЕСА!
 */
export class BotController {
  constructor(chassisBody, vehicle, carMesh, wheelMeshes, checkpoints, startCheckpoint = 0, botIndex = 0) {
    this.chassisBody = chassisBody;
    this.vehicle = vehicle;
    this.mesh = carMesh;
    this.wheelMeshes = wheelMeshes;

    // Чекпоинты уже созданы в BotManager с уникальным маршрутом для каждого бота
    this.checkpoints = checkpoints;
    this.botIndex = botIndex;
    this.currentCheckpoint = startCheckpoint % this.checkpoints.length;
    this.lap = 0;
    this.speed = 0;

    // МАКСИМАЛЬНАЯ СКОРОСТЬ - боты едут на пределе!
    this.maxSpeed = CONFIG.car.maxSpeed * 1.5; // 1.5x - очень быстро!
    // Быстрый руль для агрессивного вождения
    this.steerSmoothness = 0.15;
    this.currentSteer = 0;

    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3();
    // Меньший порог - боты точнее следуют маршруту
    this.checkpointThreshold = 6;
    this._debugTimer = 0;

    // Высокая агрессия - боты едут на пределе возможностей
    this.aggression = 1.3 + (botIndex % 3) * 0.2; // 1.3 .. 1.7
  }

  /**
   * Главный update — AI принимает решения и управляет машиной.
   * БОТЫ ЕДУТ НА МАКСИМАЛЬНОЙ SКОРОСТИ!
   */
  update(dt) {
    const pos = this.chassisBody.position;
    const cfg = CONFIG.car;

    // --- 1. Цель — ТЕКУЩИЙ чекпоинт (к которому едем) ---
    const target = this.checkpoints[this.currentCheckpoint];

    // --- 2. Проверяем прохождение текущего чекпоинта ---
    // Считаем расстояние только по X и Z (игнорируем Y - боты едут по трассе)
    const distToCp = Math.sqrt((target.x - pos.x) ** 2 + (target.z - pos.z) ** 2);

    // Увеличенный порог для надёжного срабатывания
    const dynamicThreshold = 15 + (this.speed / 10);
    if (distToCp < dynamicThreshold) {
      this.currentCheckpoint++;
      if (this.currentCheckpoint >= this.checkpoints.length) {
        this.currentCheckpoint = 0;
        this.lap++;
        console.log(`🏁 Бот ${this.botIndex} завершил круг ${this.lap}!`);
      }
    }

    // --- 3. Направление к цели ---
    const toTarget = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
    const distToTarget = toTarget.length();
    toTarget.normalize();

    // --- 5. Угол поворота ---
    // ВАЖНО: для модели Subaru вперёд — это (0, 0, -1), а не (0, 0, 1)
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const angle = Math.atan2(toTarget.dot(right), toTarget.dot(forward));

    // --- 6. Руль — быстрый и агрессивный ---
    let targetSteer = 0;
    
    // Более агрессивный руль - боты быстрее реагируют
    const steerFactor = Math.min(Math.abs(angle) / 0.3, 1.0);
    targetSteer = Math.sign(angle) * cfg.maxSteer * steerFactor;

    // Быстрая интерполяция руля
    const steerDelta = targetSteer - this.currentSteer;
    this.currentSteer += steerDelta * this.steerSmoothness;

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    // --- 7. Скорость ---
    const velocity = this.chassisBody.velocity;
    this.speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) * 3.6;

    // --- 8. Газ/тормоз — ВСЕГДА ПОЛНЫЙ ГАЗ К ЦЕЛИ! ---
    // Боты едут на максималке - только минимальное снижение на очень резких поворотах
    const sharpTurn = Math.abs(angle) > 1.0;
    const verySharpTurn = Math.abs(angle) > 1.5;
    
    if (verySharpTurn) {
      // Очень резкий поворот — минимальное снижение (боты всё равно быстрые)
      const gasFactor = 0.6;
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * this.aggression, 2);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * this.aggression, 3);
      // Минимальное торможение для контроля
      this.vehicle.setBrake(cfg.brakeForce * 0.3, 2);
      this.vehicle.setBrake(cfg.brakeForce * 0.3, 3);
    } else if (sharpTurn) {
      // Резкий поворот — небольшое снижение
      const gasFactor = 0.85;
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * this.aggression, 2);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * this.aggression, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    } else {
      // ПРЯМАЯ или плавный поворот — ПОЛНЫЙ ГАЗ НА МАКСИМУМ!
      const gasFactor = 1.2; // Даже больше максимума!
      const engineForce = cfg.engineForce * gasFactor * this.aggression;
      this.vehicle.applyEngineForce(engineForce, 2);
      this.vehicle.applyEngineForce(engineForce, 3);

      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    // --- 8. Проверка на застревание ---
    const posDelta = new THREE.Vector3().subVectors(pos, this.lastPos);
    const moveDistance = posDelta.length();
    this.lastPos.copy(pos);

    if (moveDistance < 0.5 && this.speed < 5) {
      // Бот застрял — пробуем выехать
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.5) {
        // Разворот на месте
        this.vehicle.setSteeringValue(cfg.maxSteer * Math.sign(angle), 0);
        this.vehicle.setSteeringValue(cfg.maxSteer * Math.sign(angle), 1);
        this.vehicle.applyEngineForce(-cfg.reverseForce * 0.5, 2);
        this.vehicle.applyEngineForce(-cfg.reverseForce * 0.5, 3);
        
        if (this.stuckTimer > 3.0) {
          // Полная остановка и рандомный толчок
          this.vehicle.applyEngineForce(0, 2);
          this.vehicle.applyEngineForce(0, 3);
          this.chassisBody.applyImpulse(
            new CANNON.Vec3(
              (Math.random() - 0.5) * 100,
              0,
              (Math.random() - 0.5) * 100
            ),
            this.chassisBody.position
          );
          this.stuckTimer = 0;
        }
      }
    } else {
      this.stuckTimer = 0;
    }

    // --- 9. Стабилизация ---
    this.chassisBody.angularVelocity.x *= 0.95;
    this.chassisBody.angularVelocity.z *= 0.95;

    // --- 10. Переворот если вверх дном ---
    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(this.mesh.quaternion);
    if (up.y < 0.2) {
      this._flipOver();
    }

    // --- 11. Визуал ---
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

    // --- Отладка ---
    this._debugTimer += dt;
    if (this._debugTimer > 2) {
      this._debugTimer = 0;
      const target = this.checkpoints[this.currentCheckpoint];
      console.log(`🤖 Бот ${this.botIndex}: скорость=${this.speed.toFixed(1)}км/ч, цель=[${target.x.toFixed(0)},${target.z.toFixed(0)}], дист=${distToTarget.toFixed(1)}, угол=${(angle*57).toFixed(0)}°`);
    }
  }

  _unstuck() {
    const pos = this.chassisBody.position;
    // Вперёд — (0, 0, -1) для модели Subaru
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
  }

  reset(pos, rotY = 0, startCheckpoint = 0) {
    this.chassisBody.position.set(pos.x, 1.5, pos.z);
    this.chassisBody.quaternion.setFromEuler(0, rotY, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.currentCheckpoint = startCheckpoint % this.checkpoints.length;
    this.stuckTimer = 0;
    this.speed = 0;
    
    // Применяем начальный импульс чтобы бот не застревал
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    this.chassisBody.applyImpulse(
      new CANNON.Vec3(forward.x * 50, 0, forward.z * 50),
      this.chassisBody.position
    );
  }
}
