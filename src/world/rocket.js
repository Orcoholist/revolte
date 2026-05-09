import * as THREE from 'three';

export class Rocket {
  constructor(carMesh, scene, botManager) {
    this.scene = scene;
    this.botManager = botManager;
    this.active = true;
    this.maxDistance = 120; // Увеличил дальность
    this.distanceTraveled = 0;
    this.speed = 90; // Увеличил скорость
    this.alive = true;
    this.turnSpeed = 0.08; // Скорость поворота к цели

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(carMesh.quaternion);

    this.position = carMesh.position.clone().add(forward.clone().multiplyScalar(2));
    this.position.y += 1.2; // Чуть выше

    this.direction = forward.clone().normalize();

    this.mesh = this._createMesh();
    this.mesh.position.copy(this.position);
    this.mesh.lookAt(this.position.clone().add(this.direction));
    scene.add(this.mesh);

    this.light = new THREE.PointLight(0xff4400, 2, 15);
    this.light.position.copy(this.position);
    scene.add(this.light);
    
    // Добавляем трейл (след) из частиц
    this.trail = [];
    this.trailInterval = 0.02; // Интервал между точками трейла
    this.lastTrailTime = 0;

    this.target = null;
    this.targetBot = null;

    console.log('Rocket launched!');
  }

  _createMesh() {
    const bodyGeom = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0xff4444,
      emissive: 0xff2200,
      emissiveIntensity: 0.8
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = Math.PI / 2;

    const noseGeom = new THREE.ConeGeometry(0.3, 0.8, 8);
    const noseMat = new THREE.MeshPhongMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 0.5
    });
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1;

    const group = new THREE.Group();
    group.add(body);
    group.add(nose);

    return group;
  }
  
  // Создание точки трейла
  _createTrailPoint() {
    const trailGeom = new THREE.SphereGeometry(0.1, 4, 4);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.6
    });
    const trailMesh = new THREE.Mesh(trailGeom, trailMat);
    trailMesh.position.copy(this.position);
    this.scene.add(trailMesh);
    this.trail.push({
      mesh: trailMesh,
      life: 1.0
    });
  }

  update(dt) {
    if (!this.active || !this.alive) return;

    // Обновляем позицию цели, если она существует
    if (this.targetBot && this.targetBot.controller) {
      this.target = this.targetBot.controller.chassisBody.position.clone();
    }

    this._findTarget();

    if (this.target) {
      const toTarget = new THREE.Vector3()
        .subVectors(this.target, this.position);
      toTarget.y = 0;
      const dist = toTarget.length();

      if (dist < 3) {
        this._hitTarget();
        return;
      }

      toTarget.normalize();
      this.direction.lerp(toTarget, this.turnSpeed);
    }

    // Нормализуем направление перед движением
    this.direction.normalize();

    const movement = this.direction.clone().multiplyScalar(this.speed * dt);
    this.position.add(movement);
    this.mesh.position.copy(this.position);

    // Ориентируем ракету в направлении полёта
    const lookTarget = this.position.clone().add(this.direction);
    this.mesh.lookAt(lookTarget);

    this.light.position.copy(this.position);

    this.distanceTraveled += movement.length();

    // Создаем точки трейла
    this.lastTrailTime += dt;
    if (this.lastTrailTime >= this.trailInterval) {
      this._createTrailPoint();
      this.lastTrailTime = 0;
    }

    // Обновляем трейл
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      point.life -= dt * 2;
      point.mesh.scale.setScalar(point.life);
      point.mesh.material.opacity = point.life * 0.6;
      if (point.life <= 0) {
        this.scene.remove(point.mesh);
        this.trail.splice(i, 1);
      }
    }

    if (this.distanceTraveled > this.maxDistance) {
      this.destroy();
    }
  }

  _findTarget() {
    // Если уже есть цель и она валидна, продолжаем преследование
    if (this.targetBot && this.targetBot.controller && this.targetBot.controller.chassisBody) {
      const dist = this.position.distanceTo(this.targetBot.controller.chassisBody.position);
      if (dist < 80) { // Если цель в радиусе 80 метров, продолжаем преследование
        return;
      }
    }

    // Ищем новую цель
    let closestDist = Infinity;
    let closestBot = null;

    for (const bot of this.botManager.bots) {
      if (!bot.controller || !bot.controller.chassisBody) continue;
      
      const botPos = bot.controller.chassisBody.position;
      const dist = this.position.distanceTo(botPos);

      const forward = this.direction.clone();
      const toBot = new THREE.Vector3().subVectors(botPos, this.position);
      toBot.y = 0;
      const dot = forward.dot(toBot.normalize());

      // Ищем ближайшего бота впереди (dot > 0.3) или любого бота в радиусе 40 метров
      if (dist < closestDist && (dot > 0.3 || dist < 40) && dist < 80) {
        closestDist = dist;
        closestBot = bot;
      }
    }

    if (closestBot) {
      this.target = closestBot.controller.chassisBody.position.clone();
      this.targetBot = closestBot;
    }
  }

  _hitTarget() {
    console.log('Rocket hit!');

    if (this.targetBot && this.targetBot.controller) {
      const bot = this.targetBot;
      // Сбрасываем скорость бота
      bot.controller.chassisBody.velocity.set(0, 0, 0);
      bot.controller.chassisBody.angularVelocity.set(0, 0, 0);
      // Переворачиваем бота
      bot.controller.flipOver();
      this._explode();
    } else {
      // Если цели нет (попали в препятствие или землю), просто взрываем
      this._explode();
    }
  }

  _explode() {
    // Используем пул эффектов для взрыва
    if (window.effectsPool) {
      window.effectsPool.createExplosion(this.position, 30, 'orange');
    } else {
      // Fallback если пул не доступен
      const particleCount = 30;
      const particles = [];

      for (let i = 0; i < particleCount; i++) {
        const geom = new THREE.SphereGeometry(0.15, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00
        });
        const particle = new THREE.Mesh(geom, mat);
        particle.position.copy(this.position);
        this.scene.add(particle);
        particles.push({
          mesh: particle,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            Math.random() * 15,
            (Math.random() - 0.5) * 20
          ),
          life: 1.0
        });
      }

      let frame = 0;
      const animateExplosion = () => {
        frame++;
        let allDead = true;

        for (const p of particles) {
          p.mesh.position.add(p.velocity.clone().multiplyScalar(0.016));
          p.velocity.y -= 9.8 * 0.016;
          p.life -= 0.03;
          p.mesh.scale.setScalar(p.life);

          if (p.life > 0) allDead = false;
        }

        if (!allDead && frame < 60) {
          requestAnimationFrame(animateExplosion);
        } else {
          for (const p of particles) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
          }
        }
      };
      animateExplosion();
    }

    this.destroy();
  }

  destroy() {
    this.alive = false;
    this.active = false;
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
    if (this.light) {
      this.scene.remove(this.light);
    }
    // Удаляем трейл
    for (const point of this.trail) {
      this.scene.remove(point.mesh);
    }
    this.trail = [];
  }
}