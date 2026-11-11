// Decides how Tomato Dave reacts to a throw, and what he says.

export type ReactionKind = 'strike' | 'spare' | 'good' | 'meh' | 'gutter' | 'split' | 'miss';

// Pins are numbered 1–10: row 1 = [1], row 2 = [2, 3], row 3 = [4, 5, 6], row 4 = [7, 8, 9, 10]
const ROWS = [[1], [2, 3], [4, 5, 6], [7, 8, 9, 10]];

/** Pins that touch or sit diagonally next to each other in the triangle. */
function neighbours(pin: number): number[] {
  const row = ROWS.findIndex((r) => r.includes(pin));
  const i = ROWS[row].indexOf(pin);
  const out: number[] = [];
  const add = (r: number, j: number) => {
    if (ROWS[r] && ROWS[r][j] !== undefined) out.push(ROWS[r][j]);
  };
  add(row, i - 1);
  add(row, i + 1);
  add(row - 1, i - 1);
  add(row - 1, i);
  add(row + 1, i);
  add(row + 1, i + 1);
  return out;
}

/**
 * A split: the head pin is down and the pins left standing form two or more separate
 * groups with gaps between them (e.g. the 7-10, or the 4-6).
 */
export function isSplit(standing: number[]): boolean {
  if (standing.includes(1) || standing.length < 2) return false;
  const left = new Set(standing);
  const seen = new Set<number>([standing[0]]);
  const queue = [standing[0]];
  while (queue.length) {
    const p = queue.pop()!;
    for (const n of neighbours(p)) {
      if (left.has(n) && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size < standing.length;
}

/**
 * @param knocked pins knocked down by this ball
 * @param standingBefore pins standing before it
 * @param fresh whether it was thrown at a full rack
 * @param standingAfter pin numbers still standing afterwards
 */
export function classifyThrow(knocked: number, standingBefore: number, fresh: boolean, standingAfter: number[]): ReactionKind {
  if (fresh && knocked === 10) return 'strike';
  if (knocked === standingBefore) return 'spare';
  if (knocked === 0) return fresh ? 'gutter' : 'miss';
  if (fresh && isSplit(standingAfter)) return 'split';
  if (fresh && knocked >= 7) return 'good';
  return 'meh';
}

// Dave is a tomato, but he's also an IT professional, so it's half produce puns, half tech puns.
export const LINES: Record<ReactionKind, string[]> = {
  strike: [
    'Ketchup with THAT!', 'Tom-ah-TOE-tally!', 'Saucy!', 'Fresh off the vine!', "That's how we roll!", 'Heirloom quality!',
    'Ctrl + Alt + DELIGHT!', '404: Pins not found!', 'Ten pins. Zero bugs.', 'Deployed to production!', 'Pushed straight to main!',
    'Clean install!', 'All tests passing!',
  ],
  spare: [
    'Picked it up!', 'Spare me nothing!', 'Nice and juicy.', 'Ripe for the picking!', 'Squeezed it in!',
    'Hotfix applied.', 'Patched it!', 'Restored from backup!', 'Caught that exception!', 'Bug closed. Ship it.',
  ],
  good: [
    'Nearly!', 'So close!', 'Salsa-tisfactory.', 'Getting warmer.', 'Almost ripe!',
    '99% uploaded...', 'Just one failing test.', 'Nearly passed QA.', 'Almost compiled!',
  ],
  meh: [
    'Meh.', 'Could be riper.', 'A little green.', 'Sow-so.', 'Room to grow.',
    'Works on my machine.', 'Needs a refactor.', 'Still buffering...', 'That was the beta.', 'Low bandwidth roll.',
  ],
  gutter: [
    "...I'm sauce.", 'Puréed.', "I've been canned.", 'Squashed it.', 'Not my vine-st hour.',
    'Blue screen of death.', 'Have you tried turning it off and on again?', 'Segmentation fault.',
    'Fatal error: pins not found.', 'Dropped packets.', "That's going in the logs.",
  ],
  split: [
    'Hmm. A split.', "That's a pickle.", 'Split pea soup...', 'Gonna need a bigger tomato.',
    'Merge conflict!', 'Needs a git rebase.', 'Two branches, no merge.', 'Load balancing... badly.',
  ],
  miss: [
    'Missed it!', 'Oops.', 'Not my day.', 'Bit of a bruise.',
    'Null pointer.', 'Request timed out.', 'Ping failed.', 'Connection refused.',
  ],
};

const lastLine = new Map<ReactionKind, string>();

/** A random line for the reaction, avoiding the one used last time. */
export function pickLine(kind: ReactionKind, random = Math.random): string {
  const pool = LINES[kind].filter((l) => l !== lastLine.get(kind));
  const line = pool[Math.floor(random() * pool.length)];
  lastLine.set(kind, line);
  return line;
}
