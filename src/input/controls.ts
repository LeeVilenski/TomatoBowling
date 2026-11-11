import { analyzeSwipe, swipeStartDirection, type SwipePoint, type SwipeThrow } from './swipe';

/** What the input layer can ask the game to do. */
export interface ControlTarget {
  canAim(): boolean;
  isCharging(): boolean;
  /** Move along the foul line by a fraction of the full range (-1..1 spans the lane). */
  moveBy(delta: number): void;
  /** Set position directly, -1 (far left) to 1 (far right). */
  setPosition(v: number): void;
  nudgeAim(delta: number): void;
  nudgeSpin(delta: number): void;
  startCharge(): void;
  releaseCharge(): void;
  cancelCharge(): void;
  swipeThrow(t: SwipeThrow): void;
  /** Live aim preview while a swipe is in progress (on-screen direction in radians). */
  swipePreview(direction: number): void;
  /** Skip the wait after a throw. */
  advance(): void;
  rerack(): void;
}

const DRAG_DECIDE_PX = 12;

/**
 * Touch/pen: drag sideways to move, swipe up to throw (curve the swipe for spin).
 * Mouse: move to set position, wheel to aim, hold the button to charge power, release to throw.
 * Keyboard: arrows move, A/D aim, Q/E spin, hold Space to charge.
 */
export function attachControls(canvas: HTMLCanvasElement, trail: HTMLCanvasElement, game: ControlTarget) {
  const tctx = trail.getContext('2d')!;
  let touch: { id: number; mode: 'undecided' | 'move' | 'swipe'; lastX: number; points: SwipePoint[] } | null = null;
  let trailFade = 0;
  let trailPoints: SwipePoint[] = [];

  function resizeTrail() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    trail.width = window.innerWidth * dpr;
    trail.height = window.innerHeight * dpr;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeTrail);
  resizeTrail();

  function drawTrail() {
    tctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (trailPoints.length < 2 || trailFade <= 0) return;
    tctx.lineCap = 'round';
    tctx.lineJoin = 'round';
    for (let i = 1; i < trailPoints.length; i++) {
      const a = trailPoints[i - 1];
      const b = trailPoints[i];
      const k = i / trailPoints.length;
      tctx.strokeStyle = `rgba(255, 90, 60, ${0.85 * k * trailFade})`;
      tctx.lineWidth = 4 + 10 * k;
      tctx.beginPath();
      tctx.moveTo(a.x, a.y);
      tctx.lineTo(b.x, b.y);
      tctx.stroke();
    }
  }

  // ---- Touch and pen ----
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0 && game.canAim()) game.startCharge();
      else if (e.button === 0) game.advance();
      else if (e.button === 2) game.cancelCharge();
      return;
    }
    if (touch) return;
    if (!game.canAim()) {
      game.advance();
      return;
    }
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture is only a nicety (keeps the swipe if the finger leaves the canvas)
    }
    touch = { id: e.pointerId, mode: 'undecided', lastX: e.clientX, points: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    trailPoints = touch.points;
    trailFade = 1;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      if (game.canAim() && !game.isCharging()) {
        // Middle 70% of the screen spans the full width of the approach
        game.setPosition((e.clientX / window.innerWidth - 0.5) / 0.35);
      }
      return;
    }
    if (!touch || e.pointerId !== touch.id) return;
    // Phones often bundle several touch samples into one event; use them all for a smoother path
    const samples = e.getCoalescedEvents?.() ?? [];
    const pts = (samples.length ? samples : [e]).map((ev) => ({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp }));
    const pt = pts[pts.length - 1];
    if (touch.mode === 'undecided') {
      const start = touch.points[0];
      const dx = pt.x - start.x;
      const dy = pt.y - start.y;
      if (Math.hypot(dx, dy) > DRAG_DECIDE_PX) {
        touch.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'move' : 'swipe';
        if (touch.mode === 'move') trailPoints = [];
      }
    }
    if (touch.mode === 'move') {
      game.moveBy(((pt.x - touch.lastX) / window.innerWidth) * 2.4);
      touch.lastX = pt.x;
    } else {
      touch.points.push(...pts);
      const up = touch.points[0].y - pt.y;
      if (touch.mode === 'swipe' && up > 30) game.swipePreview(swipeStartDirection(touch.points));
    }
  });

  const endTouch = (e: PointerEvent, cancelled: boolean) => {
    if (!touch || e.pointerId !== touch.id) return;
    if (!cancelled && touch.mode !== 'move' && game.canAim()) {
      touch.points.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      const result = analyzeSwipe(touch.points, window.innerHeight);
      if (result) game.swipeThrow(result);
    }
    touch = null;
  };
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    endTouch(e, false);
  });
  canvas.addEventListener('pointercancel', (e) => endTouch(e, true));

  // Mouse release anywhere throws (so leaving the canvas mid-charge still works)
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0 && game.isCharging()) game.releaseCharge();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (game.canAim()) game.nudgeAim(-Math.sign(e.deltaY) * 0.05);
    },
    { passive: false },
  );

  // ---- Keyboard ----
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const first = !held.has(k);
    held.add(k);
    switch (k) {
      case 'ArrowLeft':
        game.moveBy(-0.05);
        break;
      case 'ArrowRight':
        game.moveBy(0.05);
        break;
      case 'a':
        game.nudgeAim(-0.05);
        break;
      case 'd':
        game.nudgeAim(0.05);
        break;
      case 'q':
        game.nudgeSpin(-0.1);
        break;
      case 'e':
        game.nudgeSpin(0.1);
        break;
      case ' ':
      case 'Enter':
        if (first) {
          if (game.canAim()) game.startCharge();
          else game.advance();
        }
        break;
      case 'Escape':
        game.cancelCharge();
        break;
      case 'r':
        if (first) game.rerack();
        break;
      default:
        return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    held.delete(k);
    if ((k === ' ' || k === 'Enter') && game.isCharging()) game.releaseCharge();
  });

  return {
    /** Fades the swipe trail; call every frame. */
    update(dt: number) {
      if (!touch) trailFade = Math.max(0, trailFade - dt * 2.5);
      drawTrail();
    },
  };
}
