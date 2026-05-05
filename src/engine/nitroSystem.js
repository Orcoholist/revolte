import * as THREE from 'three';

/**
 * Система нитро-ускорения с эффектами частиц
 */
export class NitroSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    
    // Материал для нитро-частиц (ярко-голубой огонь)
    this.nitroMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    // Состояние нитро
    this.isActive = false;
    this.amount = 100; // Текущий запас нитро (0-100)
    this.maxAmount = 100;
    this.rechargeRate = 5; // Восстановление в секунду
    this.consumptionRate = 40; // Расход в секунду
    this.boostMultiplier = 1.5; // Множитель скорости
  }

  /**
   * Активирует нитро
   */
  activate() {
    if (this.amount > 10) {
      this.isActive = true;
      return true;
    }
    return false;
  }

  /**
   * Деактивирует нитро
   */
  deactivate() {
    this.isActive = false;
  }

  /**
   * Создаёт частицу нитро-огня из выхлопной трубы
   */
  emitNitroFlame(position, direction) {
    const size = 0.2 + Math.random() * 0.3;
    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const particle = new THREE.Mesh(geometry, this.nitroMaterial.clone());
    
    // Разброс для реалистичности
    const spread = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.3
    );
    
    particle.position.copy(position).add(spread);
    particle.userData = {
      type: 'nitro',
      velocity: direction.clone().multiplyScalar(2 + Math.random() * 2),
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      sizeGrowth: 0.1
    };
    
    this.scene.add(particle);
    this.particles.push(particle);
  }

  /**
   * Создаёт след от нитро (длинный шлейф)
   */
  emitNitroTrail(position, direction) {
    const geometry = new THREE.ConeGeometry(0.3, 1.5, 8);
    const particle = new THREE.Mesh(geometry, this.trailMaterial.clone());
    
    particle.position.copy(position);
    particle.lookAt(position.clone().add(direction));
    
    particle.userData = {
      type: 'trail',
      velocity: direction.clone().multiplyScalar(0.5),
      life: 0.8,
      maxLife: 1.0,
      sizeGrowth: 0
    };
    
    this.scene.add(particle);
    this.particles.push(particle);
  }

  /**
   * Создаёт искры при активации нитро
   */
  emitSparkBurst(position, direction, count = 20) {
    const sparkMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0
    });
    
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(0.05, 4, 4);
      const particle = new THREE.Mesh(geometry, sparkMaterial);
      
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      
      particle.position.copy(position);
      particle.userData = {
        type: 'spark',
        velocity: direction.clone().add(spread).normalize().multiplyScalar(3 + Math.random() * 3),
        gravity: -9.8,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        sizeGrowth: 0
      };
      
      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  /**
   * Обновляет все частицы
   */
  update(dt) {
    // Расход нитро при активном ускорении
    if (this.isActive && this.amount > 0) {
      this.amount -= this.consumptionRate * dt;
      if (this.amount <= 0) {
        this.amount = 0;
        this.isActive = false;
      }
    } else if (!this.isActive && this.amount < this.maxAmount) {
      // Восстановление нитро
      this.amount += this.rechargeRate * dt;
      if (this.amount > this.maxAmount) {
        this.amount = this.maxAmount;
      }
    }

    // Обновляем частицы
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const data = particle.userData;
      
      // Обновляем позицию
      particle.position.add(data.velocity.clone().multiplyScalar(dt));
      
      // Гравитация для искр
      if (data.type === 'spark') {
        data.velocity.y += data.gravity * dt;
      }
      
      // Увеличиваем размер для некоторых частиц
      if (data.sizeGrowth > 0) {
        const scale = 1 + data.sizeGrowth * dt * 10;
        particle.scale.multiplyScalar(scale);
      }
      
      // Уменьшаем жизнь
      data.life -= dt;
      
      // Уменьшаем прозрачность
      const opacity = Math.max(0, data.life / data.maxLife);
      if (particle.material.opacity !== undefined) {
        particle.material.opacity = opacity;
      }
      
      // Удаляем мёртвые частицы
      if (data.life <= 0) {
        this.scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Применяет эффект нитро к скорости машины
   */
  getSpeedMultiplier() {
    return this.isActive ? this.boostMultiplier : 1.0;
  }

  /**
   * Получает текущий запас нитро (0-100)
   */
  getAmount() {
    return this.amount;
  }

  /**
   * Проверяет, активно ли нитро
   */
  isNitroActive() {
    return this.isActive;
  }

  /**
   * Полностью расходует нитро (для экстренного ускорения)
   */
  consumeAll() {
    if (this.amount > 0) {
      this.amount = 0;
      this.isActive = true;
      return true;
    }
    return false;
  }

  /**
   * Очищает все частицы
   */
  dispose() {
    for (const particle of this.particles) {
      this.scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    }
    this.particles = [];
  }
}
