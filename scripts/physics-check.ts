// Quick physics sanity check, run with `npm run check:physics`.
// Simulates a set of throws without a browser and fails if anything looks wrong.
import { BowlingPhysics } from '../src/game/physics';
import { Pinsetter } from '../src/game/pinsetter';
import { Object3D } from 'three';

async function main() {
  const ph = await BowlingPhysics.create();
  // Repeatable runs: no random stem hops for the scoring checks, and a fixed seed for the hop test
  ph.stemBumps = false;
  let seed = 12345;
  ph.rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const run = (steps: number) => {
    for (let i = 0; i < steps; i++) ph.step();
  };
  let failed = false;
  const check = (ok: boolean, msg: string) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!ok) failed = true;
  };

  run(600);
  check(ph.pinsDown() === 0, `pins stand still for 5 s (down: ${ph.pinsDown()})`);

  const shots: { name: string; x: number; aim: number; speed: number; spin?: number; expect: (n: number) => boolean }[] = [
    { name: 'pocket shot', x: -0.06, aim: 0, speed: 8, expect: (n) => n >= 7 },
    { name: 'centre shot', x: 0, aim: 0, speed: 8, expect: (n) => n >= 5 },
    { name: 'right gutter', x: 0.3, aim: 3, speed: 8, expect: (n) => n === 0 },
    { name: 'left gutter', x: -0.3, aim: -3, speed: 8, expect: (n) => n === 0 },
    { name: 'fast shot', x: 0.06, aim: 0, speed: 11, expect: (n) => n >= 5 },
    { name: 'slow shot', x: 0.1, aim: 0, speed: 5, expect: (n) => n >= 1 },
    { name: 'hook into the pocket', x: 0.3, aim: 0, speed: 8, spin: -0.7, expect: (n) => n >= 7 },
    { name: 'too much hook', x: -0.2, aim: 0, speed: 7, spin: -1, expect: (n) => n <= 4 },
  ];
  for (const s of shots) {
    ph.resetPins();
    ph.holdBall(s.x);
    run(60);
    ph.throwBall({ x: s.x, angle: (s.aim * Math.PI) / 180, speed: s.speed, spin: s.spin });
    run(900);
    const down = ph.pinsDown();
    const ballY = ph.ball.translation().y;
    check(s.expect(down), `${s.name}: ${down} pins`);
    check(ballY > -0.6, `${s.name}: ball stays inside the alley (y ${ballY.toFixed(2)})`);
  }

  // The practice aim helper previews a throw on a second, pin-less world. It must match
  // where the real ball goes.
  const preview = await BowlingPhysics.create();
  for (const i of preview.pins.keys()) preview.removePin(i);
  for (const t of [
    { x: 0.3, angle: 0, speed: 8, spin: -0.7 },
    { x: -0.1, angle: 0.03, speed: 6, spin: 0.5 },
  ]) {
    const path = preview.tracePath(t, -18.29);
    ph.resetPins();
    for (const i of ph.pins.keys()) ph.removePin(i);
    ph.holdBall(t.x);
    run(5);
    ph.throwBall(t);
    while (ph.ball.translation().z > path[path.length - 1].z) ph.step();
    const end = path[path.length - 1];
    const miss = Math.abs(ph.ball.translation().x - end.x);
    const hooked = Math.sign(end.x - t.x - Math.sin(t.angle) * 18) === Math.sign(t.spin);
    check(miss < 0.02 && hooked, `aim preview matches the real throw (${(miss * 100).toFixed(1)} cm apart at the pins, hooks the right way)`);
  }

  // With stem hops switched off, the lane itself must never make the ball bounce
  for (const speed of [3, 6, 8, 11]) {
    for (const spin of [0, 1]) {
      ph.resetPins();
      for (const i of ph.pins.keys()) ph.removePin(i);
      ph.holdBall(0);
      run(5);
      ph.throwBall({ x: 0, angle: 0, speed, spin: -spin });
      let highest = 0;
      for (let i = 0; i < 2400 && ph.ball.translation().z > -17.5; i++) {
        ph.step();
        highest = Math.max(highest, ph.ball.translation().y - ph.ballRadius);
      }
      check(highest < 0.01, `ball stays on the lane at ${speed} m/s${spin ? ' with spin' : ''} (max lift ${(highest * 100).toFixed(1)} cm)`);
    }
  }

  // Stem hops: small, at different points each throw, and not on every throw
  ph.stemBumps = true;
  const hops: number[] = [];
  let biggest = 0;
  for (let t = 0; t < 30; t++) {
    ph.resetPins();
    for (const i of ph.pins.keys()) ph.removePin(i);
    ph.holdBall(0);
    run(5);
    ph.throwBall({ x: 0, angle: 0, speed: 8 });
    let lift = 0;
    let at: number | null = null;
    for (let i = 0; i < 2400 && ph.ball.translation().z > -17.5; i++) {
      ph.step();
      if (ph.bumped && at === null) at = -ph.ball.translation().z;
      lift = Math.max(lift, ph.ball.translation().y - ph.ballRadius);
    }
    ph.bumped = false;
    if (at !== null) hops.push(at);
    biggest = Math.max(biggest, lift);
  }
  const spread = hops.length ? Math.max(...hops) - Math.min(...hops) : 0;
  console.log(`     stem hops in ${hops.length}/30 throws, at ${hops.map((h) => h.toFixed(1)).join(', ')} m`);
  check(hops.length >= 10 && hops.length < 30, `stem hops happen on most throws but not all (${hops.length}/30)`);
  check(spread > 3, `hops happen at different points down the lane (spread ${spread.toFixed(1)} m)`);
  check(biggest > 0.15 && biggest < 0.9, `hops are big but sensible (biggest ${(biggest * 100).toFixed(1)} cm)`);

  // Big late hops can clear the pins entirely; make sure that stays occasional
  let overPins = 0;
  for (let t = 0; t < 30; t++) {
    ph.resetPins();
    ph.holdBall(-0.06);
    run(60);
    ph.throwBall({ x: -0.06, angle: 0, speed: 11 });
    let hit = false;
    for (let i = 0; i < 1500 && !hit; i++) {
      ph.step();
      if (ph.ballPinContacts().length) hit = true;
    }
    if (!hit) overPins++;
  }
  check(overPins <= 8, `hopping over the pins is a rare treat, not the norm (${overPins}/30 flew over)`);
  ph.stemBumps = false;

  // Pinsetter: after a first ball, standing pins come back and fallen ones are cleared
  const setter = new Pinsetter(ph, new Object3D());
  const cycle = (mode: 'clear' | 'rerack') => {
    let done = false;
    setter.start(mode, () => (done = true));
    for (let i = 0; i < 600 && !done; i++) {
      setter.update(1 / 120);
      ph.step();
    }
    run(240);
    return done;
  };
  ph.resetPins();
  ph.holdBall(0.2);
  run(60);
  ph.throwBall({ x: 0.2, angle: 0, speed: 8 });
  run(900);
  const standing = 10 - ph.pinsDown();
  check(cycle('clear'), 'pinsetter clear cycle finishes');
  const removed = ph.pins.filter((_, i) => ph.isPinRemoved(i)).length;
  check(10 - ph.pinsDown() === standing && removed === 10 - standing, `standing pins survive the sweep (${standing} standing, ${removed} cleared)`);
  check(cycle('rerack'), 'pinsetter rerack cycle finishes');
  check(ph.pinsDown() === 0, `fresh rack stands (down: ${ph.pinsDown()})`);

  process.exit(failed ? 1 : 0);
}
main();
