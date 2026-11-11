import { describe, expect, it } from 'vitest';
import { analyzeSwipe, type SwipePoint } from './swipe';

const H = 800;

/** Build a swipe from a path function f(s) for s in 0..1, over `ms` milliseconds. */
function swipe(f: (s: number) => [number, number], ms: number, n = 20): SwipePoint[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const s = i / n;
    const [x, y] = f(s);
    return { x, y, t: s * ms };
  });
}

describe('analyzeSwipe', () => {
  it('ignores taps and short or downward swipes', () => {
    expect(analyzeSwipe([{ x: 0, y: 0, t: 0 }], H)).toBeNull();
    expect(analyzeSwipe(swipe((s) => [200, 600 - s * 40], 100), H)).toBeNull();
    expect(analyzeSwipe(swipe((s) => [200, 300 + s * 300], 200), H)).toBeNull();
  });

  it('a straight swipe up has no aim or spin', () => {
    const r = analyzeSwipe(swipe((s) => [200, 700 - s * 400], 250), H)!;
    expect(r.aim).toBeCloseTo(0);
    expect(r.spin).toBe(0);
  });

  it('a faster flick gives more power', () => {
    const slow = analyzeSwipe(swipe((s) => [200, 700 - s * 400], 600), H)!;
    const fast = analyzeSwipe(swipe((s) => [200, 700 - s * 400], 120), H)!;
    expect(fast.power).toBeGreaterThan(slow.power);
    expect(fast.power).toBe(1);
  });

  it('a slanted swipe aims that way', () => {
    const right = analyzeSwipe(swipe((s) => [200 + s * 100, 700 - s * 400], 250), H)!;
    const left = analyzeSwipe(swipe((s) => [200 - s * 100, 700 - s * 400], 250), H)!;
    expect(right.aim).toBeGreaterThan(0.2);
    expect(left.aim).toBeLessThan(-0.2);
    expect(right.spin).toBe(0);
  });

  it('a swipe that curves right at the end spins right', () => {
    const r = analyzeSwipe(swipe((s) => [200 + 150 * s * s, 700 - s * 400], 250), H)!;
    expect(r.spin).toBeGreaterThan(0.3);
    const l = analyzeSwipe(swipe((s) => [200 - 150 * s * s, 700 - s * 400], 250), H)!;
    expect(l.spin).toBeLessThan(-0.3);
  });
});
