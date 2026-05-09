import * as THREE from 'three';

/**
 * Пул эффектов для избежания микролагов при создании частиц и геометрий
 * Переиспользует геометрии, материалы и объекты вместо постоянного создания/удаления
 */
export class EffectsPool {
  constructor(scene, maxParticles = 200) {
    this.scene = scene;
    this.maxParticles = maxParticles;

    // Активные частицы
    this.activeParticles = [];

    // Пул неактивных частиц
    this.particlePool = [];

    // Кэшированные геометрии (переиспользуем)
    this.geometries = {
      sphere: new THREE.SphereGeometry(0.15, 4, 4),
      flash: new THREE.SphereGeometry(2, 8, 8),
      smallFlash: new THREE.SphereGeometry(1.5, 8, 8),
      mineFlash: new THREE.SphereGeometry(1.2, 8, 8)
    };

    // Кэшированные материалы
    this.materials = {
      orange: new THREE.MeshBasicMaterial({ color: 0xff4400 }),
      yellow: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
      mine: new THREE.MeshBasicMaterial({ color: 0xff8800 }),
      red: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      white: new THREE.MeshBasicMaterial({ color: 0xffffff })
    };

    // Предварительно создаём пул частиц
    this._preallocateParticles();

    // Активные вспышки
    this.activeFlashes = [];
  }

  _preallocateParticles() {
    for (let i = 0; i < this.maxParticles; i++) {
      const mesh = new THREE.Mesh(
        this.geometries.sphere,
        this.materials.orange.clone()
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh: mesh,
        velocity: new THREE.Vector3(),
        life: 0
      });
    }
  }

  /**
   * Получить частицу из пула
   */
  _getParticle(color) {
    if (this.particlePool.length === 0) {
      // Если пул пуст, создаём новую (но это не должно часто происходить)
      const mesh = new THREE.Mesh(
        this.geometries.sphere,
        this.materials[color].clone()
      );
      mesh.visible = false;
      this.scene.add(mesh);
      return {
        mesh: mesh,
        velocity: new THREE.Vector3(),
        life: 0
      };
    }

    const particle = this.particlePool.pop();
    particle.mesh.material = this.materials[color].clone();
    particle.mesh.visible = true;
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

    if (this.particlePool.length < this.maxParticles) {
      this.particlePool.push(particle);
    } else {
      this.scene.remove(particle.mesh);
    }
  }

  /**
   * Создать взрыв с переиспользуемыми частицами
   */
  createExplosion(position, count = 30, color = 'orange') {
    for (let i = 0; i < count; i++) {
      const particle = this._getParticle(color);
      particle.mesh.position.copy(position);
      particle.velocity.set(
        (Math.random() - 0.5) * 20,
        Math.random() * 15,
        (Math.random() - 0.5) * 20
      );
      particle.life = 1.0;
      this.activeParticles.push(particle);
    }
  }

  /**
   * Создать вспышку (переиспользуем геометрию)
   */
  createFlash(position, color = 0xff4400, duration = 0.3, size = 2) {
    const flash = new THREE.Mesh(
      size <= 1.5 ? this.geometries.smallFlash : this.geometries.flash,
      new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      })
    );
    flash.position.copy(position);
    flash.userData.life = duration;
    flash.userData.maxLife = duration;
    this.scene.add(flash);
    this.activeFlashes.push(flash);
  }

  /**
   * Создать кольцо (для щита)
   */
  createRing(position, color = 0x00ffff, duration = 1.0) {
    const geometry = new THREE.TorusGeometry(1.5, 0.2, 8, 32);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(position);
    ring.rotation.x = Math.PI / 2;
    ring.userData.life = duration;
    ring.userData.maxLife = duration;
    this.scene.add(ring);
    this.activeFlashes.push(ring);
  }

  /**
   * Обновление всех эффектов
   */
  update(dt) {
    // Обновляем частицы
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.velocity.y -= 9.8 * dt; // Гравитация
      p.life -= dt * 2;
      p.mesh.scale.setScalar(p.life);

      if (p.life <= 0) {
        this._returnParticle(p);
        this.activeParticles.splice(i, 1);
      }
    }

    // Обновляем вспышки
    for (let i = this.activeFlashes.length - 1; i >= 0; i--) {
      const flash = this.activeFlashes[i];
      flash.userData.life -= dt;
      const progress = flash.userData.life / flash.userData.maxLife;
      flash.material.opacity = progress * 0.8;

      if (flash.userData.life <= 0) {
        this.scene.remove(flash);
        if (flash.geometry !== this.geometries.flash &&
            flash.geometry !== this.geometries.smallFlash) {
          flash.geometry.dispose();
        }
        flash.material.dispose();
        this.activeFlashes.splice(i, 1);
      }
    }
  }

  /**
   * Очистить все эффекты
   */
  clear() {
    // Вернуть все частицы в пул
    for (const p of this.activeParticles) {
      this._returnParticle(p);
    }
    this.activeParticles = [];

    // Удалить все вспышки
    for (const flash of this.activeFlashes) {
      this.scene.remove(flash);
      if (flash.geometry !== this.geometries.flash &&
          flash.geometry !== this.geometries.smallFlash) {
        flash.geometry.dispose();
      }
      flash.material.dispose();
    }
    this.activeFlashes = [];
  }

  /**
   * Полное уничтожение (при закрытии игры)
   */
  dispose() {
    this.clear();

    // Удаляем все частицы из пула
    for (const p of this.particlePool) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.particlePool = [];

    // Удаляем кэшированные геометрии
    Object.values(this.geometries).forEach(g => g.dispose());
    Object.values(this.materials).forEach(m => m.dispose());
  }
}