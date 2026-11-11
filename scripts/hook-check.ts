// Prints where the ball ends up for different amounts of spin (for tuning the hook).
import { BowlingPhysics } from '../src/game/physics';
import { HEAD_PIN_Z } from '../src/game/dimensions';

async function main() {
  const ph = await BowlingPhysics.create();
  for (const pin of ph.pins.keys()) ph.removePin(pin);
  for (const speed of [6, 8, 10]) {
    for (const spin of [-1, -0.5, 0, 0.5, 1]) {
      ph.holdBall(0);
      ph.step();
      ph.throwBall({ x: 0, angle: 0, speed, spin });
      const track: string[] = [];
      let t = 0;
      while (ph.ball.translation().z > HEAD_PIN_Z && t < 1200) {
        ph.step();
        t++;
        const p = ph.ball.translation();
        if (t % 60 === 0) track.push(`${p.x.toFixed(2)}@${p.z.toFixed(0)}`);
      }
      const p = ph.ball.translation();
      console.log(`speed ${speed} spin ${String(spin).padStart(4)} -> x at pins ${p.x.toFixed(3)} (${(t / 120).toFixed(2)} s)  ${track.join(' ')}`);
    }
  }
}
main();
