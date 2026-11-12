import { describe, expect, it } from 'vitest';
import { chooseTarget, humanise, planThrow, POCKET_X, pressureFor, xAtZ, type BowlerSkill, type PathTracer } from './ai';
import { HEAD_PIN_Z, MAX_AIM_ANGLE, pinSpots } from './dimensions';

const straight: BowlerSkill = {
  style: { speed: 7, spin: 0, startX: 0.06 },
  accuracy: { angle: 0.004, x: 0.02, speed: 0.3, spin: 0.05 },
  nerves: 0.5,
};
const hooker: BowlerSkill = { ...straight, style: { speed: 8, spin: -0.6, startX: 0.3 } };

/** A stand-in for the physics: straight lines, plus a late curve for spin (like the real hook). */
const fakeLane: PathTracer = {
  tracePath(t, untilZ) {
    const pts = [];
    for (let z = -0.3; z >= untilZ - 0.1; z -= 0.25) {
      const d = -0.3 - z;
      pts.push({ x: t.x + Math.tan(t.angle) * d + (t.spin ?? 0) * 0.35 * (d / 18) ** 3, z });
    }
    return pts;
  },
};

const spots = pinSpots(); // index 0 is pin 1
const pins = (...numbers: number[]) => numbers.map((n) => spots[n - 1]);

describe('chooseTarget', () => {
  it('aims for the pocket on the side the ball hooks in from', () => {
    expect(chooseTarget(spots, straight)).toEqual({ x: POCKET_X, z: HEAD_PIN_Z, fullRack: true });
    expect(chooseTarget(spots, hooker).x).toBe(POCKET_X);
    const rightHook = { ...straight, style: { ...straight.style, spin: 0.5 } };
    expect(chooseTarget(spots, rightHook).x).toBe(-POCKET_X);
  });

  it('goes straight at a single pin', () => {
    const t = chooseTarget(pins(10), straight);
    expect(t.fullRack).toBe(false);
    expect(t.x).toBeCloseTo(spots[9].x);
  });

  it('on a split, goes for the side with more pins', () => {
    const t = chooseTarget(pins(4, 7, 10), straight);
    expect(t.x).toBeLessThan(0); // the 4-7 side
    expect(t.z).toBeCloseTo(spots[3].z); // through its front pin
  });

  it('treats a cluster like the bucket as one target', () => {
    const t = chooseTarget(pins(2, 4, 5, 8), straight);
    expect(t.x).toBeCloseTo((spots[1].x + spots[3].x + spots[4].x + spots[7].x) / 4);
  });
});

describe('planThrow', () => {
  it('finds the angle that sends a hook through the target', () => {
    const target = chooseTarget(spots, hooker);
    const t = planThrow(hooker, target, fakeLane);
    expect(Math.abs(t.angle)).toBeLessThanOrEqual(MAX_AIM_ANGLE);
    expect(xAtZ(fakeLane.tracePath(t, target.z - 0.1), target.z)).toBeCloseTo(target.x, 2);
  });

  it('shoots spares from the opposite side of the lane', () => {
    const target = chooseTarget(pins(10), straight);
    const t = planThrow(straight, target, fakeLane);
    expect(t.x).toBeLessThan(0);
    expect(xAtZ(fakeLane.tracePath(t, target.z - 0.1), target.z)).toBeCloseTo(target.x, 2);
  });
});

describe('humanise', () => {
  const plan = { x: 0.1, angle: 0.01, speed: 7, spin: -0.3 };

  it('is exact with no error, and wobblier under pressure', () => {
    expect(humanise(straight, plan, 1, () => 0)).toEqual(plan);
    const calm = humanise(straight, plan, 0, () => 1);
    const tense = humanise(straight, plan, 1, () => 1);
    expect(calm.angle - plan.angle).toBeCloseTo(straight.accuracy.angle);
    expect(tense.angle - plan.angle).toBeCloseTo(straight.accuracy.angle * 1.5);
  });

  it('lets spare specialists be sharper on spares', () => {
    const specialist = { ...straight, spareError: 0.5 };
    const first = humanise(specialist, plan, 0, () => 1);
    const spare = humanise(specialist, plan, 0, () => 1, true);
    expect(spare.angle - plan.angle).toBeCloseTo((first.angle - plan.angle) / 2);
  });

  it('keeps throws within the same limits as the player', () => {
    const wild = humanise(straight, plan, 1, () => 100);
    expect(wild.angle).toBeLessThanOrEqual(MAX_AIM_ANGLE);
    expect(wild.spin).toBeLessThanOrEqual(1);
  });
});

describe('pressureFor', () => {
  it('is calm early, tense in the 10th and in close finishes', () => {
    expect(pressureFor(2, 40, 41)).toBe(0);
    expect(pressureFor(7, 120, 60)).toBe(0);
    expect(pressureFor(7, 120, 110)).toBeCloseTo(0.4);
    expect(pressureFor(9, 150, 152)).toBe(1);
  });
});
