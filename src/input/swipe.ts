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
const FULL_AIM_ANGLE = 0.6; // radians of on-screen swipe angle = full aim
const FULL_SPIN_TURN = 0.5; // radians of curve between start and end of swipe = full spin
const SPIN_DEAD_ZONE = 0.08; // ignore tiny wobbles so straight swipes stay straight

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** On-screen direction between two points: 0 = straight up, positive = leaning right. */
function direction(a: SwipePoint, b: SwipePoint) {
  return Math.atan2(b.x - a.x, a.y - b.y);
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

  // Aim from the overall direction of the swipe
  const aim = clamp(direction(first, last) / FULL_AIM_ANGLE, -1, 1);

  // Spin from how much the swipe curves: compare the first and last thirds
  const third = Math.max(1, Math.floor(points.length / 3));
  const startDir = direction(first, points[third]);
  const endDir = direction(points[points.length - 1 - third], last);
  let turn = endDir - startDir;
  if (Math.abs(turn) < SPIN_DEAD_ZONE) turn = 0;
  else turn -= Math.sign(turn) * SPIN_DEAD_ZONE;
  const spin = clamp(turn / FULL_SPIN_TURN, -1, 1);

  return { power, aim, spin };
}
