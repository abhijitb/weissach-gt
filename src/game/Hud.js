import { Race } from './Race.js';

const MAP_SIZE = 190;
const MAP_PADDING = 12;

/**
 * DOM overlay: lap timing, speed, and a minimap drawn from the track spline.
 *
 * Text lives in DOM elements and is only written when the value actually
 * changes; only the minimap redraws every frame, and it is a couple of hundred
 * line segments on a small canvas.
 */
export class Hud {
  constructor(track, race) {
    this.track = track;
    this.race = race;
    this._cache = {};
    this._flashUntil = 0;

    this._build();
    this._projectTrack();
  }

  _build() {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class="hud__panel hud__timing">
        <div class="hud__row">
          <span class="hud__label">Lap</span>
          <span class="hud__value" data-hud="lap">--</span>
        </div>
        <div class="hud__row">
          <span class="hud__label">Current</span>
          <span class="hud__value hud__value--small" data-hud="current">--:--.---</span>
        </div>
        <div class="hud__row">
          <span class="hud__label">Best</span>
          <span class="hud__value hud__value--small" data-hud="best">--:--.---</span>
        </div>
      </div>
      <div class="hud__panel hud__speed">
        <span class="hud__label" data-hud="gear">Drive</span>
        <span><span class="hud__speed-value" data-hud="speed">0</span><span class="hud__unit">km/h</span></span>
      </div>
      <div class="hud__panel hud__minimap">
        <canvas width="${MAP_SIZE}" height="${MAP_SIZE}"></canvas>
      </div>
      <div class="hud__flash" data-hud="flash"></div>
    `;
    document.body.appendChild(root);

    this.root = root;
    this.el = {};
    for (const node of root.querySelectorAll('[data-hud]')) {
      this.el[node.dataset.hud] = node;
    }

    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /** Flatten the centreline to minimap pixels once, preserving aspect ratio. */
  _projectTrack() {
    const pts = this.track.points;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const span = Math.max(maxX - minX, maxZ - minZ) || 1;
    const usable = MAP_SIZE - MAP_PADDING * 2;
    this._map = {
      scale: usable / span,
      offsetX: MAP_PADDING + (usable - (maxX - minX) * (usable / span)) / 2,
      offsetY: MAP_PADDING + (usable - (maxZ - minZ) * (usable / span)) / 2,
      minX,
      minZ,
    };

    // Every 4th point is plenty at this size and keeps the redraw cheap.
    this._outline = [];
    for (let i = 0; i < pts.length; i += 4) {
      this._outline.push(this._toMap(pts[i]));
    }
  }

  _toMap(p) {
    const m = this._map;
    return {
      x: m.offsetX + (p.x - m.minX) * m.scale,
      y: m.offsetY + (p.z - m.minZ) * m.scale,
    };
  }

  onRaceEvent(event) {
    if (event.type === 'lap') {
      this._flash(`Lap ${Race.formatTime(event.lapTime)}`);
    } else if (event.type === 'finish') {
      this._flash(`Finish — best ${Race.formatTime(this.race.bestLapTime)}`);
    }
  }

  _flash(text) {
    this.el.flash.textContent = text;
    this.el.flash.classList.add('hud__flash--on');
    this._flashUntil = performance.now() + 2600;
  }

  update(car) {
    const race = this.race;

    this._set('lap', `${Math.min(race.lap || 1, race.totalLaps)} / ${race.totalLaps}`);
    this._set('current', Race.formatTime(race.started ? race.lapTime : 0));
    this._set('best', Race.formatTime(race.bestLapTime));
    this._set('speed', String(Math.round(car.speed * 3.6)));
    this._set('gear', car.isReversing ? 'Reverse' : 'Drive');

    if (this._flashUntil && performance.now() > this._flashUntil) {
      this.el.flash.classList.remove('hud__flash--on');
      this._flashUntil = 0;
    }

    this._drawMinimap(car);
  }

  _set(key, value) {
    if (this._cache[key] === value) return;
    this._cache[key] = value;
    this.el[key].textContent = value;
  }

  _drawMinimap(car) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Track outline
    ctx.beginPath();
    this._outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Start/finish tick
    const line = this._toMap(this.track.startLinePosition);
    ctx.fillStyle = '#ffcf3f';
    ctx.fillRect(line.x - 2.5, line.y - 2.5, 5, 5);

    // Car, pointing the way it is travelling
    const pos = this._toMap(car.mesh.position);
    const q = car.mesh.quaternion;
    // Yaw straight out of the quaternion — cheaper than building an Euler.
    const yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.x * q.x)
    );

    ctx.save();
    ctx.translate(pos.x, pos.y);
    // Screen +y is world +z, so the map is already in the right orientation.
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = '#e8323c';
    ctx.fill();
    ctx.restore();
  }

  dispose() {
    this.root.remove();
  }
}
