import * as THREE from 'three';

/**
 * Масляное пятно — создаёт область, в которой машины теряют управление на 1 секунду.
 * Визуально — полупрозрачное тёмное пятно на земле.
 */
export class Oil {
  constructor(position, scene) {
    this.scene = scene;
    this.position = position.clone();
    this.position.y = 0.01;
    this.active = true;
    this.duration = 7000; // живёт 7 секунд
    this.spawnTime = Date.now();
    this.radius = 4;
    this.stunDuration = 1000; // потеря управления на 1 сек
    
    this._createVisual();
  }
  
  _createVisual() {
    // Основное пятно — полупрозрачный чёрный круг
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    
    // Радужные разводы для заметности
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 50;
      const hue = Math.random() * 60 + 200; // сине-фиолетовые тона
      ctx.fillStyle = `hsla(${hue}, 70%, 40%, 0.15)`;
      ctx.beginPath();
      ctx.arc(64 + Math.cos(angle) * dist, 64 + Math.sin(angle) * dist, 3 + Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.radius * 2, this.radius * 2),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0.02;
    this.scene.add(this.mesh);
  }
  
  /**
   * Проверяет, находится ли машина на масляном пятне
   * @param {Object} car - CarController или bot controller
   * @returns {boolean} true если машина на пятне
   */
  checkCollision(car) {
    if (!this.active) return false;
    
    const carPos = car.mesh ? car.mesh.position : car.chassisBody.position;
    const dist = carPos.distanceTo(this.position);
    
    return dist < this.radius;
  }
  
  update(dt) {
    if (!this.active) return true; // удалить
    
    // Анимация пульсации
    const elapsed = Date.now() - this.spawnTime;
    const pulse = 1 + Math.sin(elapsed * 0.003) * 0.05;
    this.mesh.scale.set(pulse, pulse, 1);
    
    // Мерцание прозрачности перед исчезновением
    if (elapsed > this.duration - 2000) {
      const fade = (this.duration - elapsed) / 2000;
      this.mesh.material.opacity = fade * 0.9;
    }
    
    // Исчезновение
    if (elapsed > this.duration) {
      this.destroy();
      return true;
    }
    
    return false;
  }
  
  destroy() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.mesh.material.map) this.mesh.material.map.dispose();
      this.mesh.material.dispose();
      this.scene.remove(this.mesh);
    }
    this.active = false;
  }
}