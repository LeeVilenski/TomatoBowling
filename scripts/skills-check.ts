// Skills Challenge check, run with `npm run check:skills`. Sweeps throws across the lane at
// every shot and fails if one becomes impossible, or so easy it's no challenge.
import { BowlingPhysics } from '../src/game/physics';
import { MAX_AIM_ANGLE, MAX_START_X } from '../src/game/dimensions';
import { CHALLENGES, OBSTACLE_HALF } from '../src/game/challenges';

/** Share of the sweep that should make each shot: some, but not most. */
const AT_LEAST = 0.004;
const AT_MOST = 0.35;

async function main() {
  const only = process.argv[2];
  const ph = await BowlingPhysics.create();
  ph.stemBumps = false;
  let seed = 404;
  ph.rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let failed = false;
  for (const c of CHALLENGES) {
    if (only && c.id !== only) continue;
    ph.setObstacles(c.obstacles.map((o) => ({ half: OBSTACLE_HALF[o.kind], x: o.x, z: o.z, angle: o.angle })));
    let tries = 0;
    let made = 0;
    const hits: string[] = [];
    for (let xi = 0; xi <= 12; xi++)
      for (let ai = 0; ai <= 8; ai++)
        for (const speed of [6, 9])
          for (const spin of [-0.7, -0.3, 0, 0.3, 0.7]) {
            const x = -MAX_START_X + (xi / 12) * 2 * MAX_START_X;
            const angle = -MAX_AIM_ANGLE + (ai / 8) * 2 * MAX_AIM_ANGLE;
            ph.resetPins();
            for (let p = 1; p <= 10; p++) if (!c.pins.includes(p)) ph.removePin(p - 1);
            ph.holdBall(x);
            for (let i = 0; i < 5; i++) ph.step();
            ph.throwBall({ x, angle, speed, spin });
            for (let i = 0; i < 750; i++) ph.step();
            tries++;
            if (c.pins.every((p) => ph.isPinDown(p - 1))) {
              made++;
              if (hits.length < 4) hits.push(`x ${x.toFixed(2)} aim ${((angle * 180) / Math.PI).toFixed(1)}° ${speed} m/s spin ${spin}`);
            }
          }
    const share = made / tries;
    const ok = share >= AT_LEAST && share <= AT_MOST;
    if (!ok) failed = true;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}: made by ${(share * 100).toFixed(1)}% of the sweep${hits.length ? ` (e.g. ${hits[0]})` : ''}`);
  }
  if (failed) process.exit(1);
}

main();
