// What each of Dave's tomatoes is like to bowl: power, spin and aim, each from 1 to 5 stars.
// The Classic Tomato is 3 across the board and bowls exactly as the game always has; the
// computer rivals' own balls are all 3s too, so their tuning holds.

export interface BallStats {
  /** Throw speed and how hard it hits: faster, heavier balls send pins further. */
  power: number;
  /** How much hook you get for the spin you put on. */
  spin: number;
  /** How good the aim line is (see AIM_LINES). */
  aim: number;
}

export const STAT_NAMES: Record<keyof BallStats, string> = { power: 'Power', spin: 'Spin', aim: 'Aim line' };

export const NEUTRAL_STATS: BallStats = { power: 3, spin: 3, aim: 3 };

/** Each of Dave's balls, with a line about how it plays. */
export const BALL_STATS: Record<string, BallStats & { blurb: string }> = {
  classic: { power: 3, spin: 3, aim: 3, blurb: 'Does a bit of everything.' },
  cherry: { power: 4, spin: 2, aim: 4, blurb: 'Small and quick, and easy to read.' },
  green: { power: 3, spin: 4, aim: 3, blurb: 'Firm skin that bites the dry boards.' },
  tomatillo: { power: 2, spin: 2, aim: 5, blurb: 'A spare specialist: shows the true path, right through the pins.' },
  beefsteak: { power: 5, spin: 2, aim: 2, blurb: 'Big, heavy and straight. Pins hate it.' },
  plum: { power: 2, spin: 5, aim: 3, blurb: 'Slow, but it hooks like crazy.' },
  heirloom: { power: 4, spin: 3, aim: 4, blurb: 'An old family favourite.' },
  sundried: { power: 3, spin: 4, aim: 5, blurb: 'Wrinkly, grippy, and it shows the true path.' },
  krim: { power: 5, spin: 4, aim: 3, blurb: 'A dark, heavy hitter with a mean hook.' },
  circuit: { power: 3, spin: 3, aim: 5, blurb: 'Computes the exact path, right through the pins.' },
  sunset: { power: 4, spin: 5, aim: 3, blurb: 'Big rooftop hook, lots of drive.' },
  discoball: { power: 4, spin: 5, aim: 4, blurb: 'Mirrored, groovy and full of spin.' },
  golden: { power: 4, spin: 4, aim: 5, blurb: 'The best of everything.' },
};

export function ballStats(id: string): BallStats {
  return BALL_STATS[id] ?? NEUTRAL_STATS;
}

/** How each aim-line level helps, for the wardrobe. */
export const AIM_LINES: Record<number, string> = {
  1: 'a short guide line',
  2: 'a longer guide line',
  3: 'a guide line to the pins',
  4: 'the true path to the pins, at the power you charge',
  5: 'the true path, right through the pins',
};

export interface BallEffects {
  /** Multiplies the throw speed. */
  speed: number;
  /** Multiplies the ball's weight. */
  mass: number;
  /** Multiplies the spin put on the ball. */
  spin: number;
  /** Multiplies the extra pin action when rolling at a split. */
  pinAction: number;
  /** How far down the lane the guide line reaches (0–1), for the rough lines (aim 1–3). */
  reach: number;
  /** Aim 4+: the line shows the real path, worked out by the physics. */
  truePath: boolean;
  /** Aim 5: the true path carries on through the pin deck. */
  throughPins: boolean;
}

export function ballEffects(id: string): BallEffects {
  const s = ballStats(id);
  return {
    speed: 1 + 0.025 * (s.power - 3),
    mass: 1 + 0.06 * (s.power - 3),
    spin: 1 + 0.15 * (s.spin - 3),
    pinAction: 1 + 0.08 * (s.power - 3),
    reach: s.aim <= 1 ? 0.45 : s.aim === 2 ? 0.7 : 1,
    truePath: s.aim >= 4,
    throughPins: s.aim >= 5,
  };
}
