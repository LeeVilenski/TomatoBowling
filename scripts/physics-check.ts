// Quick physics sanity check, run with `npm run check:physics`.
// Simulates a set of throws without a browser and fails if anything looks wrong.
import { BowlingPhysics } from '../src/game/physics';

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

  const shots: { name: string; x: number; aim: number; speed: number; expect: (n: number) => boolean }[] = [
    { name: 'pocket shot', x: -0.06, aim: 0, speed: 8, expect: (n) => n >= 7 },
    { name: 'centre shot', x: 0, aim: 0, speed: 8, expect: (n) => n >= 5 },
    { name: 'right gutter', x: 0.3, aim: 3, speed: 8, expect: (n) => n === 0 },
    { name: 'left gutter', x: -0.3, aim: -3, speed: 8, expect: (n) => n === 0 },
    { name: 'fast shot', x: 0.06, aim: 0, speed: 11, expect: (n) => n >= 5 },
    { name: 'slow shot', x: 0.1, aim: 0, speed: 5, expect: (n) => n >= 1 },
  ];
  for (const s of shots) {
    ph.resetPins();
    ph.holdBall(s.x);
    run(60);
    ph.throwBall({ x: s.x, angle: (s.aim * Math.PI) / 180, speed: s.speed });
    run(900);
    const down = ph.pinsDown();
    const ballY = ph.ball.translation().y;
    check(s.expect(down), `${s.name}: ${down} pins`);
    check(ballY > -0.6, `${s.name}: ball stays inside the alley (y ${ballY.toFixed(2)})`);
  }
  process.exit(failed ? 1 : 0);
}
main();
