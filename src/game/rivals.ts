// The computer bowlers. For now: the Tomato Dave's ladder (three rivals and the home
// champion). Accuracy numbers are tuned with `npm run check:rivals`, which plays each rival
// through simulated games and checks they average near `targetAverage`.
import type { BowlerSkill } from './ai';
import type { ReactionKind } from './reactions';

export type RivalId = 'pickle' | 'donut' | 'sandy' | 'carl';

export interface Rival extends BowlerSkill {
  id: RivalId;
  name: string;
  /** One line about how they bowl, for the rival picker. */
  blurb: string;
  /** Difficulty, 1–5. */
  stars: number;
  /** What this rival should average over a 10-frame game (checked by the tuning harness). */
  targetAverage: number;
  /** Suit they wear; they bowl in Dave's body with their own head. */
  outfit: string;
  head: 'pickle' | 'donut' | 'sandwich' | 'carrot';
  /** Shown next to their name in the rival picker. */
  emoji: string;
  /** What they say after their own balls (a few per kind of result). */
  lines: Record<ReactionKind, string[]>;
  /** A bit of trash talk on the career match intro (one picked at random). */
  intro: string[];
}

export const RIVALS: Rival[] = [
  {
    id: 'pickle',
    name: 'Pickle Pete',
    blurb: 'Slow, straight and sweats brine under pressure.',
    stars: 1,
    targetAverage: 70,
    outfit: 'rival-pickle',
    head: 'pickle',
    intro: ["Oh! Hello. I've been practising. A bit. Please go easy on me.", "I'm not nervous. You're nervous. Okay, I'm nervous.", 'Big dill today, huh?'],
    lines: {
      strike: ['Oh! Oh my. Did I do that?', 'Big dill!', 'Pickled tink!'],
      spare: ['Phew. Brine and dandy.', 'Relish the moment!', 'I got them!'],
      good: ['That was nearly good!', 'Not too shabby for a gherkin.'],
      meh: ['Sorry. Was that okay?', 'I was aiming for... somewhere.', 'Bit of a sour one.'],
      gutter: ["I'm in a pickle.", 'Oh dill.', 'Please stop looking at me.'],
      split: ['Is that... bad?', 'Oh no, they ran apart!'],
      miss: ['Sorry!', 'My hands are briny.'],
    },
    emoji: '🥒',
    style: { speed: 5.5, spin: 0, startX: 0.06 },
    accuracy: { angle: 0.03, x: 0.1, speed: 0.9, spin: 0.15 },
    nerves: 1,
  },
  {
    id: 'donut',
    name: 'Donut Dana',
    blurb: 'All gas, no brakes. A bit of a hole in her game.',
    stars: 2,
    targetAverage: 95,
    outfit: 'rival-donut',
    head: 'donut',
    intro: ['Hope you like it fast, sweetie.', "I don't do slow. Or straight-ish. Or careful.", 'Ready to get glazed?'],
    lines: {
      strike: ['Glazed and amazed!', 'Hole in one! Wait, wrong sport.', 'Sprinkle THAT!'],
      spare: ['Filled it!', 'Sweet.', 'Got the jam out of the middle.'],
      good: ['Full speed, mostly on target!', 'Nearly a strike, hun.'],
      meh: ["Too fast? There's no such thing.", 'Eh. Dunked it.'],
      gutter: ["I'm toast. Well, a doughnut. But toast.", 'Stale.', 'That one went straight through the hole.'],
      split: ['Ugh, a gap. Story of my life.', 'Two pins, one doughnut.'],
      miss: ['Whoops! Too much sugar.', 'Rolled right past.'],
    },
    emoji: '🍩',
    style: { speed: 9.5, spin: 0, startX: 0.06 },
    accuracy: { angle: 0.017, x: 0.07, speed: 0.8, spin: 0.12 },
    nerves: 0.7,
  },
  {
    id: 'sandy',
    name: 'Sandy Wich',
    blurb: 'A neat little hook, and very smug about her spares.',
    stars: 3,
    targetAverage: 115,
    outfit: 'rival-sandy',
    head: 'sandwich',
    intro: ["Leave me a spare. I dare you.", "I've got layers, Dave. You've got... seeds.", "Let me guess: you're the filling?"],
    lines: {
      strike: ['Stacked it!', 'Toasted the lot.', 'A club sandwich special!'],
      spare: ['Spares are my bread and butter.', 'Layered to perfection.', 'As planned. Obviously.'],
      good: ['A nice filling.', 'Just shy of a full stack.'],
      meh: ["Leaves me plenty to work with.", 'Hold the mayo.'],
      gutter: ['Soggy.', 'That... was crust.', "Let's never speak of this."],
      split: ['Ooh, a challenge. How delicious.', 'Watch and learn.'],
      miss: ['Even I have off days. Rarely.', 'The lettuce slipped.'],
    },
    emoji: '🥪',
    style: { speed: 7.5, spin: -0.35, startX: 0.2 },
    accuracy: { angle: 0.017, x: 0.07, speed: 0.6, spin: 0.1 },
    nerves: 0.5,
    spareError: 0.45,
  },
  {
    id: 'carl',
    name: 'Carrot Carl',
    blurb: "The home champion. Steady hook, steady nerves, steady smugness.",
    stars: 4,
    targetAverage: 135,
    outfit: 'rival-carl',
    head: 'carrot',
    intro: ["So. The little tomato finally made it to the top rung.", "I've been champion here for years, Dave. Years.", "Ten frames. No hiding. Let's see what you've got."],
    lines: {
      strike: ["That's the Carl special.", 'Root and branch!', 'Pure carrot-ine.', 'Some of us just have it, Dave.'],
      spare: ['Tidy.', 'Cleaned up, as usual.', 'Peeled right off.'],
      good: ['Close. For me, a bad day.', 'Respectable.'],
      meh: ["I'm just warming up, Dave.", 'The lane is clearly oily.'],
      gutter: ['That did NOT happen.', 'My vision went. Need more vitamin A.', "...We'll call that a practice ball."],
      split: ['Hmm. Annoying.', "I'll make it. Watch."],
      miss: ['Hmph.', 'Distracted by your moustache.'],
    },
    emoji: '🥕',
    style: { speed: 8, spin: -0.5, startX: 0.26 },
    accuracy: { angle: 0.0105, x: 0.045, speed: 0.5, spin: 0.08 },
    nerves: 0.3,
  },
];

export const rivalById = (id: string) => RIVALS.find((r) => r.id === id);
