// Split check, run with `npm run check:splits`. Sweeps throws across the lane at a set of
// splits and at full racks, and fails if splits become impossible again or full racks change.
import { BowlingPhysics } from '../src/game/physics';
import { MAX_AIM_ANGLE, MAX_START_X } from '../src/game/dimensions';

const SPLITS: Record<string, number[]> = { '7-10': [7, 10], '4-6': [4, 6], '6-7': [6, 7], '4-10': [4, 10], '8-10': [8, 10], '5-7': [5, 7], '3-10': [3, 10] };
/** Lowest share of the sweep each split should be picked up by (the 3-10 is the ball's own job, so it gets no help). */
const AT_LEAST: Record<string, number> = { '7-10': 0.03, '4-6': 0.05, '6-7': 0.02, '4-10': 0.02, '8-10': 0.03, '5-7': 0.02, '3-10': 0.03 };

async function main() {
  const ph = await BowlingPhysics.create();
  ph.stemBumps = false;
  let failed = false;
  const check = (ok: boolean, msg: string) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!ok) failed = true;
  };
  const roll = (x: number, angle: number, speed: number, spin: number, keep?: number[]) => {
    ph.resetPins();
    if (keep) for (let p = 1; p <= 10; p++) if (!keep.includes(p)) ph.removePin(p - 1);
    ph.holdBall(x);
    for (let i = 0; i < 5; i++) ph.step();
    ph.throwBall({ x, angle, speed, spin });
    for (let i = 0; i < 750; i++) ph.step();
  };

  for (const [name, left] of Object.entries(SPLITS)) {
    let tries = 0;
    let made = 0;
    for (let xi = 0; xi <= 16; xi++)
      for (let ai = 0; ai <= 8; ai++)
        for (const speed of [6, 9])
          for (const spin of [-0.5, 0.5]) {
            roll(-MAX_START_X + (xi / 16) * 2 * MAX_START_X, -MAX_AIM_ANGLE + (ai / 8) * 2 * MAX_AIM_ANGLE, speed, spin, left);
            tries++;
            if (left.every((p) => ph.isPinDown(p - 1))) made++;
          }
    check(made / tries >= AT_LEAST[name], `${name}: picked up by ${((made / tries) * 100).toFixed(1)}% of the sweep`);
  }

  // Full racks get no split help, so they should play as before (13% / 48% when this was written)
  let tries = 0;
  let strikes = 0;
  for (let xi = 0; xi <= 20; xi++)
    for (const speed of [6, 8, 10])
      for (const spin of [-0.7, -0.3, 0, 0.3, 0.7]) {
        roll(-0.3 + (xi / 20) * 0.6, 0, speed, spin);
        check(!ph.splitShot, 'no split help at a full rack');
        tries++;
        if (ph.pinsDown() === 10) strikes++;
      }
  let pocket = 0;
  for (let xi = 0; xi <= 10; xi++)
    for (const speed of [7, 8, 9]) {
      roll(0.25 + xi * 0.012, 0, speed, -0.7);
      if (ph.pinsDown() === 10) pocket++;
    }
  const strikeRate = strikes / tries;
  const pocketRate = pocket / 33;
  check(strikeRate > 0.08 && strikeRate < 0.2, `full racks: ${(strikeRate * 100).toFixed(1)}% strikes across the lane`);
  check(pocketRate > 0.35 && pocketRate < 0.65, `full racks: ${(pocketRate * 100).toFixed(1)}% strikes from hooks into the pocket`);
  process.exit(failed ? 1 : 0);
}
void main();
