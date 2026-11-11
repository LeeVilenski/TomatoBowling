import * as THREE from 'three';
import './style.css';
import { BALL_RADIUS, HEAD_PIN_Z, LANE_HALF } from './game/dimensions';
import { BowlingPhysics, PHYSICS_DT } from './game/physics';
import { buildAlley } from './scene/alley';
import { createPinMesh, createTomatoBall } from './scene/models';

type Phase = 'aiming' | 'rolling' | 'settling' | 'result';

const MAX_X = LANE_HALF - BALL_RADIUS - 0.03;
const MAX_ANGLE = (4 * Math.PI) / 180;
const MIN_SPEED = 5;
const MAX_SPEED = 11;

async function start() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const status = document.getElementById('status')!;
  const readout = document.getElementById('readout')!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
  buildAlley(scene);

  const physics = await BowlingPhysics.create();

  const pinMeshes = physics.pins.map(() => {
    const m = createPinMesh();
    scene.add(m);
    return m;
  });
  const ballMesh = createTomatoBall();
  scene.add(ballMesh);

  // Aim guide: a dashed line from the ball down the lane
  const aimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
  const aimLine = new THREE.Line(
    aimGeo,
    new THREE.LineDashedMaterial({ color: '#ffe066', dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.85 }),
  );
  scene.add(aimLine);

  // ---- Game state ----
  let phase: Phase = 'aiming';
  let aimX = 0;
  let aimAngle = 0;
  let speed = 8;
  let settleTime = 0;
  let lastResult = 0;

  function updateReadout() {
    const deg = ((aimAngle * 180) / Math.PI).toFixed(1);
    readout.textContent = `Position ${(aimX * 100).toFixed(0)} cm · Aim ${deg}° · Speed ${speed.toFixed(1)} m/s`;
  }

  function setStatus(text: string) {
    status.textContent = text;
  }

  function nudge(dx: number, dAngle: number, dSpeed: number) {
    if (phase !== 'aiming') return;
    aimX = THREE.MathUtils.clamp(aimX + dx, -MAX_X, MAX_X);
    aimAngle = THREE.MathUtils.clamp(aimAngle + dAngle, -MAX_ANGLE, MAX_ANGLE);
    speed = THREE.MathUtils.clamp(speed + dSpeed, MIN_SPEED, MAX_SPEED);
    physics.holdBall(aimX);
    updateReadout();
  }

  function throwBall() {
    if (phase !== 'aiming') return;
    physics.throwBall({ x: aimX, angle: aimAngle, speed });
    phase = 'rolling';
    settleTime = 0;
    setStatus('Rolling…');
  }

  function reset() {
    physics.resetPins();
    physics.holdBall(aimX);
    phase = 'aiming';
    setStatus('Line up and throw!');
  }

  // ---- Input ----
  const keys: Record<string, () => void> = {
    ArrowLeft: () => nudge(-0.02, 0, 0),
    ArrowRight: () => nudge(0.02, 0, 0),
    a: () => nudge(0, -0.25 * (Math.PI / 180), 0),
    d: () => nudge(0, 0.25 * (Math.PI / 180), 0),
    ArrowUp: () => nudge(0, 0, 0.5),
    ArrowDown: () => nudge(0, 0, -0.5),
    w: () => nudge(0, 0, 0.5),
    s: () => nudge(0, 0, -0.5),
    ' ': () => (phase === 'result' ? reset() : throwBall()),
    Enter: () => (phase === 'result' ? reset() : throwBall()),
    r: () => reset(),
  };
  window.addEventListener('keydown', (e) => {
    const fn = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });

  // On-screen buttons (hold to repeat)
  const actions: Record<string, () => void> = {
    left: keys.ArrowLeft,
    right: keys.ArrowRight,
    aimL: keys.a,
    aimR: keys.d,
    faster: keys.ArrowUp,
    slower: keys.ArrowDown,
    throw: keys[' '],
    reset: keys.r,
  };
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
    const fn = actions[btn.dataset.action!];
    const repeats = btn.dataset.repeat !== undefined;
    let timer: number | undefined;
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
      if (repeats) timer = window.setInterval(fn, 90);
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  });

  // ---- Resize ----
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait phones need a wider view to see the lane
    camera.fov = camera.aspect < 0.8 ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- Camera ----
  const camPos = new THREE.Vector3(0.35, 1.5, 2.4);
  const camLook = new THREE.Vector3(0, 0, -16);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();

  function updateCamera(dt: number) {
    const b = physics.ball.translation();
    if (phase === 'aiming') {
      if (camera.aspect < 0.8) {
        // Portrait: sit higher and further back so the ball clears the on-screen buttons
        wantPos.set(aimX + 0.25, 1.9, 3.0);
        wantLook.set(aimX * 0.3, 0, -11);
      } else {
        wantPos.set(aimX + 0.35, 1.45, 2.3);
        wantLook.set(aimX * 0.3, 0, -16);
      }
    } else if (phase === 'rolling') {
      const z = Math.max(b.z + 3.2, HEAD_PIN_Z + 4.2);
      wantPos.set(b.x * 0.5, THREE.MathUtils.lerp(0.75, 1.4, THREE.MathUtils.clamp(z / 2, 0, 1)), z);
      wantLook.set(b.x * 0.5, 0.1, Math.max(b.z - 6, HEAD_PIN_Z - 0.4));
    } else {
      wantPos.set(0, 0.85, HEAD_PIN_Z + 3.6);
      wantLook.set(0, 0.15, HEAD_PIN_Z - 0.4);
    }
    const k = 1 - Math.exp(-dt * (phase === 'rolling' ? 6 : 3));
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  // ---- Main loop (fixed physics step) ----
  let acc = 0;
  let last = performance.now();

  function syncMeshes() {
    physics.pins.forEach((pin, i) => {
      const p = pin.translation();
      const q = pin.rotation();
      pinMeshes[i].position.set(p.x, p.y, p.z);
      pinMeshes[i].quaternion.set(q.x, q.y, q.z, q.w);
    });
    const p = physics.ball.translation();
    const q = physics.ball.rotation();
    ballMesh.position.set(p.x, p.y, p.z);
    ballMesh.quaternion.set(q.x, q.y, q.z, q.w);

    aimLine.visible = phase === 'aiming';
    if (aimLine.visible) {
      const len = 5;
      aimGeo.setFromPoints([
        new THREE.Vector3(p.x, 0.005, p.z - BALL_RADIUS),
        new THREE.Vector3(p.x + Math.sin(aimAngle) * len, 0.005, p.z - Math.cos(aimAngle) * len),
      ]);
      aimLine.computeLineDistances();
    }
  }

  function updatePhase(dt: number) {
    if (phase === 'rolling') {
      const b = physics.ball.translation();
      const v = physics.ball.linvel();
      const stalled = Math.hypot(v.x, v.z) < 0.2;
      if (b.z < HEAD_PIN_Z + 0.5 || b.y < -0.2 || stalled) {
        phase = 'settling';
        settleTime = 0;
      }
    } else if (phase === 'settling') {
      settleTime += dt;
      if ((settleTime > 2 && physics.isSettled()) || settleTime > 6) {
        lastResult = physics.pinsDown();
        phase = 'result';
        const word = lastResult === 10 ? 'STRIKE! 🍅' : lastResult === 0 ? 'Gutter… saucy.' : `${lastResult} pin${lastResult === 1 ? '' : 's'}`;
        setStatus(`${word} — tap Reset / press Space to go again`);
      }
    }
  }

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= PHYSICS_DT && steps < 12) {
      physics.step();
      acc -= PHYSICS_DT;
      steps++;
    }
    if (steps === 12) acc = 0;

    updatePhase(dt);
    syncMeshes();
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // Small hook for automated testing in the browser console
  (window as unknown as { __game: unknown }).__game = {
    physics,
    throwBall: (x = 0, angleDeg = 0, s = 8) => {
      aimX = x;
      aimAngle = (angleDeg * Math.PI) / 180;
      speed = s;
      physics.holdBall(aimX);
      throwBall();
    },
    reset,
    get phase() {
      return phase;
    },
    get result() {
      return lastResult;
    },
  };

  updateReadout();
  physics.holdBall(aimX);
  setStatus('Line up and throw!');
  document.getElementById('loading')?.remove();
  requestAnimationFrame(frame);
}

start().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Sorry, the game failed to load. Try refreshing.';
});
