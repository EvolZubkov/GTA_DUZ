export class GameLoop {
  constructor({ update, render, clock, maxDelta = 0.05 }) {
    this.update = update;
    this.render = render;
    this.clock = clock;
    this.maxDelta = maxDelta;
    this.running = false;
    this.frameId = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
  }

  tick = () => {
    if (!this.running) return;

    const dt = Math.min(this.clock.getDelta(), this.maxDelta);
    this.update(dt);
    this.render();

    this.frameId = requestAnimationFrame(this.tick);
  };
}