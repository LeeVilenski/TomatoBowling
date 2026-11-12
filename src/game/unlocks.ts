// Unlockable balls and suits, earned by playing. Progress is kept on the device.

export interface Progress {
  gamesPlayed: number;
  bestScore: number;
  mostStrikesInGame: number;
  turkey: boolean; // three strikes in a row
  splitConverted: boolean; // picked up a split for a spare
}

export const NEW_PROGRESS: Progress = {
  gamesPlayed: 0,
  bestScore: 0,
  mostStrikesInGame: 0,
  turkey: false,
  splitConverted: false,
};

export type ItemKind = 'ball' | 'suit';

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  how: string; // shown while locked
  unlocked: (p: Progress) => boolean;
}

export const ITEMS: Item[] = [
  { id: 'classic', kind: 'ball', name: 'Classic Tomato', how: 'Always yours', unlocked: () => true },
  { id: 'cherry', kind: 'ball', name: 'Cherry Tomato', how: 'Score 100 or more', unlocked: (p) => p.bestScore >= 100 },
  { id: 'green', kind: 'ball', name: 'Green Tomato', how: 'Bowl 3 strikes in one game', unlocked: (p) => p.mostStrikesInGame >= 3 },
  { id: 'heirloom', kind: 'ball', name: 'Heirloom', how: 'Score 150 or more', unlocked: (p) => p.bestScore >= 150 },
  { id: 'golden', kind: 'ball', name: 'Golden Tomato', how: 'Bowl a turkey (3 strikes in a row)', unlocked: (p) => p.turkey },
  { id: 'navy', kind: 'suit', name: 'Navy Suit', how: 'Always yours', unlocked: () => true },
  { id: 'tuxedo', kind: 'suit', name: 'Tuxedo', how: 'Score 200 or more', unlocked: (p) => p.bestScore >= 200 },
  { id: 'pinstripe', kind: 'suit', name: 'Pinstripe', how: 'Pick up a split', unlocked: (p) => p.splitConverted },
  { id: 'tracksuit', kind: 'suit', name: 'Tracksuit', how: 'Play 10 games', unlocked: (p) => p.gamesPlayed >= 10 },
];

export function unlockedIds(p: Progress): Set<string> {
  return new Set(ITEMS.filter((i) => i.unlocked(p)).map((i) => i.id));
}

/** Items unlocked by going from `before` to `after`. */
export function newlyUnlocked(before: Progress, after: Progress): Item[] {
  const had = unlockedIds(before);
  return ITEMS.filter((i) => !had.has(i.id) && i.unlocked(after));
}

/** Tracks one player's streaks through a game and reports progress as it happens. */
export class GameTracker {
  strikes = 0;
  /** Strikes in a row right now. */
  streak = 0;
  private splitLeft = false;

  /** Call after each ball with how the throw went. Returns progress changes to merge. */
  record(kind: 'strike' | 'spare' | 'split' | 'other'): Partial<Progress> {
    const out: Partial<Progress> = {};
    if (kind === 'strike') {
      this.strikes++;
      this.streak++;
      out.mostStrikesInGame = this.strikes;
      if (this.streak >= 3) out.turkey = true;
    } else {
      this.streak = 0;
    }
    if (kind === 'spare' && this.splitLeft) out.splitConverted = true;
    this.splitLeft = kind === 'split';
    return out;
  }
}

/** Combines progress, keeping the best of each record. */
export function mergeProgress(p: Progress, change: Partial<Progress>): Progress {
  return {
    gamesPlayed: Math.max(p.gamesPlayed, change.gamesPlayed ?? 0),
    bestScore: Math.max(p.bestScore, change.bestScore ?? 0),
    mostStrikesInGame: Math.max(p.mostStrikesInGame, change.mostStrikesInGame ?? 0),
    turkey: p.turkey || !!change.turkey,
    splitConverted: p.splitConverted || !!change.splitConverted,
  };
}
