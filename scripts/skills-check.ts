// Skills Challenge check, run with `npm run check:skills` (or `npm run check:skills hello`
// for one challenge). Measures how big the window of good lines is at every shot, the way a
// player finds it: settle on a speed and spin, then try starting spots and aims. For the
// best speed and spin, the share of starts and aims (any start, aims within ±3°) that make
// the shot. Fails if that window is too small to hit on purpose, or so big there's no
// challenge. For calibration: the first Bank Transfer, which needed a near-perfect ball,
// scored 3.2%; a full rack with nothing in the way, 6.8%.
import { spawn } from 'node:child_process';
import { BowlingPhysics } from '../src/game/physics';
import { MAX_START_X } from '../src/game/dimensions';
import { CHALLENGES, OBSTACLE_HALF } from '../src/game/challenges';

/** Smallest window for a shot (full racks are strikes, which are tighter anyway), and the biggest. */
const AT_LEAST = 0.05;
const AT_LEAST_STRIKE = 0.035;
const AT_MOST = 0.3;

async function runOne(id: string) {
  const c = CHALLENGES.find((x) => x.id === id)!;
  const ph = await BowlingPhysics.create();
  ph.stemBumps = false;
  let seed = 404;
  ph.rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let failed = false;
  const lines: string[] = [];
  c.goes.forEach((go, gi) => {
    ph.setObstacles(go.obstacles.map((o) => ({ half: OBSTACLE_HALF[o.kind], x: o.x, z: o.z, angle: o.angle })));
    let share = 0;
    let example = '';
    for (const speed of [6, 8])
      for (const spin of [-1, -0.5, 0, 0.5, 1]) {
        let tries = 0;
        let made = 0;
        for (let xi = 0; xi <= 12; xi++)
          for (let ai = 0; ai <= 12; ai++) {
            const x = -MAX_START_X + (xi / 12) * 2 * MAX_START_X;
            const angle = ((-3 + ai * 0.5) * Math.PI) / 180;
            ph.resetPins();
            for (let p = 1; p <= 10; p++) if (!go.pins.includes(p)) ph.removePin(p - 1);
            ph.holdBall(x);
            for (let i = 0; i < 5; i++) ph.step();
            ph.throwBall({ x, angle, speed, spin });
            for (let i = 0; i < 750; i++) ph.step();
            tries++;
            if (go.pins.every((p) => ph.isPinDown(p - 1))) made++;
          }
        if (made / tries > share) {
          share = made / tries;
          example = `${speed} m/s, spin ${spin}`;
        }
      }
    const ok = share >= (go.pins.length === 10 ? AT_LEAST_STRIKE : AT_LEAST) && share <= AT_MOST;
    if (!ok) failed = true;
    lines.push(`${ok ? 'ok  ' : 'FAIL'} ${c.name} ${gi + 1} (${go.pins.join('-')}): ${(share * 100).toFixed(1)}%${example ? ` (best at ${example})` : ''}`);
  });
  console.log(lines.join('\n'));
  if (failed) process.exitCode = 1;
}

async function main() {
  const arg = process.argv[2];
  if (arg) return runOne(arg);
  // All of them, a few at a time
  const ids = CHALLENGES.map((c) => c.id);
  let failed = false;
  const run = (id: string) =>
    new Promise<void>((done) => {
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1], id], { stdio: 'inherit' });
      child.on('exit', (code) => {
        if (code) failed = true;
        done();
      });
    });
  const queue = [...ids];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) await run(queue.shift()!);
  }));
  if (failed) process.exit(1);
}

main();
