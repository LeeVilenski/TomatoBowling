import { describe, expect, it } from 'vitest';
import { PHYSICS_DT } from './dimensions';
import { ReplayRecorder, type BodyLike } from './replay';

/** A body that moves down the lane at `speed` m/s, one physics step at a time. */
function body(speed: number) {
  let z = 0;
  let enabled = true;
  const b: BodyLike & { step(): void; hide(): void } = {
    translation: () => ({ x: 0.1, y: 0.1, z }),
    rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
    isEnabled: () => enabled,
    step: () => (z -= speed * PHYSICS_DT),
    hide: () => (enabled = false),
  };
  return b;
}

function record(steps: number, hitAt: number | null, speed = 8) {
  const ball = body(speed);
  const pin = body(0);
  const rec = new ReplayRecorder();
  rec.start();
  for (let i = 0; i < steps; i++) {
    rec.capture([ball, pin]);
    if (i === hitAt) {
      rec.event({ kind: 'hit', at: { x: 0, y: 0.1, z: -18 }, dir: { x: 0, y: 0, z: -1 }, strength: 1 });
      pin.hide();
    }
    ball.step();
  }
  return rec.stop()!;
}

describe('replay', () => {
  it('interpolates positions between physics steps', () => {
    const r = record(100, null);
    const pos = { x: 0, y: 0, z: 0 };
    const q = { x: 0, y: 0, z: 0, w: 0 };
    r.sample(10.5 * PHYSICS_DT, 0, pos, q);
    expect(pos.z).toBeCloseTo(-8 * 10.5 * PHYSICS_DT, 5);
    expect(q.w).toBeCloseTo(1);
    expect(r.ballSpeed(PHYSICS_DT * 5)).toBeCloseTo(8, 3);
  });

  it('plays events at the moment they happened, and tracks visibility', () => {
    const r = record(600, 300);
    expect(r.hitTime).toBeCloseTo(300 * PHYSICS_DT);
    expect(r.eventsBetween(0, 299 * PHYSICS_DT)).toHaveLength(0);
    expect(r.eventsBetween(299 * PHYSICS_DT, 300 * PHYSICS_DT).map((e) => e.kind)).toEqual(['hit']);
    const p = { x: 0, y: 0, z: 0 };
    const q = { x: 0, y: 0, z: 0, w: 1 };
    expect(r.sample(100 * PHYSICS_DT, 1, p, q)).toBe(true);
    expect(r.sample(400 * PHYSICS_DT, 1, p, q)).toBe(false);
  });

  it('slows down around the impact and ends a while after it', () => {
    const r = record(1200, 300);
    const hit = 300 * PHYSICS_DT;
    expect(r.rateAt(0.5)).toBe(1);
    expect(r.rateAt(hit)).toBeLessThan(1);
    expect(r.rateAt(hit + 2)).toBe(1);
    expect(r.end).toBeGreaterThan(hit + 1);
    expect(r.end).toBeLessThan(1200 * PHYSICS_DT);
  });

  it('plays a gutter ball at normal speed and stops once the ball reaches the pins', () => {
    const r = record(1200, null, 8);
    expect(r.hitTime).toBeNull();
    expect(r.rateAt(2)).toBe(1);
    expect(r.end).toBeLessThan((18.29 / 8) + 3);
  });

  it('records nothing unless started', () => {
    const rec = new ReplayRecorder();
    rec.capture([body(1)]);
    expect(rec.stop()).toBeNull();
  });
});
