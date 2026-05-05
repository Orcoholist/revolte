import * as THREE from 'three';

/**
 * Система частиц для эффектов:
 * - Выхлоп из трубы
 * - Дым при дрифте
 * - Искры при столкновении
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    
    // Материалы для разных типов частиц
    this.exhaustMaterial = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    
    this.smokeMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    
    this.sparkMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });
  }

  /**
   * Создаёт частицу выхлопа из выхлопной трубы
   */
  emitExhaust(position, direction, intensity = 1) {
    const geometry = new THREE.SphereGeometry(0.15 * intensity, 8, 8);
    const particle = new THREE.Mesh(geometry, this.exhaustMaterial.clone());
    
    particle.position.copy(position);
    const velocity = direction.clone().multiplyScalar(0.5 + Math.random() * 0.3);
    velocity.y += Math.random() * 0.2;
    
    particle.userData = {
      type: 'exhaust',
      velocity: velocity,
      life: 1.0,
      maxLife: 1.5,
      sizeGrowth: 0.05
    };
    
    this.scene.add(particle);
    this.particles.push(particle);
  }

  /**
   * Создаёт облако дыма при дрифте
   */
  emitSmoke(position, direction, amount = 5) {
    for (let i = 0; i < amount; i++) {
      const size = 0.3 + Math.random() * 0.4;
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const particle = new THREE.Mesh(geometry, this.smokeMaterial.clone());
      
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.5
      );
      
      particle.position.copy(position).add(spread);
      const velocity = direction.clone().multiplyScalar(0.2 + Math.random() * 0.2);
      velocity.y += 0.1 + Math.random() * 0.1;
      
      particle.userData = {
        type: 'smoke',
        velocity: velocity,
        life: 1.0,
        maxLife: 2.0 + Math.random() * 1.0,
        sizeGrowth: 0.03 + Math.random() * 0.02
      };
      
      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  /**
   * Создаёт искры при столкновении
   */
  emitSparks(position, direction, count = 15) {
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(0.08, 6, 6);
      const particle = new THREE.Mesh(geometry, this.sparkMaterial.clone());
      
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
        life: 1.0,
        maxLife: 0.5 + Math.random() * 0.5,
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
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const data = particle.userData;
      
      // Обновляем позицию
      particle.position.add(data.velocity.clone().multiplyScalar(dt));
      
      // Гравитация для искр
      if (data.type === 'spark') {
        data.velocity.y += data.gravity * dt;
      }
      
      // Увеличиваем размер
      const scale = 1 + data.sizeGrowth * dt * 10;
      particle.scale.multiplyScalar(scale);
      
      // Уменьшаем жизнь
      data.life -= dt;
      
      // Уменьшаем прозрачность
      const opacity = Math.max(0, data.life / data.maxLife);
      particle.material.opacity = opacity * (data.type === 'spark' ? 1.0 : 0.6);
      
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
