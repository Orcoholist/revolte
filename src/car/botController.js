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

    const target = this.checkpoints[this.currentCheckpoint];

    const distToCp = Math.sqrt((target.x - pos.x) ** 2 + (target.z - pos.z) ** 2);
    const checkpointThreshold = 20;
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

    let targetSteer = 0;
    const steerFactor = Math.min(Math.abs(angle) / 0.3, 1.0);
    targetSteer = Math.sign(angle) * cfg.maxSteer * steerFactor;

    const steerDelta = targetSteer - this.currentSteer;
    this.currentSteer += steerDelta * this.steerSmoothness;

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    const velocity = this.chassisBody.velocity;
    this.speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z) * 3.6;

    // Применяем множитель буста к силе двигателя
    const effectiveAggression = this.aggression * this._boostMultiplier;

    const sharpTurn = Math.abs(angle) > 1.0;
    const verySharpTurn = Math.abs(angle) > 1.5;
    
    if (verySharpTurn) {
      const gasFactor = 0.8;
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 2);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    } else if (sharpTurn) {
      const gasFactor = 0.9;
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 2);
      this.vehicle.applyEngineForce(cfg.engineForce * gasFactor * effectiveAggression, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    } else {
      const gasFactor = 1.2;
      const engineForce = cfg.engineForce * gasFactor * effectiveAggression;
      this.vehicle.applyEngineForce(engineForce, 2);
      this.vehicle.applyEngineForce(engineForce, 3);
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    // Проверка на застревание
    const posDelta = new THREE.Vector3().subVectors(pos, this.lastPos);
    const moveDistance = posDelta.length();
    this.lastPos.copy(pos);

    if (moveDistance < 1.0 && this.speed < 10) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.0) {
        if (Math.random() > 0.5) {
          this.vehicle.applyEngineForce(cfg.engineForce * this.aggression, 2);
          this.vehicle.applyEngineForce(cfg.engineForce * this.aggression, 3);
          this.vehicle.setBrake(0, 0);
          this.vehicle.setBrake(0, 1);
          this.vehicle.setBrake(0, 2);
          this.vehicle.setBrake(0, 3);
        } else {
          this.vehicle.applyEngineForce(-cfg.reverseForce * 0.8, 2);
          this.vehicle.applyEngineForce(-cfg.reverseForce * 0.8, 3);
        }
        
        if (this.stuckTimer > 2.5) {
          const forward = new THREE.Vector3(0, 0, -1);
          forward.applyQuaternion(this.mesh.quaternion);
          this.chassisBody.applyImpulse(
            new CANNON.Vec3(
              forward.x * 200 + (Math.random() - 0.5) * 50,
              0,
              forward.z * 200 + (Math.random() - 0.5) * 50
            ),
            this.chassisBody.position
          );
          this.stuckTimer = 0;
        }
      }
    } else {
      this.stuckTimer = 0;
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