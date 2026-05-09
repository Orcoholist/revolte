import { CONFIG } from '../engine/config.js';

/**
 * HUD: спидометр, время, круги, миникарта.
 */
export class HUD {
  constructor() {
    this.elSpeed = document.getElementById('speed');
    this.elTime = document.getElementById('time');
    this.elLap = document.getElementById('lap');
    this.elBest = document.getElementById('best');
    this.elCheckpointDist = document.getElementById('checkpoint-distance');

    // Индикатор предмета
    this.elItemIcon = document.getElementById('item-icon');
    this.elItemName = document.getElementById('item-name');

    // Миникарта
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 150;
    this.canvas.height = 150;
  }

  update(carController, state, lapCounter = null) {
    this.elSpeed.textContent = Math.round(carController.speed);

    if (state.isPlaying) {
      const elapsed = (Date.now() - state.startTime) / 1000;
      this.elTime.textContent = elapsed.toFixed(2);
      
      // Берём круг из lapCounter если есть, иначе из state
      const currentLap = lapCounter ? lapCounter.getCurrentLap() : state.lap;
      this.elLap.textContent = `${currentLap}/${state.maxLaps}`;

      if (state.bestTime != null) {
        this.elBest.textContent = state.bestTime.toFixed(2) + 's';
      }
      
      // Дистанция до следующей контрольной точки
      if (lapCounter && carController.mesh) {
        const nextCheckpoint = lapCounter.getNextCheckpoint();
        if (nextCheckpoint) {
          const distance = Math.round(carController.mesh.position.distanceTo(nextCheckpoint));
          this.elCheckpointDist.textContent = `🎯 ${distance}м`;
          
          // Меняем цвет в зависимости от дистанции
          if (distance < 15) {
            this.elCheckpointDist.style.color = '#00ff00';
          } else if (distance < 40) {
            this.elCheckpointDist.style.color = '#ffff00';
          } else {
            this.elCheckpointDist.style.color = '#ff6600';
          }
        }
      }
    }

    this._drawMinimap(carController);

    // Обновление индикатора предмета
    if (window.itemSystem) {
      const current = window.itemSystem.getCurrentItem();
      if (current) {
        this.elItemIcon.textContent = current.icon;
        if (current.cooldown) {
          this.elItemName.textContent = `${current.name} (${current.cooldown.toFixed(1)}с)`;
        } else {
          this.elItemName.textContent = current.name;
        }
        this.elItemIcon.style.display = 'block';
        this.elItemName.style.display = 'block';
      } else {
        this.elItemIcon.style.display = 'none';
        this.elItemName.style.display = 'none';
      }
    }
  }

  _drawMinimap(car) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    // Трасса — упрощённый прямоугольник
    const scale = 0.85;
    const cx = w / 2;
    const cy = h / 2;

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 12;
    ctx.strokeRect(cx - 50 * scale, cy - 30 * scale, 100 * scale, 60 * scale);

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 8;
    ctx.strokeRect(cx - 50 * scale, cy - 30 * scale, 100 * scale, 60 * scale);

    // Стартовая линия
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 50 * scale, cy);
    ctx.lineTo(cx - 35 * scale, cy);
    ctx.stroke();

    // Машина
    const carX = cx + car.mesh.position.x * scale * 0.6 - 50 * scale * 0.6;
    const carY = cy + car.mesh.position.z * scale * 0.6;

    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(carX, carY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Направление машины
    const rot = car.mesh.rotation.y;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(carX, carY);
    ctx.lineTo(carX + Math.sin(rot) * 10, carY - Math.cos(rot) * 10);
    ctx.stroke();
    
    // Стрелка к контрольной точке (если есть)
    if (car.userData && car.userData.nextCheckpoint) {
      const cpX = cx + car.userData.nextCheckpoint.x * scale * 0.6 - 50 * scale * 0.6;
      const cpY = cy + car.userData.nextCheckpoint.z * scale * 0.6;
      
      // Направление к контрольной точке
      const angle = Math.atan2(cpY - carY, cpX - carX);
      const arrowLen = 15;
      
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(carX, carY);
      ctx.lineTo(carX + Math.cos(angle) * arrowLen, carY + Math.sin(angle) * arrowLen);
      ctx.stroke();
      
      // Стрелочка
      const headLen = 5;
      ctx.beginPath();
      ctx.moveTo(carX + Math.cos(angle) * arrowLen, carY + Math.sin(angle) * arrowLen);
      ctx.lineTo(
        carX + Math.cos(angle - Math.PI / 6) * headLen + Math.cos(angle) * arrowLen,
        carY + Math.sin(angle - Math.PI / 6) * headLen + Math.sin(angle) * arrowLen
      );
      ctx.moveTo(carX + Math.cos(angle) * arrowLen, carY + Math.sin(angle) * arrowLen);
      ctx.lineTo(
        carX + Math.cos(angle + Math.PI / 6) * headLen + Math.cos(angle) * arrowLen,
        carY + Math.sin(angle + Math.PI / 6) * headLen + Math.sin(angle) * arrowLen
      );
      ctx.stroke();
    }
  }
}