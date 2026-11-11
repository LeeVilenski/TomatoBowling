// Quick physics sanity check, run with `npm run check:physics`.
// Simulates a set of throws without a browser and fails if anything looks wrong.
import { BowlingPhysics } from '../src/game/physics';
import { Pinsetter } from '../src/game/pinsetter';
import { Object3D } from 'three';

async function main() {
  const ph = await BowlingPhysics.create();
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

  // The ball should never bounce off the lane on its way down
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
