// Ten-pin scoring rules. Pure functions over a player's list of rolls (pins knocked down per ball).

export const FRAMES = 10;

export interface FrameView {
  /** What to print in each box: 'X', '/', '-', a number, or '' if not thrown yet. 2 boxes, or 3 in the 10th. */
  boxes: string[];
  /** Running total up to this frame, or null while it's still waiting on bonus balls. */
  total: number | null;
}

export interface Position {
  /** 0-based frame for the next roll (10 once the game is over). */
  frame: number;
  /** 0-based ball within that frame. */
  ball: number;
  /** Pins standing before the next roll. */
  standing: number;
  /** The next ball is the first on a fresh rack (so knocking all 10 is a strike, not a spare). */
  fresh: boolean;
  complete: boolean;
}

/** Splits a flat list of rolls into frames (the last one may be unfinished). */
export function splitFrames(rolls: number[]): number[][] {
  const frames: number[][] = [];
  let i = 0;
  while (i < rolls.length && frames.length < FRAMES) {
    if (frames.length === FRAMES - 1) {
      frames.push(rolls.slice(i, i + 3));
      break;
    }
    if (rolls[i] === 10) {
      frames.push([10]);
      i += 1;
    } else {
      frames.push(rolls.slice(i, i + 2));
      i += 2;
    }
  }
  return frames;
}

function tenthFrameDone(f: number[]): boolean {
  if (f.length === 3) return true;
  return f.length === 2 && f[0] + f[1] < 10;
}

/** Whether a 10th-frame ball is thrown at a fresh rack (first ball, or after a strike/spare). */
function tenthFresh(f: number[], ball: number): boolean {
  if (ball === 0) return true;
  if (ball === 1) return f[0] === 10;
  return f[0] === 10 ? f[1] === 10 : f[0] + f[1] === 10;
}

/** Pins standing before each ball of the 10th frame (fresh racks after strikes and spares). */
function tenthStanding(f: number[], ball: number): number {
  if (ball === 0) return 10;
  if (ball === 1) return f[0] === 10 ? 10 : 10 - f[0];
  // Third ball
  if (f[0] === 10) return f[1] === 10 ? 10 : 10 - f[1];
  return 10; // spare in the first two balls
}

export function position(rolls: number[]): Position {
  const frames = splitFrames(rolls);
  const done = { frame: FRAMES, ball: 0, standing: 10, fresh: true, complete: true };
  if (frames.length === 0) return { frame: 0, ball: 0, standing: 10, fresh: true, complete: false };
  const last = frames[frames.length - 1];
  const idx = frames.length - 1;

  if (idx === FRAMES - 1) {
    if (tenthFrameDone(last)) return done;
    const ball = last.length;
    return { frame: idx, ball, standing: tenthStanding(last, ball), fresh: tenthFresh(last, ball), complete: false };
  }
  const frameFinished = last[0] === 10 || last.length === 2;
  if (frameFinished) return { frame: idx + 1, ball: 0, standing: 10, fresh: true, complete: false };
  return { frame: idx, ball: 1, standing: 10 - last[0], fresh: false, complete: false };
}

/**
 * Display mark for one ball. `standing` is how many pins were up before it, and `fresh`
 * says whether it was the first ball at a full rack (only then is 10 a strike).
 */
export function mark(pins: number, standing: number, fresh: boolean): string {
  if (pins === 0) return '-';
  if (pins === 10 && fresh) return 'X';
  if (pins === standing) return '/';
  return String(pins);
}

export function scoreFrames(rolls: number[]): { frames: FrameView[]; total: number } {
  const split = splitFrames(rolls);
  const views: FrameView[] = [];
  let running = 0;
  let rollIndex = 0;
  let totalKnown = true;

  for (let f = 0; f < FRAMES; f++) {
    const frame = split[f] ?? [];
    const tenth = f === FRAMES - 1;
    const boxes = tenth ? ['', '', ''] : ['', ''];

    if (tenth) {
      frame.forEach((p, b) => (boxes[b] = mark(p, tenthStanding(frame, b), tenthFresh(frame, b))));
    } else if (frame[0] === 10) {
      boxes[1] = 'X'; // a strike is traditionally marked in the right-hand box
    } else {
      frame.forEach((p, b) => (boxes[b] = mark(p, b === 0 ? 10 : 10 - frame[0], b === 0)));
    }

    // Frame score = its pins plus any bonus balls, once they've been thrown
    let score: number | null = null;
    if (frame.length > 0) {
      if (tenth) {
        if (tenthFrameDone(frame)) score = frame.reduce((a, b) => a + b, 0);
      } else if (frame[0] === 10) {
        const bonus = rolls.slice(rollIndex + 1, rollIndex + 3);
        if (bonus.length === 2) score = 10 + bonus[0] + bonus[1];
      } else if (frame.length === 2) {
        if (frame[0] + frame[1] === 10) {
          const bonus = rolls[rollIndex + 2];
          if (bonus !== undefined) score = 10 + bonus;
        } else {
          score = frame[0] + frame[1];
        }
      }
    }

    if (score !== null && totalKnown) {
      running += score;
      views.push({ boxes, total: running });
    } else {
      totalKnown = false;
      views.push({ boxes, total: null });
    }
    rollIndex += frame.length;
  }
  return { frames: views, total: running };
}

/** Best possible final score from here (assumes strikes on every remaining ball). */
export function maxPossible(rolls: number[]): number {
  const extra: number[] = [...rolls];
  let p = position(extra);
  while (!p.complete) {
    extra.push(p.standing);
    p = position(extra);
  }
  return scoreFrames(extra).total;
}
