const KEY_MAP = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  cameraToggle: ['KeyC'],
  pause: ['Escape'],
};

export class Input {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(event) {
    if (!this.keys[event.code]) {
      this.justPressed[event.code] = true;
    }
    this.keys[event.code] = true;
    event.preventDefault();
  }

  _onKeyUp(event) {
    this.keys[event.code] = false;
    event.preventDefault();
  }

  update() {
    this.justPressed = {};
  }

  isDown(action) {
    const codes = KEY_MAP[action];
    if (!codes) return false;
    return codes.some((code) => !!this.keys[code]);
  }

  wasPressed(action) {
    const codes = KEY_MAP[action];
    if (!codes) return false;
    return codes.some((code) => !!this.justPressed[code]);
  }
}
