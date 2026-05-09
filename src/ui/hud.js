/**
 * HUD: спидометр, время, круги.
 */
export class HUD {
  constructor() {
    this.elTime = document.getElementById('time');
    this.elLap = document.getElementById('lap');
    this.elBest = document.getElementById('best');
    this.elCheckpointDist = document.getElementById('checkpoint-distance');

    // Индикатор предмета
    this.elItemIcon = document.getElementById('item-icon');
    this.elItemName = document.getElementById('item-name');
    this.elItemIndicator = document.getElementById('item-indicator');
  }

  update(carController, state, lapCounter = null) {
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

    // Обновление индикатора предмета
    if (window.itemSystem) {
      const current = window.itemSystem.getCurrentItem();
      if (current) {
        this.elItemIcon.textContent = current.icon;
        if (current.cooldown) {
          this.elItemName.textContent = `${current.name} (${current.cooldown.toFixed(1)}с)`;
          this.elItemIndicator.classList.remove('ready');
        } else {
          this.elItemName.textContent = current.name;
          this.elItemIndicator.classList.add('ready');
        }
        this.elItemIcon.style.display = 'block';
        this.elItemName.style.display = 'block';
        this.elItemIndicator.style.display = 'flex';
      } else {
        this.elItemIcon.style.display = 'none';
        this.elItemName.style.display = 'none';
        this.elItemIndicator.style.display = 'none';
        this.elItemIndicator.classList.remove('ready');
      }
    }
  }
}