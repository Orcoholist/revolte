import * as THREE from 'three';

/**
 * Кэшированные геометрии и материалы для Mine
 */
const _mineGeometries = {
  body: new THREE.SphereGeometry(0.8, 8, 8),
  spike: new THREE.ConeGeometry(0.15, 0.4, 4)
};

const _mineMaterials = {
  body: new THREE.MeshPhongMaterial({
    color: 0xff8800,
    emissive: 0xff4400,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.9
  }),
  spike: new THREE.MeshPhongMaterial({
    color: 0xff4400,
    emissive: 0xff2200,
    emissiveIntensity: 0.5
  })
};

/**
 * Мина - ставится на трассе и взрывается при столкновении
 */
export class Mine {
  constructor(position, scene) {
    this.scene = scene;
    this.position = position.clone();
    this.position.y = 0.2;
    this.alive = true;
    this._timeAccum = 0;
    this.lifetime = 30; // 30 секунд

    this.mesh = this._createMesh();
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    this.light = new THREE.PointLight(0xff8800, 0.5, 8);
    this.light.position.copy(this.position);
    this.light.position.y += 0.5;
    scene.add(this.light);
  }

  _createMesh() {
    const body = new THREE.Mesh(_mineGeometries.body, _mineMaterials.body);

    const spikes = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(_mineGeometries.spike, _mineMaterials.spike);
      const angle = (i / 8) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.8, 0, Math.sin(angle) * 0.8);
      spike.rotation.x = Math.PI / 2;
      spike.rotation.z = angle + Math.PI / 2;
      spikes.add(spike);
    }

    const group = new THREE.Group();
    group.add(body);
    group.add(spikes);

    return group;
  }

  update(dt) {
    if (!this.alive) return;

    this._timeAccum += dt;

    // Пульсация
    const scale = 1 + Math.sin(this._timeAccum * 5) * 0.1;
    this.mesh.scale.set(scale, scale, scale);

    // Свет тоже пульсирует
    this.light.intensity = 0.4 + Math.sin(this._timeAccum * 5) * 0.2;

    // Мина исчезает через время
    if (this._timeAccum > this.lifetime) {
      this.destroy();
      return true;
    }
    return false;
  }

  checkCollision(car, threshold = 2.5) {
    if (!this.alive) return false;
    
    if (car.hasActiveShield) {
      if (typeof car.hasActiveShield === 'function' && car.hasActiveShield()) {
        return false;
      }
    }
    
    const dist = car.chassisBody.position.distanceTo(this.position);
    return dist < threshold;
  }

  explode() {
    if (!this.alive) return;
    this.alive = false;

    if (window.effectsPool) {
      window.effectsPool.createExplosion(this.position, 25, 'mine');
      window.effectsPool.createFlash(this.position, 0xff8800, 0.5, 2);
    } else {
      const particleCount = 25;
      const particles = [];

      for (let i = 0; i < particleCount; i++) {
        const geom = new THREE.SphereGeometry(0.12, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xff8800 : 0xff4400
        });
        const particle = new THREE.Mesh(geom, mat);
        particle.position.copy(this.position);
        this.scene.add(particle);
        particles.push({
          mesh: particle,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            Math.random() * 10 + 5,
            (Math.random() - 0.5) * 15
          ),
          life: 1.0
        });
      }

      const flashGeom = new THREE.SphereGeometry(2, 8, 8);
      const flashMat = new THREE.MeshBasicMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      });
      const flash = new THREE.Mesh(flashGeom, flashMat);
      flash.position.copy(this.position);
      this.scene.add(flash);

      let frame = 0;
      const animateExplosion = () => {
        frame++;
        let allDead = true;

        for (const p of particles) {
          p.mesh.position.add(p.velocity.clone().multiplyScalar(0.016));
          p.velocity.y -= 9.8 * 0.016;
          p.life -= 0.04;
          p.mesh.scale.setScalar(p.life);
          if (p.life > 0) allDead = false;
        }

        flash.material.opacity -= 0.05;
        flash.scale.multiplyScalar(1.05);

        if ((!allDead || flash.material.opacity > 0) && frame < 50) {
          requestAnimationFrame(animateExplosion);
        } else {
          for (const p of particles) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
          }
          this.scene.remove(flash);
          flash.geometry.dispose();
          flash.material.dispose();
        }
      };
      animateExplosion();
    }

    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
    if (this.light) {
      this.scene.remove(this.light);
    }
  }
}