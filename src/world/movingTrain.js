import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Rocket } from './rocket.js';

/**
 * Поезд – движется по кругу по рельсам (радиус 30) и стреляет ракетами каждые 4 секунды.
 */
export class MovingTrain {
  constructor(scene, world, path, trainModel) {
    this.scene = scene;
    this.world = world;
    this.path = path || []; // не используется – поезд движется по кругу
    this.mesh = trainModel;
    this.alive = true;
    this.speed = 15; // скорость движения по кругу
    this._timeAccum = 0;
    this._lastShotTime = 0;
    this.shootInterval = 4; // секунды

    // Параметры кругового движения
    this.railRadius = 30;
    this.angle = 0; // текущий угол на окружности

    // Размещаем поезд на рельсах (начальный угол 0)
    this.mesh.position.set(this.railRadius, 2.0, 0);
    this.mesh.scale.set(1.5, 1.5, 1.5);
    this.scene.add(this.mesh);

    // Физическое тело (коллизия) – движется вместе с поездом
    const bodyShape = new CANNON.Box(new CANNON.Vec3(4, 2, 10));
    this.body = new CANNON.Body({ mass: 0 });
    this.body.addShape(bodyShape);
    this.body.position.set(this.railRadius, 2.5, 0);
    this.world.addBody(this.body);
  }

  update(dt) {
    if (!this.alive) return;

    this._timeAccum += dt;

    // Движение по кругу
    this.angle += this.speed * dt / this.railRadius; // угловая скорость = линейная / радиус
    if (this.angle > Math.PI * 2) {
      this.angle -= Math.PI * 2;
    }

    const x = Math.cos(this.angle) * this.railRadius;
    const z = Math.sin(this.angle) * this.railRadius;

    this.mesh.position.set(x, 2.0, z);
    // Поворачиваем поезд по направлению движения (касательная к окружности)
    const dirAngle = this.angle + Math.PI / 2; // направление движения – по касательной
    this.mesh.rotation.y = -dirAngle;

    // Обновляем физическое тело
    this.body.position.set(x, 2.5, z);

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
    this.angle = 0;
    this.mesh.position.set(this.railRadius, 2.0, 0);
    this.body.position.set(this.railRadius, 2.5, 0);
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
