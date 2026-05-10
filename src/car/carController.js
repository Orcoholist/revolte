import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../engine/config.js';

/**
 * Контроллер машины: синхронизирует визуал с физикой, применяет ввод.
 */
export class CarController {
  constructor(chassisBody, vehicle, carMesh, wheelMeshes) {
    this.chassisBody = chassisBody;
    this.vehicle = vehicle;
    this.mesh = carMesh;
    this.wheelMeshes = wheelMeshes;

    this.input = { forward: false, backward: false, left: false, right: false, brake: false };
    this.speed = 0; // км/ч
    
    // Инерция поворота (для плавности)
    this.currentSteer = 0;
    this.steerSpeed = 0.015; // Очень плавный поворот для мобильных
    
    // Состояние машины
    this.inAir = false;
    this.inTunnel = false;
    this.onLoop = false;
    this.onRamp = false;
    
    // Буст
    this.boostMultiplier = 1.0;
    this.boostEndTime = 0;
    
    // Оглушение (масло)
    this.isStunned = false;
    this.stunEndTime = 0;
    
    // Для определения элементов трассы
    this.trackElementCheckInterval = 100; // проверка каждые 100мс
    this.lastTrackCheckTime = 0;
  }

  /**
   * Применяет текущий ввод к физике и синхронизирует визуал.
   */
  update() {
    const cfg = CONFIG.car;

    // --- Проверка состояния буста ---
    if (Date.now() > this.boostEndTime) {
      this.boostMultiplier = 1.0;
    }

    // --- Проверка состояния оглушения ---
    if (this.isStunned && Date.now() > this.stunEndTime) {
      this.isStunned = false;
      this.stunEndTime = 0;
    }

    // Если оглушён — игнорируем ввод, машина просто катится
    if (this.isStunned) {
      this.vehicle.applyEngineForce(0, 2);
      this.vehicle.applyEngineForce(0, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
      this.chassisBody.linearDamping = 0.05;
      this.chassisBody.angularDamping = 0.1;

      // --- Поворот (передние колёса 0, 1) с инерцией ---
      let targetSteer = 0;
      if (this.input.left) targetSteer = -cfg.maxSteer;
      if (this.input.right) targetSteer = cfg.maxSteer;
      
      // Плавный переход к целевому углу поворота
      if (this.currentSteer < targetSteer) {
        this.currentSteer = Math.min(targetSteer, this.currentSteer + this.steerSpeed);
      } else if (this.currentSteer > targetSteer) {
        this.currentSteer = Math.max(targetSteer, this.currentSteer - this.steerSpeed);
      } else {
        this.currentSteer = targetSteer;
      }

      this.vehicle.setSteeringValue(this.currentSteer, 0);
      this.vehicle.setSteeringValue(this.currentSteer, 1);

      // --- Стабилизация ---
      const currentAngVelX = Math.abs(this.chassisBody.angularVelocity.x);
      const currentAngVelZ = Math.abs(this.chassisBody.angularVelocity.z);
      const stabilizer = Math.min(25, (currentAngVelX + currentAngVelZ) * 4);
      if (this.speed > 5) {
        this.chassisBody.angularVelocity.x *= (1 - stabilizer / 100);
        this.chassisBody.angularVelocity.z *= (1 - stabilizer / 100);
      }

      // --- Синхронизация визуала ---
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
      this.speed = Math.sqrt(v.x * v.x + v.z * v.z) * 1.0;
      return;
    }

    // --- Тормоз (ПЕРВООЧЕРЕДНОЕ действие) ---
    if (this.input.brake) {
      // Полностью отключаем двигатель
      this.vehicle.applyEngineForce(0, 2);
      this.vehicle.applyEngineForce(0, 3);
      
      // ТОЛЬКО передние колёса тормозят (машина не "клюёт носом")
      this.vehicle.setBrake(cfg.brakeForce * 0.3, 0);
      this.vehicle.setBrake(cfg.brakeForce * 0.3, 1);
      
      // Задние - минимальное торможение или вообще не тормозят
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
      
      // Пассивное замедление через линейное затухание (без рывков)
      this.chassisBody.linearDamping = 0.3;
      
      // Жёсткая стабилизация при торможении
      this.chassisBody.angularDamping = 0.98;
      
      // Гасим вертикальную скорость
      if (Math.abs(this.chassisBody.velocity.y) > 0.1) {
        this.chassisBody.velocity.y *= 0.3;
      }
      
      // Подавляем вращение
      this.chassisBody.angularVelocity.x *= 0.8;
      this.chassisBody.angularVelocity.z *= 0.8;
    } else {
      // --- Сила двигателя (задний привод: колёса 2, 3) ---
      let engineForce = 0;
      if (this.input.forward) engineForce = cfg.engineForce * this.boostMultiplier;
      if (this.input.backward) engineForce = -cfg.engineForce * this.boostMultiplier;

      this.vehicle.applyEngineForce(engineForce, 2);
      this.vehicle.applyEngineForce(engineForce, 3);
      
      // Обычное затухание
      this.chassisBody.linearDamping = 0.01;
      this.chassisBody.angularDamping = 0.05;
      
      // Снимаем тормоз
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    // --- Поворот (передние колёса 0, 1) с инерцией ---
    let targetSteer = 0;
    if (this.input.left) targetSteer = -cfg.maxSteer;
    if (this.input.right) targetSteer = cfg.maxSteer;
    
    // Плавный переход к целевому углу поворота
    if (this.currentSteer < targetSteer) {
      this.currentSteer = Math.min(targetSteer, this.currentSteer + this.steerSpeed);
    } else if (this.currentSteer > targetSteer) {
      this.currentSteer = Math.max(targetSteer, this.currentSteer - this.steerSpeed);
    } else {
      this.currentSteer = targetSteer;
    }

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    // --- Стабилизация машины (постоянная) ---
    const currentAngVelX = Math.abs(this.chassisBody.angularVelocity.x);
    const currentAngVelZ = Math.abs(this.chassisBody.angularVelocity.z);
    
    const stabilizer = Math.min(25, (currentAngVelX + currentAngVelZ) * 4);
    
    if (this.speed > 5) {
      this.chassisBody.angularVelocity.x *= (1 - stabilizer / 100);
      this.chassisBody.angularVelocity.z *= (1 - stabilizer / 100);
    }

    // --- Синхронизация визуала ---
    this.mesh.position.copy(this.chassisBody.position);
    this.mesh.quaternion.copy(this.chassisBody.quaternion);

    // Обновляем колёса
    if (this.wheelMeshes && this.wheelMeshes.length > 0) {
      for (let i = 0; i < 4; i++) {
        this.vehicle.updateWheelTransform(i);
        const t = this.vehicle.wheelInfos[i].worldTransform;
        this.wheelMeshes[i].position.copy(t.position);
        this.wheelMeshes[i].quaternion.copy(t.quaternion);
      }
    }

    // --- Скорость ---
    const v = this.chassisBody.velocity;
    this.speed = Math.sqrt(v.x * v.x + v.z * v.z) * 1.0;
  }

  /**
   * Проверяет, перевернулась ли машина (вверх дном).
   */
  isFlipped() {
    // Вектор "вверх" машины в мировых координатах
    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(this.mesh.quaternion);
    // Если up.y < 0 — машина перевёрнута
    return up.y < 0.1;
  }

  /**
   * Переворачивает машину обратно на колёса.
   */
  flipOver() {
    const pos = this.chassisBody.position;
    const vel = this.chassisBody.velocity;
    const angVel = this.chassisBody.angularVelocity;

    // Поднимаем над землёй
    pos.y = Math.max(pos.y, 2);

    // Гасим скорость и вращение
    vel.set(vel.x * 0.3, 0, vel.z * 0.3);
    angVel.set(0, 0, 0);

    // Выравниваем кватернион: сохраняем только поворот вокруг Y
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    this.chassisBody.quaternion.setFromEuler(0, euler.y, 0);
  }

  /**
   * Получает боковую скорость (для определения дрифта)
   */
  getSidewaysSpeed() {
    // Направление "вперёд" машины
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    // Вектор скорости
    const velocity = new THREE.Vector3(
      this.chassisBody.velocity.x,
      0,
      this.chassisBody.velocity.z
    );
    
    // Боковая скорость = проекция скорости на перпендикуляр к направлению
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    return velocity.dot(right) * 3.6; // км/ч
  }

  /**
   * Применяет временное ускорение (предмет boost/superboost)
   * Устанавливает множитель силы на duration миллисекунд.
   * @param {number} multiplier - множитель силы двигателя (1.5, 2.5 и т.д.)
   * @param {number} duration - длительность в миллисекундах
   */
  applyBoost(multiplier, duration) {
    this.boostMultiplier = multiplier;
    this.boostEndTime = Date.now() + duration;
    console.log('Boost applied: ' + multiplier + 'x for ' + duration + 'ms');
  }

  /**
   * Оглушает машину (масляное пятно) — теряет управление на duration мс
   * @param {number} duration - длительность в миллисекундах
   */
  stun(duration) {
    this.isStunned = true;
    this.stunEndTime = Date.now() + duration;
    console.log('Car stunned for ' + duration + 'ms');
  }

  /**
   * Снимает оглушение
   */
  unstun() {
    this.isStunned = false;
    this.stunEndTime = 0;
  }

  /**
   * Телепортирует машину на старт.
   * rotY — поворот вокруг Y в радианах (по умолчанию 0 = смотрит вдоль +Z)
   */
  reset(pos, rotY = 0) {
    // При спавне позиция может иметь y=0.5, но физика требует
    // высоты над землёй для корректного размещения тела.
    const y = typeof pos.y === 'number' ? pos.y + 1.5 : 1.5;
    this.chassisBody.position.set(pos.x, y, pos.z);
    // Поворот шасси: по умолчанию "вперёд" = +Z (Cannon forwardAxis=2)
    // rotY=-PI/2 → смотрит вдоль +X
    this.chassisBody.quaternion.setFromEuler(0, rotY, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
  }
  
  /**
   * Проверяет, есть ли активный щит у машины
   */
  hasActiveShield() {
    // Shield lasts for 5 seconds
    if (this.shieldTime && (Date.now() - this.shieldTime < 5000)) {
      return true;
    }
    return false;
  }
}