import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Rocket } from './rocket.js';

/**
 * Поезд – движется по зигзагообразному пути и стреляет ракетами каждые 4 секунды.
 */
export class MovingTrain {
  constructor(scene, world, path, trainModel) {
    this.scene = scene;
    this.world = world;
    this.path = path || []; // не используется – поезд движется по зигзагу
    this.mesh = trainModel;
    this.alive = true;
    this.speed = 15; // скорость движения по пути
    this._timeAccum = 0;
    this._lastShotTime = 0;
    this.shootInterval = 4; // секунды

    // Генерируем зигзагообразный путь (такой же, как в track.js)
    this.pathPoints = this._generateZigzagPath();
    this.currentSegment = 0; // индекс текущего сегмента (отрезка между точками)
    this.progress = 0; // прогресс вдоль текущего сегмента (0..1)

    // Размещаем поезд в начале пути
    const startPos = this.pathPoints[0];
    this.mesh.position.set(startPos.x, 2.0, startPos.z);
    this.mesh.scale.set(1.5, 1.5, 1.5);
    // Разворачиваем модель на 180 градусов
    this.mesh.rotation.y += Math.PI;
    this.scene.add(this.mesh);

    // Физическое тело (коллизия) – движется вместе с поездом
    const bodyShape = new CANNON.Box(new CANNON.Vec3(4, 2, 10));
    this.body = new CANNON.Body({ mass: 0 });
    this.body.addShape(bodyShape);
    this.body.position.set(startPos.x, 2.5, startPos.z);
    this.world.addBody(this.body);
  }

  /**
   * Генерирует зигзагообразный путь (копия из track.js)
   */
  _generateZigzagPath() {
    const points = [];
    const step = 20;
    const halfSize = 100;
    
    let x = -halfSize;
    let z = -halfSize;
    let direction = 1;
    
    while (z <= halfSize) {
      points.push(new THREE.Vector3(x, 0, z));
      
      while (true) {
        const nextX = x + direction * step;
        if (nextX > halfSize || nextX < -halfSize) {
          x = direction > 0 ? halfSize : -halfSize;
          points.push(new THREE.Vector3(x, 0, z));
          break;
        }
        x = nextX;
        points.push(new THREE.Vector3(x, 0, z));
      }
      
      z += step;
      if (z > halfSize) break;
      
      points.push(new THREE.Vector3(x, 0, z));
      direction *= -1;
    }
    
    return points;
  }

  update(dt) {
    if (!this.alive) return;

    this._timeAccum += dt;

    // Движение по зигзагообразному пути
    const segmentLength = this._getSegmentLength(this.currentSegment);
    const moveDistance = this.speed * dt;
    
    this.progress += moveDistance / segmentLength;
    
    // Если дошли до конца сегмента, переходим к следующему
    while (this.progress >= 1.0) {
      this.progress -= 1.0;
      this.currentSegment++;
      
      // Если прошли все сегменты, зацикливаемся
      if (this.currentSegment >= this.pathPoints.length - 1) {
        this.currentSegment = 0;
        this.progress = 0;
      }
    }
    
    // Интерполируем позицию между точками сегмента
    const p1 = this.pathPoints[this.currentSegment];
    const p2 = this.pathPoints[this.currentSegment + 1];
    
    const x = p1.x + (p2.x - p1.x) * this.progress;
    const z = p1.z + (p2.z - p1.z) * this.progress;
    
    this.mesh.position.set(x, 2.0, z);
    
    // Поворачиваем поезд по направлению движения (с учётом разворота на 180°)
    const dirAngle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
    this.mesh.rotation.y = -dirAngle + Math.PI; // +Math.PI для разворота модели

    // Обновляем физическое тело
    this.body.position.set(x, 2.5, z);

    // Стрельба каждые 4 секунды
    if (this._timeAccum - this._lastShotTime >= this.shootInterval) {
      this._shootRocket();
      this._lastShotTime = this._timeAccum;
    }
  }

  /**
   * Вычисляет длину сегмента между точками
   */
  _getSegmentLength(index) {
    const p1 = this.pathPoints[index];
    const p2 = this.pathPoints[index + 1];
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.z - p1.z) ** 2);
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
    this.currentSegment = 0;
    this.progress = 0;
    const startPos = this.pathPoints[0];
    this.mesh.position.set(startPos.x, 2.0, startPos.z);
    this.body.position.set(startPos.x, 2.5, startPos.z);
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
