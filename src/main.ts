import * as THREE from 'three';
import './style.css';
import { BALL_RADIUS, HEAD_PIN_Z, LANE_HALF, OUTER_HALF } from './game/dimensions';
import { BowlingPhysics, PHYSICS_DT } from './game/physics';
import { Pinsetter, type PinsetterMode } from './game/pinsetter';
import { attachControls, type ControlTarget } from './input/controls';
import type { SwipeThrow } from './input/swipe';
import { buildAlley } from './scene/alley';
import { createPinMesh, createTomatoBall } from './scene/models';

type Phase = 'aiming' | 'charging' | 'rolling' | 'settling' | 'result' | 'sweeping';

const MAX_X = LANE_HALF - BALL_RADIUS - 0.03;
const MAX_ANGLE = (4 * Math.PI) / 180;
const MIN_SPEED = 5;
const MAX_SPEED = 11;
const CHARGE_HALF_CYCLE = 0.8; // seconds for the power meter to go from empty to full
const RESULT_PAUSE = 2.2; // seconds before the pinsetter runs on its own

const clamp = THREE.MathUtils.clamp;
const $ = (id: string) => document.getElementById(id)!;

async function start() {
  const canvas = $('game') as HTMLCanvasElement;
  const status = $('status');
  const readout = $('readout');
  const powerMeter = $('power');
  const powerFill = $('power-fill');
  const spinValue = $('spin-value');

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

  const sweepBar = new THREE.Mesh(
    new THREE.BoxGeometry(OUTER_HALF * 2 + 0.1, 0.1, 0.04),
    new THREE.MeshStandardMaterial({ color: '#2d2f36', metalness: 0.6, roughness: 0.4 }),
  );
  sweepBar.castShadow = true;
  scene.add(sweepBar);
  const pinsetter = new Pinsetter(physics, sweepBar);

  // Aim guide: dashed line showing roughly where the ball will go, including the hook
  const AIM_POINTS = 40;
  const aimGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: AIM_POINTS }, () => new THREE.Vector3()));
  const aimLine = new THREE.Line(
    aimGeo,
    new THREE.LineDashedMaterial({ color: '#ffe066', dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.8 }),
  );
  scene.add(aimLine);

  // ---- Game state ----
  let phase: Phase = 'aiming';
  let aimX = 0;
  let aim = 0; // -1..1
  let spin = 0; // -1..1 (keyboard / mouse spin setting)
  let power = 0;
  let chargeStart = 0;
  let settleTime = 0;
  let resultTime = 0;
  let ballInRack: 1 | 2 = 1;
  let downBefore = 0;
  let nextSetter: PinsetterMode = 'rerack';
  let lastThrow = { speed: 0, spin: 0, knocked: 0 };

  const setStatus = (text: string) => (status.textContent = text);

  function updateReadout() {
    const spinText = spin === 0 ? 'none' : `${spin < 0 ? '◀' : '▶'} ${Math.round(Math.abs(spin) * 100)}%`;
    readout.textContent = `Ball ${ballInRack} · Spin ${spinText}`;
    spinValue.textContent = spinText;
  }

  function showPower(p: number, visible: boolean) {
    powerMeter.classList.toggle('visible', visible);
    powerFill.style.transform = `scaleY(${p})`;
  }

  function launch(p: number, aimValue: number, spinValue: number) {
    const speed = MIN_SPEED + p * (MAX_SPEED - MIN_SPEED);
    downBefore = physics.pinsDown();
    physics.throwBall({ x: aimX, angle: aimValue * MAX_ANGLE, speed, spin: spinValue });
    lastThrow = { speed, spin: spinValue, knocked: 0 };
    phase = 'rolling';
    settleTime = 0;
    setStatus(`Rolling… ${speed.toFixed(1)} m/s`);
  }

  function finishThrow() {
    const totalDown = physics.pinsDown();
    const knocked = totalDown - downBefore;
    lastThrow.knocked = knocked;
    let msg: string;
    if (ballInRack === 1) {
      if (knocked === 10) {
        msg = 'STRIKE! 🍅';
        nextSetter = 'rerack';
      } else {
        msg = knocked === 0 ? 'Gutter… saucy.' : `${knocked} pin${knocked === 1 ? '' : 's'}`;
        nextSetter = 'clear';
      }
    } else {
      msg = totalDown === 10 ? 'Spare! 🍅' : `${knocked} more — ${totalDown} total`;
      nextSetter = 'rerack';
    }
    phase = 'result';
    resultTime = 0;
    setStatus(msg);
  }

  function runPinsetter(mode: PinsetterMode) {
    phase = 'sweeping';
    physics.holdBall(aimX);
    setStatus(mode === 'clear' ? 'Clearing the deadwood…' : 'Setting a fresh rack…');
    pinsetter.start(mode, () => {
      ballInRack = mode === 'clear' ? 2 : 1;
      phase = 'aiming';
      setStatus(ballInRack === 1 ? 'Line up and throw!' : 'Second ball — pick up the spare!');
      updateReadout();
    });
  }

  const controls: ControlTarget = {
    canAim: () => phase === 'aiming' || phase === 'charging',
    isCharging: () => phase === 'charging',
    moveBy(delta) {
      if (phase !== 'aiming') return;
      aimX = clamp(aimX + delta * MAX_X, -MAX_X, MAX_X);
      physics.holdBall(aimX);
    },
    setPosition(v) {
      if (phase !== 'aiming') return;
      aimX = clamp(v, -1, 1) * MAX_X;
      physics.holdBall(aimX);
    },
    nudgeAim(delta) {
      if (phase !== 'aiming' && phase !== 'charging') return;
      aim = clamp(aim + delta, -1, 1);
    },
    nudgeSpin(delta) {
      if (phase !== 'aiming' && phase !== 'charging') return;
      spin = clamp(Math.round((spin + delta) * 10) / 10, -1, 1);
      updateReadout();
    },
    startCharge() {
      if (phase !== 'aiming') return;
      phase = 'charging';
      chargeStart = performance.now();
      power = 0;
      setStatus('Release to throw!');
    },
    releaseCharge() {
      if (phase !== 'charging') return;
      const held = (performance.now() - chargeStart) / 1000;
      power = 0.5 - 0.5 * Math.cos((Math.PI * held) / CHARGE_HALF_CYCLE);
      showPower(power, false);
      launch(power, aim, spin);
    },
    cancelCharge() {
      if (phase !== 'charging') return;
      phase = 'aiming';
      showPower(0, false);
      setStatus('Line up and throw!');
    },
    swipeThrow(t: SwipeThrow) {
      if (phase !== 'aiming') return;
      showPower(t.power, true);
      setTimeout(() => showPower(t.power, false), 700);
      launch(t.power, t.aim, t.spin);
    },
    advance() {
      if (phase === 'result') runPinsetter(nextSetter);
    },
    rerack() {
      if (phase === 'aiming' || phase === 'result') runPinsetter('rerack');
    },
  };
  const input = attachControls(canvas, $('trail') as HTMLCanvasElement, controls);

  // On-screen spin buttons (mouse users; touch players curve their swipe instead)
  $('spin-left').addEventListener('click', () => controls.nudgeSpin(-0.1));
  $('spin-right').addEventListener('click', () => controls.nudgeSpin(0.1));

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
    if (phase === 'aiming' || phase === 'charging') {
      if (camera.aspect < 0.8) {
        // Portrait: sit higher and further back so the ball clears the bottom of the screen
        wantPos.set(aimX + 0.25, 1.9, 3.0);
        wantLook.set(aimX * 0.3, 0, -11);
      } else {
        wantPos.set(aimX + 0.35, 1.45, 2.3);
        wantLook.set(aimX * 0.3, 0, -16);
      }
    } else if (phase === 'rolling') {
      const z = Math.max(b.z + 3.2, HEAD_PIN_Z + 4.2);
      wantPos.set(b.x * 0.5, THREE.MathUtils.lerp(0.75, 1.4, clamp(z / 2, 0, 1)), z);
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

  // ---- Per-frame updates ----
  const tmp = new THREE.Vector3();
  function updateAimLine() {
    aimLine.visible = phase === 'aiming' || phase === 'charging';
    if (!aimLine.visible) return;
    const p = physics.ball.translation();
    const angle = aim * MAX_ANGLE;
    const length = -HEAD_PIN_Z;
    const pos = aimGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < AIM_POINTS; i++) {
      const d = (i / (AIM_POINTS - 1)) * length;
      // Rough hook preview at a medium throw: almost nothing in the oil, then it bends late
      const hook = spin * 0.37 * Math.pow(d / length, 3);
      tmp.set(p.x + Math.sin(angle) * d + hook, 0.005, p.z - BALL_RADIUS - Math.cos(angle) * d);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    pos.needsUpdate = true;
    aimLine.computeLineDistances();
  }

  function syncMeshes() {
    physics.pins.forEach((pin, i) => {
      const p = pin.translation();
      const q = pin.rotation();
      pinMeshes[i].visible = !physics.isPinRemoved(i);
      pinMeshes[i].position.set(p.x, p.y, p.z);
      pinMeshes[i].quaternion.set(q.x, q.y, q.z, q.w);
    });
    const p = physics.ball.translation();
    const q = physics.ball.rotation();
    ballMesh.position.set(p.x, p.y, p.z);
    ballMesh.quaternion.set(q.x, q.y, q.z, q.w);
  }

  function updatePhase(dt: number) {
    if (phase === 'charging') {
      // Uses the real clock so the meter moves at the same pace on slow devices
      const held = (performance.now() - chargeStart) / 1000;
      power = 0.5 - 0.5 * Math.cos((Math.PI * held) / CHARGE_HALF_CYCLE);
      showPower(power, true);
    } else if (phase === 'rolling') {
      const b = physics.ball.translation();
      const v = physics.ball.linvel();
      const stalled = Math.hypot(v.x, v.z) < 0.2;
      if (b.z < HEAD_PIN_Z + 0.5 || b.y < -0.2 || stalled) {
        phase = 'settling';
        settleTime = 0;
      }
    } else if (phase === 'settling') {
      settleTime += dt;
      if ((settleTime > 2 && physics.isSettled()) || settleTime > 6) finishThrow();
    } else if (phase === 'result') {
      resultTime += dt;
      if (resultTime > RESULT_PAUSE) runPinsetter(nextSetter);
    }
  }

  // ---- Main loop (fixed physics step) ----
  let acc = 0;
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= PHYSICS_DT && steps < 12) {
      pinsetter.update(PHYSICS_DT);
      physics.step();
      acc -= PHYSICS_DT;
      steps++;
    }
    if (steps === 12) acc = 0;

    updatePhase(dt);
    syncMeshes();
    updateAimLine();
    updateCamera(dt);
    input.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // Small hook for automated testing in the browser console
  (window as unknown as { __game: unknown }).__game = {
    physics,
    controls,
    throwBall: (x = 0, aimValue = 0, p = 0.5, s = 0) => {
      aimX = x;
      physics.holdBall(aimX);
      launch(p, aimValue, s);
    },
    get phase() {
      return phase;
    },
    get ballInRack() {
      return ballInRack;
    },
    get lastThrow() {
      return lastThrow;
    },
  };

  updateReadout();
  physics.holdBall(aimX);
  setStatus('Line up and throw!');
  $('loading').remove();
  requestAnimationFrame(frame);
}

start().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Sorry, the game failed to load. Try refreshing.';
});
