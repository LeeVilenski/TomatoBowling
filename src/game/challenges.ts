// The MEM Skills Challenge: career mode's encore, after you've won the Golden Pin. Down in
// the IT engineers' den, each shot is a set of pins with broken keyboards and mice wedged on
// the lane in the way. Knock every pin down in one ball; you get three goes at each.
// No graphics here, so it's all unit tested.

export type ObstacleKind = 'keyboard' | 'mouse';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  z: number;
  /** Turn about the vertical, radians (0: a keyboard stands square across the lane). */
  angle?: number;
}

export interface Challenge {
  id: string;
  name: string;
  emoji: string;
  /** What to do, shown before the shot. */
  blurb: string;
  /** Pin numbers (1–10) set for the shot. */
  pins: number[];
  obstacles: Obstacle[];
}

/** Collision half-sizes (x, y, z) in metres: a keyboard stood up on its long edge, a mouse lying flat. */
export const OBSTACLE_HALF: Record<ObstacleKind, [number, number, number]> = {
  keyboard: [0.22, 0.075, 0.015],
  mouse: [0.034, 0.022, 0.058],
};

/** Goes at each shot. */
export const ATTEMPTS = 3;

export const CHALLENGES: Challenge[] = [
  {
    id: 'hello',
    name: 'Hello, World',
    emoji: '👋',
    blurb: 'Two dead keyboards make a gate halfway down. Thread the ball through it and take out the head pin.',
    pins: [1],
    obstacles: [
      { kind: 'keyboard', x: -0.4, z: -9 },
      { kind: 'keyboard', x: 0.4, z: -9 },
    ],
  },
  {
    id: 'mousetrap',
    name: 'Mouse Trap',
    emoji: '🖱️',
    blurb: 'A row of broken mice guards the right-hand boards. Get to the 10 pin without touching one.',
    pins: [10],
    obstacles: [
      { kind: 'mouse', x: 0.42, z: -10 },
      { kind: 'mouse', x: 0.42, z: -12.5 },
      { kind: 'mouse', x: 0.42, z: -15 },
    ],
  },
  {
    id: 'firewall',
    name: 'Firewall',
    emoji: '🧱',
    blurb: 'A keyboard is wedged lengthways down the middle of the lane, with mice either side of the pocket. Get past them all for the 1-2-3-5.',
    pins: [1, 2, 3, 5],
    obstacles: [
      { kind: 'keyboard', x: 0, z: -9, angle: Math.PI / 2 },
      { kind: 'mouse', x: -0.3, z: -14 },
      { kind: 'mouse', x: 0.3, z: -14 },
    ],
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    emoji: '🏦',
    blurb: 'A mouse blocks the left-hand boards and a keyboard walls off the 7 pin. Come at it across the lane, from the right.',
    pins: [7],
    obstacles: [
      { kind: 'mouse', x: -0.46, z: -12 },
      { kind: 'keyboard', x: -0.3, z: -16.5, angle: Math.PI / 2 },
    ],
  },
  {
    id: 'splitbrain',
    name: 'Split Brain',
    emoji: '🧠',
    blurb: 'The 7-10 split, with a dead mouse sat right between them. Pick up both.',
    pins: [7, 10],
    obstacles: [
      { kind: 'mouse', x: 0, z: -17.2 },
      { kind: 'mouse', x: -0.15, z: -13, angle: 0.6 },
    ],
  },
  {
    id: 'kernelpanic',
    name: 'Kernel Panic',
    emoji: '💥',
    blurb: 'A full rack behind a funnel of keyboards and a scatter of mice. Strike, or it all comes crashing down.',
    pins: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    obstacles: [
      { kind: 'keyboard', x: -0.5, z: -7, angle: -0.35 },
      { kind: 'keyboard', x: 0.5, z: -7, angle: 0.35 },
      { kind: 'mouse', x: -0.4, z: -13.5, angle: 0.4 },
      { kind: 'mouse', x: 0.44, z: -11.5, angle: -0.5 },
    ],
  },
];

/** Best stars for each shot (by id): 3 for first time, 2 second, 1 third. */
export interface SkillsSave {
  stars: Record<string, number>;
}

export const NEW_SKILLS: SkillsSave = { stars: {} };

export function loadSkills(raw: Partial<SkillsSave> | null | undefined): SkillsSave {
  const stars: Record<string, number> = {};
  for (const [id, n] of Object.entries(raw?.stars ?? {})) {
    if (CHALLENGES.some((c) => c.id === id) && typeof n === 'number') stars[id] = Math.max(0, Math.min(3, Math.round(n)));
  }
  return { stars };
}

/** Stars for making the shot on this go (1-based). */
export function starsForAttempt(attempt: number): number {
  return attempt >= 1 && attempt <= ATTEMPTS ? ATTEMPTS + 1 - attempt : 0;
}

/** Records a made shot, keeping the best stars. */
export function recordShot(save: SkillsSave, id: string, attempt: number): SkillsSave {
  const got = starsForAttempt(attempt);
  return { stars: { ...save.stars, [id]: Math.max(save.stars[id] ?? 0, got) } };
}

/** The first shot is open; each one after opens when you've made the one before. */
export function isShotOpen(save: SkillsSave, index: number): boolean {
  return index === 0 || (save.stars[CHALLENGES[index - 1]?.id] ?? 0) > 0;
}

/** True once every shot has been made. */
export function allShotsMade(save: SkillsSave): boolean {
  return CHALLENGES.every((c) => (save.stars[c.id] ?? 0) > 0);
}

export function skillsStars(save: SkillsSave): number {
  return CHALLENGES.reduce((n, c) => n + (save.stars[c.id] ?? 0), 0);
}
