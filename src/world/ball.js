import * as THREE from 'three';

/**
 * Шар — появляется за машиной и катится в том же направлении.
 * При столкновении с другой машиной сбрасывает её скорость.
 */
export class Ball {
  constructor(position, direction, scene) {
    this.scene = scene;
    this.position = position.clone();
    this.direction = direction.clone();
    this.direction.y = 0;
    this.direction.normalize();
    this.speed = 5; // медленно катится
    this.alive = true;
    this.lifetime = 8000; // 8 секунд жизни
    this.spawnTime = Date.now();
    this.radius = 1.8;
    
    this._createVisual();
  }
  
  _createVisual() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.position.y = this.radius;
    
    // Основной шар
    const geo = new THREE.SphereGeometry(this.radius, 16, 16);
    const mat = new THREE.MeshPhongMaterial({
      color: 0xff8800,
      emissive: 0xff4400,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.6
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    
    // Сияющее кольцо
    const ringGeo = new THREE.TorusGeometry(this.radius * 1.3, 0.1, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.6
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.ring);
    
    // Внутреннее свечение
    const glowGeo = new THREE.SphereGeometry(this.radius * 0.6, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.3
    });
    this.glow = new THREE.Mesh(glowGeo, glowMat);
    this.group.add(this.glow);
    
    this.scene.add(this.group);
  }
  
  update(dt) {
    if (!this.alive) return true;
    
    const elapsed = Date.now() - this.spawnTime;
    
    // Движение
    this.position.x += this.direction.x * this.speed * dt;
    this.position.z += this.direction.z * this.speed * dt;
    this.position.y = this.radius + Math.sin(elapsed * 0.005) * 0.2; // лёгкое подпрыгивание
    
    this.group.position.copy(this.position);
    
    // Вращение шара
    this.mesh.rotation.x += dt * 3;
    this.mesh.rotation.z += dt * 2;
    
    // Вращение кольца
    if (this.ring) {
      this.ring.rotation.y += dt * 1.5;
    }
    
    // Пульсация свечения
    if (this.glow) {
      const pulse = 1 + Math.sin(elapsed * 0.004) * 0.2;
      this.glow.scale.set(pulse, pulse, pulse);
    }
    
    // Исчезновение
    if (elapsed > this.lifetime - 2000) {
      const fade = (this.lifetime - elapsed) / 2000;
      this.group.traverse((child) => {
        if (child.material) {
          child.material.opacity = child.material.opacity || 1;
          child.material.transparent = true;
          child.material.opacity = fade;
        }
      });
    }
    
    if (elapsed > this.lifetime) {
      this.destroy();
      return true;
    }
    
    return false;
  }
  
  /**
   * Проверяет столкновение с машиной
   */
  checkCollision(car) {
    if (!this.alive) return false;
    
    const carPos = car.mesh ? car.mesh.position : car.chassisBody.position;
    const dist = carPos.distanceTo(this.position);
    
    return dist < this.radius + 1.5;
  }
  
  /**
   * Замедляет машину
   */
  hitCar(controller) {
    // Сбрасываем скорость до минимума
    const vel = controller.chassisBody.velocity;
    vel.x *= 0.1;
    vel.y = 0;
    vel.z *= 0.1;
    
    // Небольшой подброс
    vel.y = 3;
    
    console.log('Ball hit car! Speed reduced to 10%');
  }
  
  destroy() {
    if (this.group) {
      this.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.scene.remove(this.group);
    }
    this.alive = false;
  }
}