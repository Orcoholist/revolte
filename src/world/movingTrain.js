import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Rocket } from './rocket.js';

/**
 * Поезд – неподвижная турель, стреляющая ракетами каждые 4 секунды.
 * Расположен в центре карты.
 */
export class MovingTrain {
  constructor(scene, world, path, trainModel) {
    this.scene = scene;
    this.world = world;
    this.path = path || []; // не используется – поезд статичен
    this.mesh = trainModel;
    this.alive = true;
    this.speed = 0; // всегда 0
    this._timeAccum = 0;
    this._lastShotTime = 0;
    this.shootInterval = 4; // секунды

    // Размещаем поезд в центре карты
    this.mesh.position.set(0, 0.5, 0);
    this.mesh.scale.set(1.5, 1.5, 1.5);
    this.scene.add(this.mesh);

    // Физическое тело (коллизия)
    const bodyShape = new CANNON.Box(new CANNON.Vec3(4, 2, 10));
    this.body = new CANNON.Body({ mass: 0 });
    this.body.addShape(bodyShape);
    this.body.position.set(0, 2, 0);
    this.world.addBody(this.body);
  }

  update(dt) {
    if (!this.alive) return;

    this._timeAccum += dt;

    // Стрельба каждые 4 секунды
    if (this._timeAccum - this._lastShotTime >= this.shootInterval) {
      this._shootRocket();
      this._lastShotTime = this._timeAccum;
    }
  }

  _shootRocket() {
    if (!window.botManager || !window.car) return;

    // Создаём ракету, вылетающую из поезда
    const rocket = new Rocket(this.mesh, this.scene, window.botManager);
    
    // Направляем ракету на ближайшую цель (игрок или бот)
    const targets = [];
    if (window.car && window.car.chassisBody) {
      targets.push({
        pos: window.car.chassisBody.position.clone(),
        isPlayer: true
      });
    }
    if (window.botManager && window.botManager.bots) {
      for (const bot of window.botManager.bots) {
        if (bot.controller && bot.controller.chassisBody) {
          targets.push({
            pos: bot.controller.chassisBody.position.clone(),
            isPlayer: false,
            bot: bot
          });
        }
      }
    }

    if (targets.length === 0) {
      rocket.destroy();
      return;
    }

    // Выбираем ближайшую цель
    const trainPos = this.mesh.position;
    let closestDist = Infinity;
    let closestTarget = null;
    for (const t of targets) {
      const dist = t.pos.distanceTo(trainPos);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = t;
      }
    }

    if (!closestTarget) {
      rocket.destroy();
      return;
    }

    // Устанавливаем цель ракеты
    rocket.target = closestTarget.pos.clone();
    if (closestTarget.isPlayer) {
      rocket.isTargetingPlayer = true;
      rocket.targetBot = null;
    } else {
      rocket.isTargetingPlayer = false;
      rocket.targetBot = closestTarget.bot;
    }

    // Ракета уже добавлена в scene через конструктор, сохраняем её
    if (window.itemSystem) {
      window.itemSystem.activeRockets.push(rocket);
    }
  }

  checkCollision(car) {
    if (!this.alive) return false;
    const carPos = car.mesh ? car.mesh.position : car.chassisBody.position;
    const dist = carPos.distanceTo(this.mesh.position);
    // Радиус столкновения – 6 метров (габариты поезда)
    return dist < 6;
  }

  reset() {
    this.mesh.position.set(0, 0.5, 0);
    this.body.position.set(0, 2, 0);
    this._timeAccum = 0;
    this._lastShotTime = 0;
    this.alive = true;
  }

  destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
    if (this.body) {
      this.world.removeBody(this.body);
    }
    this.alive = false;
  }
}
