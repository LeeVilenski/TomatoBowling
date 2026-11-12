// Plays each computer bowler through simulated 10-frame games with the real physics, and
// checks they average close to their target. Use it to tune rivals in src/game/rivals.ts.
// Usage: npm run check:rivals [-- --games 40] [-- --rival carl]
import { chooseTarget, gaussian, humanise, planThrow } from '../src/game/ai';
import { HEAD_PIN_Z } from '../src/game/dimensions';
import { Match } from '../src/game/match';
import { BowlingPhysics } from '../src/game/physics';
import { RIVALS, type Rival } from '../src/game/rivals';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const GAMES = Number(arg('games') ?? 12);
const ONLY = arg('rival');
/** How far a rival's average may drift from its target before the check fails. */
const TOLERANCE = Number(arg('tolerance') ?? 20);

/** Small, seedable random numbers so runs are repeatable. */
function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

async function main() {
  const lane = await BowlingPhysics.create();
  const tracer = await BowlingPhysics.create();
  for (const i of tracer.pins.keys()) tracer.removePin(i);

  /** Throw one ball and let everything come to rest, as the game does. */
  function bowl(rival: Rival, frame: number, random: () => number) {
    const standing = lane.pins.flatMap((pin, i) => (lane.isPinDown(i) ? [] : [pin.translation()]));
    const target = chooseTarget(standing, rival);
    const plan = planThrow(rival, target, tracer);
    const pressure = frame >= 9 ? 0.6 : 0;
    const t = humanise(rival, plan, pressure, () => gaussian(random), !target.fullRack);
    const before = lane.pinsDown();
    lane.holdBall(t.x);
    lane.step();
    lane.throwBall(t);
    // Rolling, then settling: the same rules as the game (2–6 s once the ball reaches the pins)
    let settle = 0;
    for (let i = 0; i < 120 * 14; i++) {
      lane.step();
      const b = lane.ball.translation();
      const v = lane.ball.linvel();
      const arrived = b.z < HEAD_PIN_Z + 0.5 || b.y < -0.2 || Math.hypot(v.x, v.z) < 0.2;
      if (arrived) settle++;
      if ((settle > 240 && lane.isSettled()) || settle > 720) break;
    }
    return lane.pinsDown() - before;
  }

  /** What the pinsetter does between balls. */
  function setPins(freshRack: boolean) {
    if (freshRack) {
      lane.resetPins();
      return;
    }
    lane.pins.forEach((pin, i) => {
      if (lane.isPinDown(i)) lane.removePin(i);
      else {
        const p = pin.translation();
        lane.placePin(i, p.x, 0, p.z);
      }
    });
  }

  let failed = false;
  for (const rival of RIVALS.filter((r) => !ONLY || r.id === ONLY)) {
    const random = seeded(1000 + rival.id.length * 7919);
    lane.rng = seeded(42 + rival.stars);
    const scores: number[] = [];
    let strikes = 0;
    let firstBalls = 0;
    let spareChances = 0;
    let spares = 0;
    const started = Date.now();
    for (let g = 0; g < GAMES; g++) {
      const match = new Match([rival.name]);
      lane.resetPins();
      while (!match.gameOver) {
        const pos = match.position;
        const pins = bowl(rival, pos.frame, random);
        if (pos.fresh) {
          firstBalls++;
          if (pins === 10) strikes++;
        } else if (pos.ball > 0) {
          spareChances++;
          if (pins === pos.standing) spares++;
        }
        const out = match.recordRoll(pins);
        if (!out.gameOver) setPins(out.freshRack);
      }
      scores.push(match.totals()[0]);
    }
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const ok = Math.abs(avg - rival.targetAverage) <= TOLERANCE;
    if (!ok) failed = true;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${rival.name.padEnd(12)} average ${avg.toFixed(0).padStart(3)} (target ${rival.targetAverage} ±${TOLERANCE}) · ` +
        `range ${Math.min(...scores)}–${Math.max(...scores)} · strikes ${((strikes / firstBalls) * 100).toFixed(0)}% · ` +
        `spares ${spareChances ? ((spares / spareChances) * 100).toFixed(0) : '-'}% · ${GAMES} games in ${((Date.now() - started) / 1000).toFixed(0)} s`,
    );
  }
  process.exit(failed ? 1 : 0);
}

main();
