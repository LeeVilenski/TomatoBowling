// The MEM Skills Challenge: career mode's encore, after you've won the Golden Pin. Down in
// the IT engineers' den, each challenge is a run of five different shots, each a set of pins
// with broken keyboards and mice wedged on the lane in the way. One ball at each: knock every
// pin down to make it. Your score is how many of the five you make.
// No graphics here, so it's all unit tested.

export type ObstacleKind = 'keyboard' | 'mouse';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  z: number;
  /** Turn about the vertical, radians (0: a keyboard stands square across the lane). */
  angle?: number;
}

/** One shot: the pins set, and the junk on the lane. */
export interface Go {
  /** Pin numbers (1–10). */
  pins: number[];
  obstacles: Obstacle[];
}

export interface Challenge {
  id: string;
  name: string;
  emoji: string;
  /** What to do, shown before the challenge. */
  blurb: string;
  /** The shots, in order: one ball at each. */
  goes: Go[];
}

/** Collision half-sizes (x, y, z) in metres: a keyboard stood up on its long edge, a mouse lying flat. */
export const OBSTACLE_HALF: Record<ObstacleKind, [number, number, number]> = {
  keyboard: [0.22, 0.075, 0.015],
  mouse: [0.034, 0.022, 0.058],
};

/** Shots in each challenge. */
export const GOES = 5;

/** Each pin's mirror image across the middle of the lane. */
const MIRROR_PIN: Record<number, number> = { 1: 1, 2: 3, 3: 2, 4: 6, 5: 5, 6: 4, 7: 10, 8: 9, 9: 8, 10: 7 };

/** The same shot from the other side of the lane: the 7 becomes the 10, left becomes right. */
export function mirror(go: Go): Go {
  return {
    pins: go.pins.map((p) => MIRROR_PIN[p]).sort((a, b) => a - b),
    obstacles: go.obstacles.map((o) => ({ ...o, x: -o.x, angle: o.angle === undefined ? undefined : -o.angle })),
  };
}

const kb = (x: number, z: number, angle?: number): Obstacle => ({ kind: 'keyboard', x, z, angle });
const ms = (x: number, z: number, angle?: number): Obstacle => ({ kind: 'mouse', x, z, angle });
const LENGTHWAYS = Math.PI / 2;

const bank: Go = { pins: [7], obstacles: [ms(-0.46, -10), kb(-0.36, -13, LENGTHWAYS)] };
const bankPair: Go = { pins: [4, 7], obstacles: [ms(-0.46, -10), kb(-0.38, -13.5, LENGTHWAYS)] };
const trap: Go = { pins: [10], obstacles: [ms(0.42, -10), ms(0.42, -12.5), ms(0.42, -15)] };
const trapPair: Go = { pins: [6, 10], obstacles: [ms(0.42, -9), ms(0.42, -11.5), ms(0.4, -14)] };
const firewallLeft: Go = { pins: [1, 2, 4, 7], obstacles: [kb(0.05, -9, LENGTHWAYS), ms(0.25, -14), ms(-0.42, -12)] };
const bucket: Go = { pins: [2, 4, 5, 8], obstacles: [kb(0.1, -8.5, LENGTHWAYS), ms(-0.4, -13.5)] };
const sideWall: Go = { pins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], obstacles: [kb(-0.12, -8, LENGTHWAYS), ms(0.45, -12)] };

