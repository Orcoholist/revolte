/**
 * Единый ввод: клавиатура + мобильные тач-кнопки.
 */

export class InputManager {
  constructor() {
    this.state = { forward: false, backward: false, left: false, right: false, brake: false };
    this._mobile = { gas: false, brake: false, left: false, right: false, useItemPressed: false };
    this._onUpdate = null; // колбэк при изменении
    this._onUseItem = null; // колбэк при нажатии кнопки предмета

    this._initKeyboard();
    this._initMobile();
  }

  /**
   * Установить колбэк, вызываемый при любом изменении ввода.
   */
  onUpdate(callback) {
    this._onUpdate = callback;
  }

  /**
   * Установить колбэк, вызываемый при нажатии кнопки использования предмета.
   */
  onUseItem(callback) {
    this._onUseItem = callback;
  }

  _fire() {
    if (this._onUpdate) this._onUpdate({ ...this.state });
  }

  _fireUseItem() {
    if (this._onUseItem) this._onUseItem();
  }

  _initKeyboard() {
    const map = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'backward', ArrowDown: 'backward',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      Space: 'brake'
    };

    document.addEventListener('keydown', (e) => {
      const key = map[e.code];
      if (key && !this.state[key]) {
        this.state[key] = true;
        this._fire();
      }
    });

    document.addEventListener('keyup', (e) => {
      const key = map[e.code];
      if (key && this.state[key]) {
        this.state[key] = false;
        this._fire();
      }
    });
  }

  _initMobile() {
    const btns = {
      'btn-gas': 'gas',
      'btn-brake': 'brake',
      'btn-left': 'left',
      'btn-right': 'right',
    };

    for (const [id, key] of Object.entries(btns)) {
      const el = document.getElementById(id);
      if (!el) continue;

      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._mobile[key] = true;
        this._syncMobile();
      }, { passive: false });

      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        this._mobile[key] = false;
        this._syncMobile();
      }, { passive: false });
    }

    // btn-reverse: reverse пока зажата, долгое нажатие (500ms) — использовать предмет
    const itemBtn = document.getElementById('btn-reverse');
    if (itemBtn) {
      let pressTimer = null;
      
      itemBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._mobile.reverse = true;
        this._syncMobile();
        pressTimer = window.setTimeout(() => {
          // Long press — use item
          this._mobile.useItemPressed = true;
          this._fireUseItem();
          pressTimer = null;
        }, 500);
      }, { passive: false });

      itemBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        this._mobile.reverse = false;
        this._mobile.useItemPressed = false;
        this._syncMobile();
      }, { passive: false });
      
      itemBtn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        this._mobile.reverse = false;
        this._mobile.useItemPressed = false;
        this._syncMobile();
      }, { passive: false });
    }
  }

  _syncMobile() {
    this.state.forward = this._mobile.gas;
    this.state.backward = this._mobile.reverse;
    this.state.left = this._mobile.left;
    this.state.right = this._mobile.right;
    this.state.brake = this._mobile.brake;
    this._fire();
  }
}
