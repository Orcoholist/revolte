/**
 * Единый ввод: клавиатура + мобильные тач-кнопки.
 */

export class InputManager {
  constructor() {
    this.state = { forward: false, backward: false, left: false, right: false, brake: false };
    this._mobile = { gas: false, brake: false, reverse: false, left: false, right: false };
    this._onUpdate = null; // колбэк при изменении

    this._initKeyboard();
    this._initMobile();
  }

  /**
   * Установить колбэк, вызываемый при любом изменении ввода.
   */
  onUpdate(callback) {
    this._onUpdate = callback;
  }

  _fire() {
    if (this._onUpdate) this._onUpdate({ ...this.state });
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
      'btn-reverse': 'reverse',
      'btn-left': 'left',
      'btn-right': 'right'
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
  }

  _syncMobile() {
    this.state.forward = this._mobile.gas;
    this.state.backward = false;
    this.state.left = this._mobile.left;
    this.state.right = this._mobile.right;
    this.state.brake = this._mobile.brake;
    this._fire();
  }
}
