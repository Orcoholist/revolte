import * as THREE from 'three';

/**
 * Кэшированные геометрии и материалы для Ball
 */
const _ballGeometries = {
  sphere: new THREE.SphereGeometry(1.8, 12, 12),
  ring: new THREE.TorusGeometry(1.8 * 1.3, 0.1, 8, 16),
  glow: new THREE.SphereGeometry(1.8 * 0.6, 8, 8)
};

const _ballMaterials = {
  sphere: new THREE.MeshStandardMaterial({
    color: 0xff8800,
    emissive: 0xff4400,
    emissiveIntensity: 0.3,
    roughness: 0.2,
    metalness: 0.6
  }),
  ring: new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.6
  }),
  glow: new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.3
  })
};

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
    this.speed = 5;
    this.alive = true;
    this.lifetime = 8; // 8 секунд жизни
    this._timeAccum = 0;
    this.radius = 1.8;
    
    this._createVisual();
  }
  
  _createVisual() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.position.y = this.radius;
    
    // Основной шар
    this.mesh = new THREE.Mesh(_ballGeometries.sphere, _ballMaterials.sphere);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    
    // Сияющее кольцо
    this.ring = new THREE.Mesh(_ballGeometries.ring, _ballMaterials.ring);
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.ring);
    
    // Внутреннее свечение
    this.glow = new THREE.Mesh(_ballGeometries.glow, _ballMaterials.glow);
    this.group.add(this.glow);
    
    this.scene.add(this.group);
  }
  
  update(dt) {
    if (!this.alive) return true;
    
    this._timeAccum += dt;
    
    // Движение
    this.position.x += this.direction.x * this.speed * dt;
    this.position.z += this.direction.z * this.speed * dt;
    this.position.y = this.radius + Math.sin(this._timeAccum * 5) * 0.2;
    
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
      const pulse = 1 + Math.sin(this._timeAccum * 4) * 0.2;
      this.glow.scale.set(pulse, pulse, pulse);
    }
    
    // Исчезновение
    if (this._timeAccum > this.lifetime - 2) {
      const fade = (this.lifetime - this._timeAccum) / 2;
      this.group.traverse((child) => {
        if (child.material) {
          child.material.opacity = child.material.opacity || 1;
          child.material.transparent = true;
          child.material.opacity = fade;
        }
      });
    }
    
    if (this._timeAccum > this.lifetime) {
      this.destroy();
      return true;
    }
    
    return false;
  }
  
  checkCollision(car) {
    if (!this.alive) return false;
    
    const carPos = car.mesh ? car.mesh.position : car.chassisBody.position;
    const dist = carPos.distanceTo(this.position);
    
    return dist < this.radius + 1.5;
  }
  
  hitCar(controller) {
    const vel = controller.chassisBody.velocity;
    vel.x *= 0.1;
    vel.y = 0;
    vel.z *= 0.1;
    vel.y = 3;
  }
  
  destroy() {
    if (this.group) {
      this.scene.remove(this.group);
    }
    this.alive = false;
  }
}