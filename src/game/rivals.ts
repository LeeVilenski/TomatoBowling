// The computer bowlers. For now: the Tomato Dave's ladder (three rivals and the home
// champion). Accuracy numbers are tuned with `npm run check:rivals`, which plays each rival
// through simulated games and checks they average near `targetAverage`.
import type { BowlerSkill } from './ai';

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
  /** Suit they wear (until rival heads arrive, rivals bowl as Dave in their own colours). */
  outfit: string;
}

export const RIVALS: Rival[] = [
  {
    id: 'pickle',
    name: 'Pickle Pete',
    blurb: 'Slow, straight and sweats brine under pressure.',
    stars: 1,
    targetAverage: 70,
    outfit: 'rival-pickle',
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
    style: { speed: 8, spin: -0.5, startX: 0.26 },
    accuracy: { angle: 0.0105, x: 0.045, speed: 0.5, spin: 0.08 },
    nerves: 0.3,
  },
];

export const rivalById = (id: string) => RIVALS.find((r) => r.id === id);
