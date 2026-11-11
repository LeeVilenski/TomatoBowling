import RAPIER from '@dimforge/rapier3d-compat';
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
  gutterPlates,
  pinSpots,
} from './dimensions';

export const PHYSICS_DT = 1 / 120;

const GUTTER_HALF = GUTTER_WIDTH / 2;
const PIN_FOOT = 0.018; // half-width of the square foot (fits inside the round base)
const PIN_FOOT_H = 0.004;
const LANE_FRICTION = 0.12; // oiled wood: the ball skids before it rolls
const PIN_FRICTION = 0.35;
const PIN_RESTITUTION = 0.45;
const BALL_RESTITUTION = 0.2;

// A pin counts as down once it tilts more than ~30° or drops off the deck.
const DOWN_TILT_COS = Math.cos((30 * Math.PI) / 180);

export interface ThrowParams {
  x: number; // start position across the lane
  angle: number; // radians, positive aims right
  speed: number; // m/s
}

export class BowlingPhysics {
  readonly world: RAPIER.World;
  readonly ball: RAPIER.RigidBody;
  readonly pins: RAPIER.RigidBody[] = [];
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
      this.world.createCollider(
        hull.setMass(PIN_MASS - 0.1).setFriction(PIN_FRICTION).setRestitution(PIN_RESTITUTION),
        body,
      );
      this.pins.push(body);
    }

    this.ball = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, BALL_RADIUS, -0.3)
        .setCcdEnabled(true)
        .setAngularDamping(0.05),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setMass(BALL_MASS)
        .setFriction(LANE_FRICTION)
        .setRestitution(BALL_RESTITUTION),
      this.ball,
    );
    this.holdBall(0);
  }

  static async create(): Promise<BowlingPhysics> {
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
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setRotation({ x: 0, y: 0, z: Math.sin(angleZ / 2), w: Math.cos(angleZ / 2) })
        .setFriction(friction)
        .setRestitution(0.1),
    );
  }

  private buildLane() {
    const thick = 0.2;
    // Approach + lane + pin deck: one surface from behind the foul line to the deck end.
    const laneLen = APPROACH_START_Z - DECK_END_Z;
    this.fixed(LANE_HALF, thick / 2, laneLen / 2, 0, -thick / 2, (APPROACH_START_Z + DECK_END_Z) / 2, LANE_FRICTION);
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
    this.ball.setTranslation({ x, y: BALL_RADIUS, z: -0.3 }, true);
    this.ball.setNextKinematicTranslation({ x, y: BALL_RADIUS, z: -0.3 });
    this.ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  throwBall({ x, angle, speed }: ThrowParams) {
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.ball.setTranslation({ x, y: BALL_RADIUS, z: -0.3 }, true);
    this.ball.setLinvel({ x: Math.sin(angle) * speed, y: 0, z: -Math.cos(angle) * speed }, true);
    this.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  resetPins() {
    this.pins.forEach((pin, i) => {
      const s = this.spots[i];
      pin.setTranslation({ x: s.x, y: 0, z: s.z }, true);
      pin.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      pin.setLinvel({ x: 0, y: 0, z: 0 }, true);
      pin.setAngvel({ x: 0, y: 0, z: 0 }, true);
      pin.setEnabled(true);
    });
  }

  step() {
    this.world.step();
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
    const slow = (b: RAPIER.RigidBody) => {
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
