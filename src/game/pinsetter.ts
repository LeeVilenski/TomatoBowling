import type * as THREE from 'three';
import { DECK_END_Z, HEAD_PIN_Z } from './dimensions';
import type { BowlingPhysics } from './physics';

// Timings (seconds) for the pinsetter cycle
const LIFT_END = 0.6;
const SWEEP_END = 1.4;
const LOWER_END = 2.1;

const LIFT_HEIGHT = 0.45;
const SWEEP_UP_Y = 0.85;
const SWEEP_DOWN_Y = 0.07;
const SWEEP_START_Z = HEAD_PIN_Z + 0.4;
const SWEEP_END_Z = DECK_END_Z - 0.05;

export type PinsetterMode =
  /** After the first ball: lift standing pins, sweep the rest, put the standing ones back. */
  | 'clear'
  /** After a strike or the second ball: sweep everything and set a fresh rack. */
  | 'rerack';

const ease = (t: number) => t * t * (3 - 2 * t);
const progress = (t: number, from: number, to: number) => ease(Math.min(1, Math.max(0, (t - from) / (to - from))));

/** Animates the sweep bar and moves pins the way a real pinsetter does. */
export class Pinsetter {
  private time = 0;
  private swept = false;
  private mode: PinsetterMode = 'clear';
  private held: { i: number; x: number; z: number }[] = [];
  private onDone: (() => void) | null = null;
  active = false;

  constructor(
    private physics: BowlingPhysics,
    private sweep: THREE.Object3D,
  ) {
    sweep.visible = false;
  }

  start(mode: PinsetterMode, onDone: () => void) {
    this.mode = mode;
    this.time = 0;
    this.swept = false;
    this.active = true;
    this.onDone = onDone;
    this.held = [];
    if (mode === 'clear') {
      for (let i = 0; i < this.physics.pins.length; i++) {
        if (!this.physics.isPinDown(i)) {
          const p = this.physics.pins[i].translation();
          this.held.push({ i, x: p.x, z: p.z });
        }
      }
    }
    this.sweep.visible = true;
  }

  /** Call once per physics step while active. */
  update(dt: number) {
    if (!this.active) return;
    this.time += dt;
    const t = this.time;

    // Sweep bar: drop down, push back through the deck, then rise
    const down = progress(t, 0, LIFT_END);
    const along = progress(t, LIFT_END, SWEEP_END);
    const up = progress(t, SWEEP_END, LOWER_END);
    const sweepZ = SWEEP_START_Z + (SWEEP_END_Z - SWEEP_START_Z) * along;
    this.sweep.position.set(0, SWEEP_UP_Y + (SWEEP_DOWN_Y - SWEEP_UP_Y) * (down - up), sweepZ);

    // Clear away every pin the bar passes that isn't being held up.
    // Once the bar reaches the back, anything left (e.g. pins in the pit) goes too.
    if (along > 0 && !this.swept) {
      const heldIds = new Set(this.held.map((h) => h.i));
      this.physics.pins.forEach((pin, i) => {
        if (heldIds.has(i) || this.physics.isPinRemoved(i)) return;
        if (pin.translation().z > sweepZ - 0.05 || along >= 1) this.physics.removePin(i);
      });
      if (along >= 1) this.swept = true;
    }

    if (this.mode === 'clear') {
      // Standing pins go up, wait above the sweep, then come back down where they were
      const h = LIFT_HEIGHT * (progress(t, 0, LIFT_END) - progress(t, SWEEP_END, LOWER_END));
      for (const p of this.held) this.physics.holdPin(p.i, p.x, h, p.z);
    } else if (t >= SWEEP_END) {
      // New rack lowers onto the spots
      const h = LIFT_HEIGHT * (1 - progress(t, SWEEP_END, LOWER_END));
      for (let i = 0; i < this.physics.pins.length; i++) {
        const s = this.physics.spot(i);
        this.physics.holdPin(i, s.x, h, s.z);
      }
    }

    if (t >= LOWER_END) {
      if (this.mode === 'clear') {
        for (const p of this.held) this.physics.placePin(p.i, p.x, 0, p.z);
      } else {
        this.physics.resetPins();
      }
      this.active = false;
      this.sweep.visible = false;
      this.onDone?.();
    }
  }
}
