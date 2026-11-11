import type R from '@dimforge/rapier3d-compat';
import {
  APPROACH_START_Z,
  BALL_MASS,
  BALL_RADIUS,
  DECK_END_Z,
  GUTTER_WIDTH,
  LANE_HALF,
  OUTER_HALF,
  PIN_MASS,
  PIN_PROFILE,
  PIT_DEPTH,
  PIT_END_Z,
  PHYSICS_DT,
  gutterPlates,
  pinSpots,
} from './dimensions';

export { PHYSICS_DT };

const GUTTER_HALF = GUTTER_WIDTH / 2;
const PIN_FOOT = 0.018; // half-width of the square foot (fits inside the round base)
const PIN_FOOT_H = 0.004;
// Real lanes are oiled for the first ~12 m, so the ball skids there and then grips
// the dry back end. That grip is what turns spin into a late hook.
// The physics engine is loaded on demand (BowlingPhysics.create), so its download and
// compile can run alongside building the 3D scene. The web build swaps in the version that
// streams its WebAssembly as a separate file (see vite.config.ts).
let RAPIER: typeof R;

export const OIL_END_Z = -12.2;
const OIL_FRICTION = 0.03;
const DRY_FRICTION = 0.2;
const APPROACH_FRICTION = 0.3;
// Full spin = this many rad/s of side rotation (~160 rpm of axis rotation).
const MAX_SPIN = 17;
// Last point down the lane where the stem can make the ball hop. Late, big hops can sail
// right over the pins, and that's part of the fun.
const HOP_LAST_Z = -16.5;
const SPIN_SPEED_SCALING = 3;
const PIN_FRICTION = 0.35;
const PIN_RESTITUTION = 0.45;
const BALL_RESTITUTION = 0.2;

// A pin counts as down once it tilts more than ~30° or drops off the deck.
const DOWN_TILT_COS = Math.cos((30 * Math.PI) / 180);

export interface ThrowParams {
  x: number; // start position across the lane
  angle: number; // radians, positive aims right
  speed: number; // m/s
  spin?: number; // -1 (hooks left) to 1 (hooks right)
}

export class BowlingPhysics {
  readonly world: R.World;
  readonly ball: R.RigidBody;
  readonly pins: R.RigidBody[] = [];
  private ballCollider!: R.Collider;
  private lane!: R.Collider;
  ballRadius = BALL_RADIUS;
  /** Random source (swappable for tests). */
  rng: () => number = Math.random;
  /** The stem can catch the lane and make the ball hop (see stemCheck). */
  stemBumps = true;
  /** Set when a stem hop happens; the game reads and clears it to play a sound. */
  bumped = false;
  private bumpCount = 0;
  private stemWasDown = false;
  private throwSpeed = 8;
  private pinByCollider = new Map<number, number>();
  private readonly spots = pinSpots();

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = PHYSICS_DT;
    this.world.numSolverIterations = 8;

    this.buildLane();

