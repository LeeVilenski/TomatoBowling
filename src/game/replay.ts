// Records a throw (ball and pin positions every physics step, plus moments like juice
// splashes) so it can be played back from the pinsetter camera. No DOM or Three.js here.
import { HEAD_PIN_Z, PHYSICS_DT } from './dimensions';

type V3 = { x: number; y: number; z: number };
type Q = { x: number; y: number; z: number; w: number };

export interface BodyLike {
  translation(): V3;
  rotation(): Q;
  isEnabled(): boolean;
}

/** Something that happened during the throw, replayed at the same moment. */
export type ReplayEvent =
  | { kind: 'hit'; at: V3; dir: V3; strength: number }
  | { kind: 'clack'; strength: number }
  | { kind: 'gutter' }
  | { kind: 'bump' };

const STRIDE = 8; // x, y, z, qx, qy, qz, qw, visible
const MAX_STEPS = 120 * 15; // 15 s of throw is plenty (a throw tops out around 10 s)
/** Slow motion around the first impact, from a little before it to a while after. */
const SLOW_RATE = 0.35;
const SLOW_BEFORE = 0.3;
const SLOW_AFTER = 1.3;
/** Keep playing this long (in throw time) after the ball reaches the pins. */
const TAIL = 2.6;

export class ReplayRecorder {
  private frames: Float32Array[] = [];
  private events: { step: number; event: ReplayEvent }[] = [];
  private firstHit: number | null = null;
  recording = false;

  start() {
    this.frames = [];
    this.events = [];
    this.firstHit = null;
    this.recording = true;
  }

  /** Call once per physics step while recording. Body 0 is the ball, then the pins. */
  capture(bodies: BodyLike[]) {
    if (!this.recording || this.frames.length >= MAX_STEPS) return;
    const f = new Float32Array(bodies.length * STRIDE);
    bodies.forEach((b, i) => {
      const p = b.translation();
      const q = b.rotation();
      f.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w, b.isEnabled() ? 1 : 0], i * STRIDE);
    });
    this.frames.push(f);
  }

  event(event: ReplayEvent) {
    if (!this.recording) return;
    const step = Math.max(0, this.frames.length - 1);
    if (event.kind === 'hit' && this.firstHit === null) this.firstHit = step;
    this.events.push({ step, event });
  }

  /** Stops recording; returns the replay, or null if nothing was captured. */
  stop(): Replay | null {
    this.recording = false;
    return this.frames.length > 1 ? new Replay(this.frames, this.events, this.firstHit) : null;
  }
}

export class Replay {
  /** Throw time (seconds) when the replay ends. */
  readonly end: number;
  /** Throw time of the first ball-on-pin hit, if there was one. */
  readonly hitTime: number | null;

  constructor(
    private frames: Float32Array[],
    private events: { step: number; event: ReplayEvent }[],
    firstHit: number | null,
  ) {
    const duration = (frames.length - 1) * PHYSICS_DT;
    this.hitTime = firstHit === null ? null : firstHit * PHYSICS_DT;
    // Without a hit (a gutter ball), stop a little after the ball gets to the end of the lane
    const arrive = this.hitTime ?? this.arrivalTime();
    this.end = Math.min(duration, arrive + TAIL);
  }

  get bodies() {
    return this.frames[0].length / STRIDE;
  }

  /** First time the ball passes the head pin's row (or the end of the recording). */
  private arrivalTime() {
    const i = this.frames.findIndex((f) => f[2] < HEAD_PIN_Z + 0.3);
    return (i === -1 ? this.frames.length - 1 : i) * PHYSICS_DT;
  }

  /** Playback speed at throw time `t`: slow motion around the moment of impact. */
  rateAt(t: number) {
    if (this.hitTime === null) return 1;
    return t > this.hitTime - SLOW_BEFORE && t < this.hitTime + SLOW_AFTER ? SLOW_RATE : 1;
  }

  /**
   * Body `i` at throw time `t`, interpolated between physics steps. Writes into `pos` and
   * `quat` and returns whether the body is visible.
   */
  sample(t: number, i: number, pos: V3, quat: Q): boolean {
    const s = Math.min(Math.max(t / PHYSICS_DT, 0), this.frames.length - 1);
    const i0 = Math.floor(s);
    const i1 = Math.min(i0 + 1, this.frames.length - 1);
    const k = s - i0;
    const a = this.frames[i0];
    const b = this.frames[i1];
    const o = i * STRIDE;
    pos.x = a[o] + (b[o] - a[o]) * k;
    pos.y = a[o + 1] + (b[o + 1] - a[o + 1]) * k;
    pos.z = a[o + 2] + (b[o + 2] - a[o + 2]) * k;
    nlerp(a, b, o + 3, k, quat);
    return a[o + 7] > 0;
  }

  /** Events that happen after throw time `from`, up to and including `to`. */
  eventsBetween(from: number, to: number): ReplayEvent[] {
    return this.events.filter((e) => e.step * PHYSICS_DT > from && e.step * PHYSICS_DT <= to).map((e) => e.event);
  }

  /** The ball's speed along the lane at throw time `t` (m/s), for the rolling sound. */
  ballSpeed(t: number) {
    const s = Math.min(Math.max(Math.floor(t / PHYSICS_DT), 0), this.frames.length - 2);
    const a = this.frames[s];
    const b = this.frames[s + 1];
    return Math.hypot(b[0] - a[0], b[2] - a[2]) / PHYSICS_DT;
  }
}

/** Blend two stored quaternions (normalised lerp, taking the short way round). */
function nlerp(a: Float32Array, b: Float32Array, o: number, k: number, out: Q) {
  const dot = a[o] * b[o] + a[o + 1] * b[o + 1] + a[o + 2] * b[o + 2] + a[o + 3] * b[o + 3];
  const sign = dot < 0 ? -1 : 1;
  const x = a[o] + (sign * b[o] - a[o]) * k;
  const y = a[o + 1] + (sign * b[o + 1] - a[o + 1]) * k;
  const z = a[o + 2] + (sign * b[o + 2] - a[o + 2]) * k;
  const w = a[o + 3] + (sign * b[o + 3] - a[o + 3]) * k;
  const len = Math.hypot(x, y, z, w) || 1;
  out.x = x / len;
  out.y = y / len;
  out.z = z / len;
  out.w = w / len;
}
