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
    this.steerSpeed = 0.015;
    
    // Состояние машины
    this.inAir = false;
    this.inTunnel = false;
    this.onLoop = false;
    this.onRamp = false;
    
    // Буст (используем аккумулятор времени)
    this.boostMultiplier = 1.0;
    this.boostDuration = 0; // сколько осталось буста в секундах
    
    // Оглушение (масло)
    this.isStunned = false;
    this.stunDuration = 0; // сколько осталось оглушения в секундах
    
    // Масляное пятно — проблемы с поворотом
    this.onOil = false;
    this.oilDuration = 0;
    this.oilSteerInverted = false; // инвертирован ли поворот
    
    // Для определения элементов трассы
    this.trackElementCheckInterval = 100;
    this.lastTrackCheckTime = 0;
  }

  /**
   * Применяет текущий ввод к физике и синхронизирует визуал.
   */
  update(dt) {
    const cfg = CONFIG.car;

    // --- Проверка состояния буста ---
    if (this.boostDuration > 0) {
      this.boostDuration -= dt;
      if (this.boostDuration <= 0) {
        this.boostMultiplier = 1.0;
        this.boostDuration = 0;
      }
    }

    // --- Проверка состояния масляного пятна ---
    if (this.onOil) {
      this.oilDuration -= dt;
      if (this.oilDuration <= 0) {
        this.onOil = false;
        this.oilDuration = 0;
      }
    }

    // --- Проверка состояния оглушения ---
    if (this.isStunned) {
      this.stunDuration -= dt;
      if (this.stunDuration <= 0) {
        this.isStunned = false;
        this.stunDuration = 0;
      }
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

      let targetSteer = 0;
      if (this.input.left) targetSteer = -cfg.maxSteer;
      if (this.input.right) targetSteer = cfg.maxSteer;
      
      if (this.currentSteer < targetSteer) {
        this.currentSteer = Math.min(targetSteer, this.currentSteer + this.steerSpeed);
      } else if (this.currentSteer > targetSteer) {
        this.currentSteer = Math.max(targetSteer, this.currentSteer - this.steerSpeed);
      } else {
        this.currentSteer = targetSteer;
      }

      this.vehicle.setSteeringValue(this.currentSteer, 0);
      this.vehicle.setSteeringValue(this.currentSteer, 1);

      const currentAngVelX = Math.abs(this.chassisBody.angularVelocity.x);
      const currentAngVelZ = Math.abs(this.chassisBody.angularVelocity.z);
      const stabilizer = Math.min(25, (currentAngVelX + currentAngVelZ) * 4);
      if (this.speed > 5) {
        this.chassisBody.angularVelocity.x *= (1 - stabilizer / 100);
        this.chassisBody.angularVelocity.z *= (1 - stabilizer / 100);
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
      const v = this.chassisBody.velocity;
      this.speed = Math.sqrt(v.x * v.x + v.z * v.z) * 1.0;
      return;
    }

    // --- Тормоз ---
    if (this.input.brake) {
      this.vehicle.applyEngineForce(0, 2);
      this.vehicle.applyEngineForce(0, 3);
      
      this.vehicle.setBrake(cfg.brakeForce * 0.3, 0);
      this.vehicle.setBrake(cfg.brakeForce * 0.3, 1);
      
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
      
      this.chassisBody.linearDamping = 0.3;
      this.chassisBody.angularDamping = 0.98;
      
      if (Math.abs(this.chassisBody.velocity.y) > 0.1) {
        this.chassisBody.velocity.y *= 0.3;
      }
      
      this.chassisBody.angularVelocity.x *= 0.8;
      this.chassisBody.angularVelocity.z *= 0.8;
    } else {
      let engineForce = 0;
      if (this.input.forward) engineForce = cfg.engineForce * this.boostMultiplier;
      if (this.input.backward) engineForce = -cfg.engineForce * this.boostMultiplier;

      this.vehicle.applyEngineForce(engineForce, 2);
      this.vehicle.applyEngineForce(engineForce, 3);
      
      this.chassisBody.linearDamping = 0.01;
      this.chassisBody.angularDamping = 0.05;
      
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    // Если машина на масле — инвертируем поворот
    let targetSteer = 0;
    if (this.onOil) {
      // Инвертируем: нажал влево — едет вправо и наоборот
      if (this.input.left) targetSteer = cfg.maxSteer;
      if (this.input.right) targetSteer = -cfg.maxSteer;
    } else {
      if (this.input.left) targetSteer = -cfg.maxSteer;
      if (this.input.right) targetSteer = cfg.maxSteer;
    }
    
    if (this.currentSteer < targetSteer) {
      this.currentSteer = Math.min(targetSteer, this.currentSteer + this.steerSpeed);
    } else if (this.currentSteer > targetSteer) {
      this.currentSteer = Math.max(targetSteer, this.currentSteer - this.steerSpeed);
    } else {
      this.currentSteer = targetSteer;
    }

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    const currentAngVelX = Math.abs(this.chassisBody.angularVelocity.x);
    const currentAngVelZ = Math.abs(this.chassisBody.angularVelocity.z);
    const stabilizer = Math.min(25, (currentAngVelX + currentAngVelZ) * 4);
    
    if (this.speed > 5) {
      this.chassisBody.angularVelocity.x *= (1 - stabilizer / 100);
      this.chassisBody.angularVelocity.z *= (1 - stabilizer / 100);
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

    const v = this.chassisBody.velocity;
    this.speed = Math.sqrt(v.x * v.x + v.z * v.z) * 1.0;
  }

  isFlipped() {
    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(this.mesh.quaternion);
    return up.y < 0.1;
  }

  flipOver() {
    const pos = this.chassisBody.position;
    const vel = this.chassisBody.velocity;
    const angVel = this.chassisBody.angularVelocity;

    pos.y = Math.max(pos.y, 2);
    vel.set(vel.x * 0.3, 0, vel.z * 0.3);
    angVel.set(0, 0, 0);

    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    this.chassisBody.quaternion.setFromEuler(0, euler.y, 0);
  }

  getSidewaysSpeed() {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    const velocity = new THREE.Vector3(
      this.chassisBody.velocity.x,
      0,
      this.chassisBody.velocity.z
    );
    
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    return velocity.dot(right) * 3.6;
  }

  /**
   * Применяет временное ускорение (предмет boost/superboost)
   * @param {number} multiplier - множитель силы двигателя
   * @param {number} duration - длительность в миллисекундах
   */
  applyBoost(multiplier, duration) {
    this.boostMultiplier = multiplier;
    this.boostDuration = duration / 1000; // конвертируем мс в секунды
  }

  /**
   * Оглушает машину (масляное пятно)
   * @param {number} duration - длительность в миллисекундах
   */
  stun(duration) {
    this.isStunned = true;
    this.stunDuration = duration / 1000; // конвертируем мс в секунды
  }

  /**
   * Масляное пятно — на 3 секунды инвертирует поворот + случайный дрифт
   * Не сбрасывает таймер при повторном наезде на то же пятно
   * @param {number} duration - длительность в миллисекундах
   */
  oilSlick(duration) {
    // Если уже на масле — не сбрасываем таймер (иначе каждые 2 кадра таймер обнуляется)
    if (this.onOil) return;
    this.onOil = true;
    this.oilDuration = duration / 1000; // конвертируем мс в секунды
    // Случайный боковой импульс для эффекта заноса
    const sideForce = (Math.random() - 0.5) * 15;
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.chassisBody.velocity.x += right.x * sideForce;
    this.chassisBody.velocity.z += right.z * sideForce;
  }

  unstun() {
    this.isStunned = false;
    this.stunDuration = 0;
  }

  reset(pos, rotY = 0) {
    const y = typeof pos.y === 'number' ? pos.y + 1.5 : 1.5;
    this.chassisBody.position.set(pos.x, y, pos.z);
    this.chassisBody.quaternion.setFromEuler(0, rotY, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
  }
  
  hasActiveShield() {
    return this.shieldTime && (Date.now() - this.shieldTime < 5000);
  }
}