    const hull = RAPIER.ColliderDesc.convexHull(pinHullPoints());
    if (!hull) throw new Error('Could not build pin collider');
    for (const spot of this.spots) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(spot.x, 0, spot.z),
      );
      // A flat square foot gives a solid 4-corner contact so pins stand up reliably.
      // The body shape starts just above the floor, so only the foot touches when upright.
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(PIN_FOOT, PIN_FOOT_H, PIN_FOOT)
          .setTranslation(0, PIN_FOOT_H, 0)
          .setMass(0.1)
          .setFriction(PIN_FRICTION)
          .setRestitution(PIN_RESTITUTION),
        body,
      );
      const foot = body.collider(0);
      const shell = this.world.createCollider(
        hull.setMass(PIN_MASS - 0.1).setFriction(PIN_FRICTION).setRestitution(PIN_RESTITUTION),
        body,
      );
      this.pinByCollider.set(foot.handle, this.pins.length);
      this.pinByCollider.set(shell.handle, this.pins.length);
      this.pins.push(body);
    }

    this.ball = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, BALL_RADIUS, -0.3)
        .setCcdEnabled(true)
        .setAngularDamping(0.05),
    );
    this.ballCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setMass(BALL_MASS)
        // Multiply wins over the default rule, so ball-on-surface friction is just the surface's value
        .setFriction(1)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
        .setRestitution(BALL_RESTITUTION),
      this.ball,
    );
    this.holdBall(0);
  }

  static async create(): Promise<BowlingPhysics> {
    RAPIER ??= (await import('@dimforge/rapier3d-compat')).default;
    await RAPIER.init();
    return new BowlingPhysics();
  }

  private fixed(
    hx: number,
    hy: number,
    hz: number,
    x: number,
    y: number,
    z: number,
    friction = 0.3,
    angleZ = 0,
  ) {
    return this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setRotation({ x: 0, y: 0, z: Math.sin(angleZ / 2), w: Math.cos(angleZ / 2) })
        .setFriction(friction)
        .setRestitution(0.1),
    );
  }

  private buildLane() {
    const thick = 0.2;
    // The approach, then the lane and pin deck as ONE continuous surface. (Two pieces end to
    // end leave a seam the ball can catch and bounce on.) The oil is handled in step(): the
    // lane's grip changes depending on where the ball is.
    this.fixed(LANE_HALF, thick / 2, APPROACH_START_Z / 2, 0, -thick / 2, APPROACH_START_Z / 2, APPROACH_FRICTION);
    this.lane = this.fixed(LANE_HALF, thick / 2, -DECK_END_Z / 2, 0, -thick / 2, DECK_END_Z / 2, OIL_FRICTION);
    // Approach is wider than the lane: fill in beside the gutters behind the foul line.
    for (const side of [-1, 1]) {
      this.fixed(GUTTER_HALF, thick / 2, APPROACH_START_Z / 2, side * (LANE_HALF + GUTTER_HALF), -thick / 2, APPROACH_START_Z / 2);
    }

    // Gutters, a little lower than the lane, running from the foul line into the pit.
    const gutterLen = -DECK_END_Z;
    for (const plate of gutterPlates()) {
      this.fixed(plate.halfWidth, 0.01, gutterLen / 2, plate.x, plate.y - 0.01, DECK_END_Z / 2, 0.3, plate.angle);
    }
    for (const side of [-1, 1]) {
      // Low outer lip along the lane
      this.fixed(0.02, 0.1, gutterLen / 2, side * (OUTER_HALF + 0.02), -0.05, DECK_END_Z / 2);
    }

    // Kickback walls beside the pin deck and pit.
    const kickStart = DECK_END_Z + 1.6;
    const kickLen = kickStart - PIT_END_Z;
    for (const side of [-1, 1]) {
      this.fixed(0.03, 0.8, kickLen / 2, side * (OUTER_HALF + 0.03), 0.05, (kickStart + PIT_END_Z) / 2);
    }

    // Pit floor and the back cushion.
    const pitLen = DECK_END_Z - PIT_END_Z;
    this.fixed(OUTER_HALF + 0.06, thick / 2, pitLen / 2, 0, -PIT_DEPTH - thick / 2, (DECK_END_Z + PIT_END_Z) / 2, 0.8);
    this.fixed(OUTER_HALF + 0.06, 0.6, 0.05, 0, 0, PIT_END_Z - 0.05, 0.8);
    // Front wall of the pit, under the end of the pin deck, so nothing rolls back under the lane
    // (kept below the gutters so gutter balls still drop into the pit)
    const wallTop = -0.22;
    this.fixed(OUTER_HALF + 0.06, (PIT_DEPTH + wallTop) / 2, 0.05, 0, (wallTop - PIT_DEPTH) / 2, DECK_END_Z + 0.05, 0.8);
  }

  /** Put the ball back on the approach, frozen, ready to throw. */
  holdBall(x: number) {
    this.ball.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.ball.setTranslation({ x, y: this.ballRadius, z: -0.3 }, true);
    this.ball.setNextKinematicTranslation({ x, y: this.ballRadius, z: -0.3 });
    this.ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  throwBall({ x, angle, speed, spin = 0 }: ThrowParams) {
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.ball.setTranslation({ x, y: this.ballRadius, z: -0.3 }, true);
    const dx = Math.sin(angle);
    const dz = -Math.cos(angle);
    this.ball.setLinvel({ x: dx * speed, y: 0, z: dz * speed }, true);
    // Side spin = rotation around the direction of travel. Once the ball reaches the
    // dry boards, friction turns it into sideways movement (positive spin hooks right).
    // Faster throws spend less time on the dry boards, so they get more revs to compensate.
    // That keeps full spin worth a similar, visible hook at any speed.
    const w = spin * MAX_SPIN * Math.pow(speed / 8, SPIN_SPEED_SCALING);
    this.ball.setAngvel({ x: dx * w, y: 0, z: dz * w }, true);

    // Leave the hand at a random angle: where the stem sits decides when (and whether) it
    // catches the lane on the way down. Mostly side-on to the roll, so it usually does.
    const phase = this.rng() * Math.PI * 2;
    const tilt = (this.rng() - 0.5) * 1.0;
    const q1 = { x: Math.sin(phase / 2), y: 0, z: 0, w: Math.cos(phase / 2) }; // spin about the rolling axis
    const q2 = { x: 0, y: 0, z: Math.sin(tilt / 2), w: Math.cos(tilt / 2) }; // lean the stem off-centre
    this.ball.setRotation(mulQuat(q2, q1), true);
    this.throwSpeed = speed;
    this.bumped = false;
    this.bumpCount = 0;
  }

  /** Put every pin back on its spot, upright. */
  resetPins() {
    this.pins.forEach((_, i) => {
      const s = this.spots[i];
      this.placePin(i, s.x, 0, s.z);
    });
  }

  spot(i: number) {
    return this.spots[i];
  }

  /** Teleport a pin upright to a position, as a normal physics pin. */
  placePin(i: number, x: number, y: number, z: number) {
    const pin = this.pins[i];
    pin.setEnabled(true);
    pin.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    pin.setTranslation({ x, y, z }, true);
    pin.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    pin.setLinvel({ x: 0, y: 0, z: 0 }, true);
    pin.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Hold a pin in the pinsetter: it follows the given position and ignores gravity. */
  holdPin(i: number, x: number, y: number, z: number) {
    const pin = this.pins[i];
    pin.setEnabled(true);
    if (pin.bodyType() !== RAPIER.RigidBodyType.KinematicPositionBased) {
      pin.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      pin.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      pin.setTranslation({ x, y, z }, true);
    }
    pin.setNextKinematicTranslation({ x, y, z });
  }

  /** Take a pin off the lane entirely (swept away). */
  removePin(i: number) {
    this.pins[i].setEnabled(false);
  }

  isPinRemoved(i: number) {
    return !this.pins[i].isEnabled();
  }

  step() {
    // Oily front of the lane, dry back end: the ball skids, then grips and hooks
    this.lane.setFriction(this.ball.translation().z > OIL_END_Z ? OIL_FRICTION : DRY_FRICTION);
    if (this.stemBumps) this.stemCheck();
    this.world.step();
  }

  /**
   * The tomato isn't a perfect sphere: when its stem rolls round to the bottom it can catch
   * the lane and give the ball a little hop. At most once per throw, at a random moment.
   */
  private stemCheck() {
    if (this.bumpCount > 0 || this.ball.bodyType() !== RAPIER.RigidBodyType.Dynamic) return;
    const p = this.ball.translation();
    // Anywhere from 3 m out until just before the pins
    const onLane = p.y < this.ballRadius + 0.004 && Math.abs(p.x) < LANE_HALF - this.ballRadius && p.z < -3 && p.z > HOP_LAST_Z;
    if (!onLane) return;
    // Y component of the ball's local "up" (where the stem points)
    const q = this.ball.rotation();
    const stemY = 1 - 2 * (q.x * q.x + q.z * q.z);
    const down = stemY < -0.9;
    if (down && !this.stemWasDown && this.rng() < 0.4) {
      const v = this.ball.linvel();
      const scale = Math.min(1.3, Math.max(0.5, this.throwSpeed / 8));
      const up = (1.7 + this.rng() * 1.5) * scale; // ~15–50 cm hop at a normal speed (it's a tomato!)
      const side = (this.rng() - 0.5) * 0.16;
      this.ball.setLinvel({ x: v.x + side, y: v.y + up, z: v.z }, true);
      this.bumpCount++;
      this.bumped = true;
    }
    this.stemWasDown = down;
  }

  /**
   * Runs a throw and records where the ball goes, until it passes `untilZ` or drops into a
   * gutter. Used on a separate, pin-less world to preview a throw's path for practice.
   * Returns ball positions every `every` steps, then puts the ball back.
   */
  tracePath(t: ThrowParams, untilZ: number, every = 4, maxSteps = 1500): { x: number; z: number }[] {
    const bumps = this.stemBumps;
    this.stemBumps = false;
    this.throwBall(t);
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < maxSteps; i++) {
      this.step();
      if (i % every !== 0) continue;
      const p = this.ball.translation();
      pts.push({ x: p.x, z: p.z });
      if (p.z < untilZ || p.y < this.ballRadius - 0.05) break;
    }
    this.stemBumps = bumps;
    this.holdBall(t.x);
    return pts;
  }

  /** Swap to a different-sized ball (same weight), e.g. the cherry tomato. */
  setBallRadius(r: number) {
    this.ballRadius = r;
    this.ballCollider.setRadius(r);
    this.ballCollider.setMass(BALL_MASS);
  }

  /** Pin indices (0–9) the ball is touching right now. */
  ballPinContacts(): number[] {
    const out: number[] = [];
    this.world.contactPairsWith(this.ballCollider, (other) => {
      const pin = this.pinByCollider.get(other.handle);
      if (pin === undefined || out.includes(pin)) return;
      this.world.contactPair(this.ballCollider, other, (manifold) => {
        if (manifold.numContacts() > 0 && !out.includes(pin)) out.push(pin);
      });
    });
    return out;
  }

  /** Pin numbers (1–10) still standing. */
  standingPins(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.pins.length; i++) if (!this.isPinDown(i)) out.push(i + 1);
    return out;
  }

  isPinDown(i: number): boolean {
    const pin = this.pins[i];
    if (!pin.isEnabled()) return true;
    const p = pin.translation();
    if (p.y < -0.05 || p.z < DECK_END_Z || Math.abs(p.x) > LANE_HALF + 0.05) return true;
    const q = pin.rotation();
    // Y component of the pin's up axis after rotation
    const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
    return upY < DOWN_TILT_COS;
  }

  pinsDown(): number {
    let n = 0;
    for (let i = 0; i < this.pins.length; i++) if (this.isPinDown(i)) n++;
    return n;
  }

  /** True once nothing is moving fast enough to change the result. */
  isSettled(): boolean {
    const slow = (b: R.RigidBody) => {
      const v = b.linvel();
      const w = b.angvel();
      return v.x * v.x + v.y * v.y + v.z * v.z < 0.01 && w.x * w.x + w.y * w.y + w.z * w.z < 0.05;
    };
    return this.pins.every((p) => !p.isEnabled() || slow(p));
  }
}

/** Points around the pin outline, used for the pin's convex collision shape. */
function pinHullPoints(): Float32Array {
  const segments = 12;
  const pts: number[] = [];
  for (const [r, y0] of PIN_PROFILE) {
    if (r === 0) continue;
    let y = y0;
    // Lift the base ring slightly so the foot, not the hull, rests on the floor
    if (y < PIN_FOOT_H * 2.5) y = PIN_FOOT_H * 2.5;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      pts.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  return new Float32Array(pts);
}

type Quat = { x: number; y: number; z: number; w: number };
function mulQuat(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}
