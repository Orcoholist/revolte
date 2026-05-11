import * as THREE from 'three';

/**
 * Система частиц для эффектов:
 * - Выхлоп из трубы
 * - Дым при дрифте
 * - Искры при столкновении
 * 
 * Оптимизирована: использует пул предсозданных частиц вместо создания новых каждый кадр.
 * Геометрии и материалы кэшируются и переиспользуются.
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.particlePool = [];
    this.maxParticles = 300;
    this._poolReady = false;

    // Кэшированные геометрии
    this.geometries = {
      exhaust: new THREE.SphereGeometry(0.15, 6, 6),
      smoke: new THREE.SphereGeometry(0.4, 6, 6),
      spark: new THREE.SphereGeometry(0.08, 4, 4)
    };

    // Кэшированные материалы (не клонируем каждый раз)
    this.materials = {
      exhaust: new THREE.MeshBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      }),
      smoke: new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
      }),
      spark: new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
      })
    };

    // Предсоздаём пул частиц (если сцена уже есть)
    if (this.scene) {
      this._preallocateParticles();
    }
  }

  /**
   * Устанавливает сцену и предсоздаёт пул, если ещё не сделано
   */
  setScene(scene) {
    this.scene = scene;
    if (!this._poolReady) {
      this._preallocateParticles();
    }
  }

  _preallocateParticles() {
    for (let i = 0; i < this.maxParticles; i++) {
      const mesh = new THREE.Mesh(
        this.geometries.exhaust,
        this.materials.exhaust
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh: mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        type: 'exhaust',
        sizeGrowth: 0,
        gravity: 0
      });
    }
  }

  /**
   * Получить частицу из пула
   */
  _getParticle(type) {
    if (this.particlePool.length === 0) {
      // Пул пуст — переиспользуем самую старую активную частицу
      if (this.particles.length > 0) {
        const oldest = this.particles.shift();
        this.scene.remove(oldest.mesh);
        return oldest;
      }
      return null;
    }

    const particle = this.particlePool.pop();
    
    // Выбираем геометрию и материал по типу
    switch (type) {
      case 'exhaust':
        particle.mesh.geometry = this.geometries.exhaust;
        particle.mesh.material = this.materials.exhaust;
        break;
      case 'smoke':
        particle.mesh.geometry = this.geometries.smoke;
        particle.mesh.material = this.materials.smoke;
        break;
      case 'spark':
        particle.mesh.geometry = this.geometries.spark;
        particle.mesh.material = this.materials.spark;
        break;
    }
    
    particle.mesh.visible = true;
    particle.mesh.scale.setScalar(1);
    particle.mesh.material.opacity = 1;
    particle.type = type;
    return particle;
  }

  /**
   * Вернуть частицу в пул
   */
  _returnParticle(particle) {
    particle.mesh.visible = false;
    particle.mesh.position.set(0, 0, 0);
    particle.mesh.scale.setScalar(1);
    particle.velocity.set(0, 0, 0);
    particle.life = 0;
    particle.maxLife = 1;
    particle.sizeGrowth = 0;
    particle.gravity = 0;

    if (this.particlePool.length < this.maxParticles) {
      this.particlePool.push(particle);
    } else {
      this.scene.remove(particle.mesh);
    }
  }

  /**
   * Создаёт частицу выхлопа из выхлопной трубы
   */
  emitExhaust(position, direction, intensity = 1) {
    const particle = this._getParticle('exhaust');
    if (!particle) return;

    particle.mesh.position.copy(position);
    particle.velocity.copy(direction).multiplyScalar(0.5 + Math.random() * 0.3);
    particle.velocity.y += Math.random() * 0.2;
    particle.life = 1.0;
    particle.maxLife = 1.5;
    particle.sizeGrowth = 0.05;
    particle.gravity = 0;
    particle.mesh.scale.setScalar(intensity);

    this.particles.push(particle);
  }

  /**
   * Создаёт облако дыма при дрифте
   */
  emitSmoke(position, direction, amount = 5) {
    for (let i = 0; i < amount; i++) {
      const particle = this._getParticle('smoke');
      if (!particle) continue;

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.5
      );

      particle.mesh.position.copy(position).add(spread);
      particle.velocity.copy(direction).multiplyScalar(0.2 + Math.random() * 0.2);
      particle.velocity.y += 0.1 + Math.random() * 0.1;
      particle.life = 1.0;
      particle.maxLife = 2.0 + Math.random() * 1.0;
      particle.sizeGrowth = 0.03 + Math.random() * 0.02;
      particle.gravity = 0;
      particle.mesh.scale.setScalar(0.3 + Math.random() * 0.4);

      this.particles.push(particle);
    }
  }

  /**
   * Создаёт искры при столкновении
   */
  emitSparks(position, direction, count = 15) {
    for (let i = 0; i < count; i++) {
      const particle = this._getParticle('spark');
      if (!particle) continue;

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );

      particle.mesh.position.copy(position);
      particle.velocity.copy(direction).add(spread).normalize().multiplyScalar(3 + Math.random() * 3);
      particle.life = 1.0;
      particle.maxLife = 0.5 + Math.random() * 0.5;
      particle.sizeGrowth = 0;
      particle.gravity = -9.8;
      particle.mesh.scale.setScalar(1);

      this.particles.push(particle);
    }
  }

  /**
   * Обновляет все частицы
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Обновляем позицию
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      
      // Гравитация для искр
      if (particle.gravity !== 0) {
        particle.velocity.y += particle.gravity * dt;
      }
      
      // Увеличиваем размер
      if (particle.sizeGrowth > 0) {
        const scale = 1 + particle.sizeGrowth * dt * 10;
        particle.mesh.scale.multiplyScalar(scale);
      }
      
      // Уменьшаем жизнь
      particle.life -= dt;
      
      // Уменьшаем прозрачность
      const opacity = Math.max(0, particle.life / particle.maxLife);
      particle.mesh.material.opacity = opacity * (particle.type === 'spark' ? 1.0 : 0.6);
      
      // Удаляем мёртвые частицы
      if (particle.life <= 0) {
        this._returnParticle(particle);
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Очищает все частицы
   */
  dispose() {
    for (const particle of this.particles) {
      this._returnParticle(particle);
    }
    this.particles = [];

    // Удаляем все частицы из пула
    for (const p of this.particlePool) {
      this.scene.remove(p.mesh);
    }
    this.particlePool = [];

    // Удаляем кэшированные геометрии
    Object.values(this.geometries).forEach(g => g.dispose());
    Object.values(this.materials).forEach(m => m.dispose());
  }
}