export const CHALLENGES: Challenge[] = [
  {
    id: 'hello',
    name: 'Hello, World',
    emoji: '👋',
    blurb: 'Two dead keyboards make a gate. Thread the ball through it, then hit what\'s behind. The gate moves every shot.',
    goes: [
      { pins: [1], obstacles: [kb(-0.4, -9), kb(0.4, -9)] },
      { pins: [2], obstacles: [kb(-0.53, -10.5), kb(0.27, -10.5)] },
      { pins: [3], obstacles: [kb(-0.27, -10.5), kb(0.53, -10.5)] },
      { pins: [5], obstacles: [kb(-0.38, -12.5), kb(0.38, -12.5)] },
      { pins: [1, 2, 3], obstacles: [kb(-0.42, -7), kb(0.42, -7), ms(-0.3, -15.5), ms(0.3, -15.5)] },
    ],
  },
  {
    id: 'mousetrap',
    name: 'Mouse Trap',
    emoji: '🖱️',
    blurb: 'Rows of broken mice guard the edge boards. Get to the corner pins without touching one: right side, then left.',
    goes: [trap, mirror(trap), trapPair, mirror(trapPair), { pins: [6, 9, 10], obstacles: [ms(0.42, -9), ms(0.42, -12), ms(0.03, -12)] }],
  },
  {
    id: 'firewall',
    name: 'Firewall',
    emoji: '🧱',
    blurb: 'A keyboard is wedged lengthways down the lane, with mice in the way. Get round it and pick up the cluster behind.',
    goes: [
      { pins: [1, 2, 3, 5], obstacles: [kb(0, -9, LENGTHWAYS), ms(-0.33, -14.5), ms(0.33, -14.5)] },
      firewallLeft,
      mirror(firewallLeft),
      bucket,
      mirror(bucket),
    ],
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    emoji: '🏦',
    blurb: 'The corner pin is walled off down its own side. Start on the far side of the keyboard and hook back across: the 7 with left spin, the 10 with right.',
    goes: [bank, mirror(bank), bankPair, mirror(bankPair), { pins: [7], obstacles: [ms(-0.46, -10.5), kb(-0.34, -14, LENGTHWAYS)] }],
  },
  {
    id: 'splitbrain',
    name: 'Split Brain',
    emoji: '🧠',
    blurb: 'A different split every shot, with dead mice sat between the pins. Pick up both sides.',
    goes: [
      { pins: [7, 10], obstacles: [ms(0, -17.2), ms(-0.15, -13, 0.6)] },
      { pins: [4, 6], obstacles: [ms(0, -17.3), ms(0.2, -13, -0.6)] },
      { pins: [4, 10], obstacles: [ms(0.1, -17.5), ms(-0.2, -12.5)] },
      { pins: [6, 7], obstacles: [ms(-0.1, -17.5), ms(0.2, -12.5)] },
      { pins: [8, 10], obstacles: [ms(0.3, -17.2), ms(0, -13, 0.4)] },
    ],
  },
  {
    id: 'kernelpanic',
    name: 'Kernel Panic',
    emoji: '💥',
    blurb: 'Five full racks, a different pile of junk in front of each. Strike, or it all comes crashing down.',
    goes: [
      { pins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], obstacles: [kb(-0.5, -7, -0.35), kb(0.5, -7, 0.35), ms(-0.4, -13.5, 0.4), ms(0.44, -11.5, -0.5)] },
      { pins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], obstacles: [kb(-0.48, -11, -0.3), kb(0.48, -11, 0.3)] },
      sideWall,
      mirror(sideWall),
      { pins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], obstacles: [ms(-0.3, -9), ms(0.3, -9), ms(-0.38, -15), ms(0.38, -15)] },
    ],
  },
];

/** Best score (shots made out of GOES) for each challenge, by id. */
export interface SkillsSave {
  best: Record<string, number>;
}

export const NEW_SKILLS: SkillsSave = { best: {} };

export function loadSkills(raw: Partial<SkillsSave> | null | undefined): SkillsSave {
  const best: Record<string, number> = {};
  for (const [id, n] of Object.entries(raw?.best ?? {})) {
    if (CHALLENGES.some((c) => c.id === id) && typeof n === 'number') best[id] = Math.max(0, Math.min(GOES, Math.round(n)));
  }
  return { best };
}

/** Stars for a score: 3 of 5 for one star, 4 for two, all 5 for three. */
export function starsFor(made: number): number {
  return made >= GOES ? 3 : made >= GOES - 1 ? 2 : made >= GOES - 2 ? 1 : 0;
}

/** Records a score, keeping the best. */
export function recordScore(save: SkillsSave, id: string, made: number): SkillsSave {
  return { best: { ...save.best, [id]: Math.max(save.best[id] ?? 0, made) } };
}

export const starsOf = (save: SkillsSave, id: string) => starsFor(save.best[id] ?? 0);

/** The first challenge is open; each one after opens when you've a star on the one before. */
export function isShotOpen(save: SkillsSave, index: number): boolean {
  return index === 0 || starsOf(save, CHALLENGES[index - 1]?.id) > 0;
}

/** True once every challenge has at least a star. */
export function allShotsMade(save: SkillsSave): boolean {
  return CHALLENGES.every((c) => starsOf(save, c.id) > 0);
}

export function skillsStars(save: SkillsSave): number {
  return CHALLENGES.reduce((n, c) => n + starsOf(save, c.id), 0);
}
