// Turns a touch swipe into a throw. Kept free of DOM code so it can be unit tested.

export interface SwipePoint {
  x: number;
  y: number;
  t: number; // ms
}

export interface SwipeThrow {
  power: number; // 0–1
  aim: number; // -1 (full left) to 1 (full right)
  spin: number; // -1 (hooks left) to 1 (hooks right)
}

const MIN_UP_FRACTION = 0.12; // swipe must travel at least 12% of the screen height upward
const SPEED_WINDOW_MS = 150; // flick speed is measured over the last part of the swipe
const SLOW_FLICK = 1.0; // screen heights per second = power 0
const FAST_FLICK = 4.0; // screen heights per second = power 1
const FULL_AIM_ANGLE = 0.9; // radians (~50°) of on-screen swipe angle = full aim
const AIM_DEAD_ZONE = 0.06; // a swipe within ~3° of straight up throws straight
const FULL_SPIN_TURN = 0.45; // radians of curve between start and end of swipe = full spin
const SPIN_DEAD_ZONE = 0.06; // ignore tiny wobbles so straight swipes stay straight
const START_FRACTION = 0.35; // aim comes from the first 35% of the swipe

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** On-screen direction between two points: 0 = straight up, positive = leaning right. */
function direction(a: SwipePoint, b: SwipePoint) {
  return Math.atan2(b.x - a.x, a.y - b.y);
}

/** Shrink a value towards zero, so small values become exactly 0. */
function deadZone(v: number, zone: number) {
  return Math.abs(v) < zone ? 0 : v - Math.sign(v) * zone;
}

/** Index of the point that is `fraction` of the way along the swipe's upward travel. */
function indexAtFraction(points: SwipePoint[], fraction: number) {
  const startY = points[0].y;
  const target = startY - (startY - points[points.length - 1].y) * fraction;
  for (let i = 1; i < points.length - 1; i++) if (points[i].y <= target) return i;
  return Math.max(1, points.length - 2);
}

export function analyzeSwipe(points: SwipePoint[], viewHeight: number): SwipeThrow | null {
  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const up = first.y - last.y;
  if (up < viewHeight * MIN_UP_FRACTION) return null;

  // Power from how fast the finger was moving at the end of the swipe
  let start = points.length - 1;
  while (start > 0 && last.t - points[start - 1].t <= SPEED_WINDOW_MS) start--;
  if (start === points.length - 1) start = Math.max(0, start - 1);
  const p = points[start];
  const dt = Math.max(1, last.t - p.t) / 1000;
  const flick = (p.y - last.y) / dt / viewHeight;
  const power = clamp((flick - SLOW_FLICK) / (FAST_FLICK - SLOW_FLICK), 0, 1);

  // Aim from the direction the swipe *starts* in, so curving it adds spin
  // without also pulling the aim off to the side.
  const startIdx = indexAtFraction(points, START_FRACTION);
  const startDir = direction(first, points[startIdx]);
  const aim = clamp(deadZone(startDir, AIM_DEAD_ZONE) / FULL_AIM_ANGLE, -1, 1);

  // Spin from how much the swipe bends: start direction vs end direction
  const endIdx = indexAtFraction(points, 1 - START_FRACTION);
  const endDir = direction(points[endIdx], last);
  const spin = clamp(deadZone(endDir - startDir, SPIN_DEAD_ZONE) / FULL_SPIN_TURN, -1, 1);

  return { power, aim, spin };
}
