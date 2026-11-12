import { describe, expect, it } from 'vitest';
import { GameTracker, mergeProgress, NEW_PROGRESS, newlyUnlocked, unlockedIds } from './unlocks';

describe('unlocks', () => {
  it('starts with only the classic ball and navy suit', () => {
    expect([...unlockedIds(NEW_PROGRESS)].sort()).toEqual(['classic', 'navy']);
  });

  it('score thresholds unlock cherry, heirloom and tuxedo', () => {
    const p = mergeProgress(NEW_PROGRESS, { bestScore: 210 });
    expect(newlyUnlocked(NEW_PROGRESS, p).map((i) => i.id).sort()).toEqual(['cherry', 'heirloom', 'tuxedo']);
    expect(newlyUnlocked(p, mergeProgress(p, { bestScore: 250 }))).toEqual([]);
  });

  it('ten games unlock the tracksuit', () => {
    const p = mergeProgress(NEW_PROGRESS, { gamesPlayed: 9 });
    expect(newlyUnlocked(p, mergeProgress(p, { gamesPlayed: 10 })).map((i) => i.id)).toEqual(['tracksuit']);
  });

  it('progress never goes backwards', () => {
    const p = mergeProgress(NEW_PROGRESS, { bestScore: 180, turkey: true });
    expect(mergeProgress(p, { bestScore: 40, turkey: false })).toMatchObject({ bestScore: 180, turkey: true });
  });
});

describe('GameTracker', () => {
  it('counts strikes and spots a turkey', () => {
    const t = new GameTracker();
    expect(t.record('strike')).toEqual({ mostStrikesInGame: 1 });
    t.record('strike');
    expect(t.record('strike')).toEqual({ mostStrikesInGame: 3, turkey: true });
  });

  it('a break in the streak means no turkey', () => {
    const t = new GameTracker();
    t.record('strike');
    t.record('strike');
    t.record('other');
    expect(t.record('strike').turkey).toBeUndefined();
    expect(t.strikes).toBe(3);
  });

  it('a spare straight after a split counts as converting it', () => {
    const t = new GameTracker();
    t.record('split');
    expect(t.record('spare')).toEqual({ splitConverted: true });
    t.record('other');
    expect(t.record('spare')).toEqual({});
  });
});

describe("the Champion's Blazer", () => {
  it('unlocks for topping the Tomato Dave\'s ladder, and stays unlocked', () => {
    const before = NEW_PROGRESS;
    const after = mergeProgress(before, { homeChampion: true });
    expect(newlyUnlocked(before, after).map((i) => i.id)).toEqual(['blazer']);
    expect(unlockedIds(mergeProgress(after, { homeChampion: false })).has('blazer')).toBe(true);
  });
});
