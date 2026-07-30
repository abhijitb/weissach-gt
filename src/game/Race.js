/**
 * Lap timing and checkpoints.
 *
 * Validation is based on signed progress along the track spline rather than on
 * start/finish line crossings. Progress accumulates as the car moves forward
 * and decrements when it reverses, so a lap only completes after a full
 * circuit's worth of forward travel — reversing back and forth over the line
 * can never bank one. Checkpoints ride on top of that for sector timing and to
 * give the HUD something to show.
 */

const DEFAULT_CHECKPOINTS = 12;

export class Race {
  constructor(track, { checkpoints = DEFAULT_CHECKPOINTS, totalLaps } = {}) {
    this.track = track;
    this.totalLaps = totalLaps || track.data.laps || 3;
    this.checkpointCount = checkpoints;

    this.checkpoints = [];
    for (let i = 0; i < checkpoints; i++) {
      const t = i / checkpoints;
      this.checkpoints.push({
        index: i,
        t,
        position: track.curve.getPointAt(t),
      });
    }

    this.reset();
  }

  reset(carPosition) {
    this.lastT = carPosition ? this._nearestT(carPosition, true) : 0;
    // Express the grid slot as a small negative offset, so the first crossing
    // of the line starts lap 1 rather than completing it.
    this.progress = this.lastT > 0.5 ? this.lastT - 1 : this.lastT;

    this.started = false;
    this.finished = false;
    this.lap = 0;
    this.lapStartProgress = 0;
    this.lapTime = 0;
    this.lastLapTime = null;
    this.bestLapTime = null;
    this.lapTimes = [];
    this.checkpointsPassed = 0;
    this.totalTime = 0;
  }

  /**
   * Put the driver back at the line for another run at the current lap. The
   * lap clock and progress restart, but lap number and best time survive — a
   * spin should cost you the lap, not the session.
   */
  restartLap(carPosition) {
    if (!this.started || this.finished) {
      this.reset(carPosition);
      return;
    }
    this.lastT = this._nearestT(carPosition, true);
    const offset = this.lastT > 0.5 ? this.lastT - 1 : this.lastT;
    this.progress = this.lapStartProgress + offset;
    this.lapTime = 0;
    this.checkpointsPassed = 0;
  }

  /** Fraction of the current lap completed, 0..1. */
  get lapFraction() {
    if (!this.started) return 0;
    return Math.min(Math.max(this.progress - this.lapStartProgress, 0), 1);
  }

  /**
   * Advance timing. Returns an event describing anything notable this step:
   * { type: 'start' | 'lap' | 'finish' } or null.
   */
  update(dt, carPosition) {
    if (this.finished) return null;

    const t = this._nearestT(carPosition);

    // Unwrap the step so crossing t=1 -> t=0 reads as forward motion, not as a
    // jump backwards around the whole circuit.
    let delta = t - this.lastT;
    if (delta > 0.5) delta -= 1;
    else if (delta < -0.5) delta += 1;

    this.progress += delta;
    this.lastT = t;

    if (!this.started) {
      if (this.progress < 0) return null;
      this.started = true;
      this.lap = 1;
      this.lapStartProgress = 0;
      this.lapTime = 0;
      return { type: 'start' };
    }

    this.lapTime += dt;
    this.totalTime += dt;
    this.checkpointsPassed = Math.min(
      Math.floor(this.lapFraction * this.checkpointCount),
      this.checkpointCount
    );

    if (this.progress < this.lapStartProgress + 1) return null;

    // A full circuit of forward travel — bank the lap.
    const completed = this.lapTime;
    this.lapTimes.push(completed);
    this.lastLapTime = completed;
    if (this.bestLapTime === null || completed < this.bestLapTime) {
      this.bestLapTime = completed;
    }

    this.lapStartProgress += 1;
    this.lapTime = 0;
    this.checkpointsPassed = 0;

    if (this.lap >= this.totalLaps) {
      this.finished = true;
      return { type: 'finish', lapTime: completed };
    }

    this.lap += 1;
    return { type: 'lap', lapTime: completed };
  }

  /**
   * Nearest point on the centreline, as a curve parameter. Searches a window
   * around the last known position — cheaper, and it stops the car snapping to
   * a different part of the circuit where the track doubles back near itself.
   */
  _nearestT(position, full = false) {
    const pts = this.track.points;
    const spans = pts.length - 1;
    const centre = Math.round(this.lastT * spans);
    const window = full ? spans : 70;

    let bestIndex = 0;
    let bestDist = Infinity;

    for (let k = -window; k <= window; k++) {
      const i = ((centre + k) % spans + spans) % spans;
      const dx = position.x - pts[i].x;
      const dz = position.z - pts[i].z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }

    return bestIndex / spans;
  }

  static formatTime(seconds) {
    if (seconds === null || seconds === undefined) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
}
