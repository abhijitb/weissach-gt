export class Game {
  constructor() {
    this.isRunning = false;
  }

  init() {
    this.isRunning = true;
    this.loop();
  }

  loop() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this.loop());
  }
}
