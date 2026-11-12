// How a computer bowler decides on a throw. It bowls through the same physics as the
// player, so it picks a target, works out the throw that would hit it by simulating it (on
// a pin-less world, like the practice aim helper), then adds human error from its stats.
// No graphics here, so the same code runs in the game and in the tuning harness.
import { HEAD_PIN_Z, MAX_AIM_ANGLE, MAX_START_X, MAX_THROW_SPEED, MIN_THROW_SPEED, PIN_SPACING } from './dimensions';
import type { ThrowParams } from './physics';

export interface BowlerStyle {
  /** Preferred speed (m/s). */
  speed: number;
  /** Side spin, -1 (hooks left) to 1 (hooks right). 0 bowls straight. */
  spin: number;
  /** Where they stand for a full rack (m from the middle, + is right). */
  startX: number;
}

/** How far off a bowler's throws land: standard deviations of the error on each part. */
export interface BowlerAccuracy {
  /** Aim angle error (radians). 0.005 rad is ~9 cm by the time the ball reaches the pins. */
  angle: number;
  /** Start position error (m). */
  x: number;
  /** Speed error (m/s). */
  speed: number;
  /** Spin error. */
  spin: number;
}

export interface BowlerSkill {
  style: BowlerStyle;
  accuracy: BowlerAccuracy;
  /** Extra error under pressure (10th frame, close match): 0.5 means up to 50% wobblier. */
  nerves: number;
  /** Error on spare balls relative to the first ball (0.6 = a spare specialist). Default 1. */
  spareError?: number;
}

/** Anything that can run a throw and say where the ball goes (BowlingPhysics.tracePath). */
export interface PathTracer {
  tracePath(t: ThrowParams, untilZ: number): { x: number; z: number }[];
}

/** Where to send the ball: a point it should cross on its way into the pins. */
export interface Target {
  x: number;
  z: number;
  /** A full rack (aiming for the pocket) rather than a spare. */
  fullRack: boolean;
}

/**
 * Strikes come from the "pocket": 6–9 cm off centre at the head pin, on the side the ball
 * hooks in from (found by simulating throws across the head pin; dead centre leaves splits).
 */
export const POCKET_X = 0.075;
/** Gaps wider than this between standing pins split a leave into separate groups. */
const SPLIT_GAP = PIN_SPACING * 1.2;

/** Picks where to aim, given the standing pins' positions. */
export function chooseTarget(standing: { x: number; z: number }[], skill: BowlerSkill): Target {
  if (standing.length >= 10 || standing.length === 0) {
    // Into the pocket on the side the ball hooks from (straight bowlers use the right one)
    const side = skill.style.spin > 0 ? -1 : 1;
    return { x: side * POCKET_X, z: HEAD_PIN_Z, fullRack: true };
  }
  // A spare: group the standing pins by how far apart they are across the lane, then go
  // for the biggest group (on a split, the side with more pins; ties go to the middle-most)
  const byX = [...standing].sort((a, b) => a.x - b.x);
  const groups: { x: number; z: number }[][] = [[byX[0]]];
  for (let i = 1; i < byX.length; i++) {
    if (byX[i].x - byX[i - 1].x > SPLIT_GAP) groups.push([]);
    groups[groups.length - 1].push(byX[i]);
  }
  const mean = (g: { x: number }[]) => g.reduce((a, p) => a + p.x, 0) / g.length;
  groups.sort((a, b) => b.length - a.length || Math.abs(mean(a)) - Math.abs(mean(b)));
  const group = groups[0];
  // Through the middle of the group, at its front pin
  return { x: mean(group), z: Math.max(...group.map((p) => p.z)), fullRack: false };
}

/** Where a traced path crosses `z` (or where it ended, if it never got there: a gutter ball). */
export function xAtZ(path: { x: number; z: number }[], z: number): number {
  for (let i = 1; i < path.length; i++) {
    if (path[i].z <= z) {
      const a = path[i - 1];
      const b = path[i];
      const f = a.z === b.z ? 0 : (a.z - z) / (a.z - b.z);
      return a.x + (b.x - a.x) * f;
    }
  }
  return path[path.length - 1]?.x ?? 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The throw the bowler would make if they were perfect: stand in the right place and find
 * the angle that sends the ball through the target, by simulating a few tries.
 */
export function planThrow(skill: BowlerSkill, target: Target, tracer: PathTracer): ThrowParams {
  const { style } = skill;
  let x: number;
  let spin: number;
  let speed: number;
  if (target.fullRack) {
    x = style.startX;
    spin = style.spin;
    speed = style.speed;
  } else {
    // Spares: from the opposite side of the lane, a little straighter and firmer
    x = clamp(-target.x * 1.4, -MAX_START_X * 0.85, MAX_START_X * 0.85);
    spin = style.spin * 0.3;
    speed = clamp(style.speed + 0.5, MIN_THROW_SPEED, MAX_THROW_SPEED);
  }
  const until = target.z - 0.05;
  const miss = (angle: number) => xAtZ(tracer.tracePath({ x, angle, speed, spin }, until), target.z) - target.x;

  // Start from the straight-line angle, then refine (the secant method) to allow for the
  // hook, keeping the best angle actually tried
  const lim = (v: number) => clamp(v, -MAX_AIM_ANGLE, MAX_AIM_ANGLE);
  let prevA = lim(Math.atan2(target.x - x, -0.3 - target.z));
  let prevM = miss(prevA);
  let best = { a: prevA, m: prevM };
  let a = lim(prevA + (prevM > 0 ? -0.004 : 0.004));
  for (let i = 0; i < 6 && Math.abs(best.m) > 0.003; i++) {
    const m = miss(a);
    if (Math.abs(m) < Math.abs(best.m)) best = { a, m };
    if (m === prevM) break;
    const next = lim(a - (m * (a - prevA)) / (m - prevM));
    prevA = a;
    prevM = m;
    a = next;
  }
  return { x, angle: best.a, speed, spin };
}

/** A normally distributed random number (mean 0, standard deviation 1). */
export function gaussian(random: () => number = Math.random): number {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/**
 * Adds the bowler's human error to a planned throw. `pressure` (0–1) is how tense the
 * moment is: the 10th frame, or a close match late on.
 */
export function humanise(
  skill: BowlerSkill,
  plan: ThrowParams,
  pressure: number,
  noise: () => number = gaussian,
  spare = false,
): ThrowParams {
  const k = (1 + skill.nerves * clamp(pressure, 0, 1)) * (spare ? (skill.spareError ?? 1) : 1);
  const a = skill.accuracy;
  return {
    x: clamp(plan.x + noise() * a.x * k, -MAX_START_X, MAX_START_X),
    angle: clamp(plan.angle + noise() * a.angle * k, -MAX_AIM_ANGLE, MAX_AIM_ANGLE),
    speed: clamp(plan.speed + noise() * a.speed * k, MIN_THROW_SPEED, MAX_THROW_SPEED),
    spin: clamp((plan.spin ?? 0) + noise() * a.spin * k, -1, 1),
  };
}

/**
 * How tense the next ball is, 0–1: the last frame is tense; so is a close match over the
 * last three frames. `frame` is 0-based; `frames` is the match length.
 */
export function pressureFor(frame: number, myTotal: number, theirTotal: number, frames = 10): number {
  let p = frame >= frames - 1 ? 0.6 : 0;
  if (frame >= frames - 3 && Math.abs(myTotal - theirTotal) <= 15) p += 0.4;
  return Math.min(1, p);
}
